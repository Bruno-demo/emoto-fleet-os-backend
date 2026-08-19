import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingCycle,
  BillingCycleStatus,
  FleetBillingMode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { PricingTierService } from './pricing-tier.service';
import { DiscountService } from './discount.service';
import { PaygAuditService } from './payg-audit.service';
import { ListBillingCyclesDto } from '../dto/list-billing-cycles.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/pagination';
export type BillingCycleWithDetails = Prisma.BillingCycleGetPayload<{
  include: {
    fleet: {
      select: {
        name: true;
        plan: true;
        monthlyRatePerBike: true;
        momoPhoneNumber: true;
        bankName: true;
        bankAccountNumber: true;
      };
    };
    discount: true;
    payments: {
      include: {
        recordedBy: {
          select: { email: true; phone: true };
        };
      };
    };
  };
}>;

@Injectable()
export class BillingCycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly pricingTierService: PricingTierService,
    private readonly discountService: DiscountService,
    private readonly paygAuditService: PaygAuditService,
  ) {}

  async listCycles(
    query: ListBillingCyclesDto,
  ): Promise<PaginatedResponse<BillingCycle>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.BillingCycleWhereInput = {};

    if (query.fleetId) {
      where.fleetId = query.fleetId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [cycles, total] = await Promise.all([
      this.prisma.billingCycle.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          fleet: {
            select: { name: true, plan: true },
          },
          discount: true,
        },
      }),
      this.prisma.billingCycle.count({ where }),
    ]);

    return createPaginatedResponse(
      cycles,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getCycle(id: string): Promise<BillingCycleWithDetails> {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id },
      include: {
        fleet: {
          select: {
            name: true,
            plan: true,
            monthlyRatePerBike: true,
            momoPhoneNumber: true,
            bankName: true,
            bankAccountNumber: true,
          },
        },
        discount: true,
        payments: {
          include: {
            recordedBy: {
              select: { email: true, phone: true },
            },
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Billing cycle with ID ${id} not found`);
    }

    return cycle;
  }

  async generateCycleForFleet(
    fleetId: string,
    isManual = false,
  ): Promise<BillingCycle> {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: {
        bikes: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!fleet) {
      throw new NotFoundException(`Fleet not found`);
    }

    const config = await this.prisma.billingConfig.findFirst();
    const cycleDays = config?.billingCycleDays ?? 30;

    const defaultRate = PricingTierService.getRateForFleetType(fleet.type);
    const tier = await this.pricingTierService.getTierByPlanCode(fleet.plan);
    const ratePerBike =
      fleet.monthlyRatePerBike ??
      defaultRate ??
      tier?.monthlyRatePerBike ??
      350;

    const lastCycle = await this.prisma.billingCycle.findFirst({
      where: { fleetId },
      orderBy: { cycleNumber: 'desc' },
    });

    let periodStart = new Date();
    let cycleNumber = 1;

    if (lastCycle) {
      periodStart = new Date(lastCycle.periodEnd);
      cycleNumber = lastCycle.cycleNumber + 1;
    } else if (fleet.billingStartedAt) {
      periodStart = new Date(fleet.billingStartedAt);
    } else if (fleet.trialEndsAt) {
      periodStart = new Date(fleet.trialEndsAt);
    } else {
      periodStart = new Date(fleet.createdAt);
    }

    const now = new Date();
    if (!isManual && periodStart > now) {
      throw new BadRequestException(
        `Cannot generate billing cycle #${cycleNumber}: cycle start date (${periodStart.toISOString().slice(0, 10)}) has not arrived yet. Automated invoices cannot be generated for future billing periods.`,
      );
    }

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + cycleDays);

    // Set invoice due date to periodEnd (end of billing cycle period) instead of periodStart
    const dueDate = new Date(periodEnd);

    const totalFleetActiveBikes = fleet.bikes.length;
    let bikeCount = totalFleetActiveBikes;
    let subtotal = 0;
    let effectiveRatePerBike = ratePerBike;
    let cycleNotes = '';

    const isPayg =
      fleet.plan === 'PAYG' ||
      fleet.billingMode === FleetBillingMode.PAYG_TRIP_VALIDATED;

    const intervalLabel =
      cycleDays === 7
        ? 'week'
        : cycleDays === 30
          ? 'month'
          : `${cycleDays} days`;

    if (isPayg) {
      // Audit trips recorded in this period (up to now if period is ongoing)
      const auditEnd = now < periodEnd ? now : periodEnd;
      const audit = await this.paygAuditService.getPaygAuditForFleet(
        fleetId,
        periodStart.toISOString(),
        auditEnd.toISOString(),
      );
      effectiveRatePerBike =
        fleet.type === 'DELIVERY' &&
        (!fleet.emotoPaygRatePerActiveDay ||
          fleet.emotoPaygRatePerActiveDay === 350)
          ? 500
          : (fleet.emotoPaygRatePerActiveDay ?? 350);

      // Only count bikes that actually completed >= 1 trip during this billing period
      const operatingBikesCount = audit.perBikeSummary.filter(
        (b) => b.activeDays > 0,
      ).length;
      bikeCount = operatingBikesCount;

      cycleNotes = `Calculated via Active Days (${effectiveRatePerBike.toLocaleString()} RWF/active day - ${fleet.type || 'COOP'} Fleet) — ${audit.totalActiveBikeDays} active bike-day(s) across ${operatingBikesCount} operating bike(s) (out of ${totalFleetActiveBikes} registered).`;
      subtotal =
        audit.totalPaygSubtotalRwf ??
        audit.totalActiveBikeDays * effectiveRatePerBike;
    } else {
      subtotal = bikeCount * ratePerBike;
      cycleNotes = `Standard rate per bike (${ratePerBike.toLocaleString()} RWF / ${intervalLabel}).`;
    }

    // Check if fleet has an active subscription plan for discount
    const activeSubscription = await this.prisma.fleetSubscription.findFirst({
      where: {
        fleetId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      include: { plan: true },
    });

    let discountAmount = 0;
    if (activeSubscription?.plan?.discountPercent) {
      discountAmount = Math.round(
        subtotal * (activeSubscription.plan.discountPercent / 100),
      );
    }

    const totalDue = Math.max(0, subtotal - discountAmount);

    const isTrial = fleet.trialEndsAt ? new Date() < fleet.trialEndsAt : false;

    const cycle = await this.prisma.billingCycle.create({
      data: {
        fleetId,
        cycleNumber,
        periodStart,
        periodEnd,
        dueDate,
        bikeCount,
        ratePerBike: effectiveRatePerBike,
        subtotal,
        discountAmount,
        totalDue,
        totalPaid: 0,
        status: isTrial ? BillingCycleStatus.PAID : BillingCycleStatus.PENDING,
        isTrial,
        notes: cycleNotes,
      },
    });

    if (!fleet.billingStartedAt) {
      await this.prisma.fleet.update({
        where: { id: fleetId },
        data: { billingStartedAt: periodStart },
      });
    }

    await this.auditService.createAuditLog({
      fleetId,
      actionType: 'BILLING_CYCLE_GENERATED',
      targetType: 'BillingCycle',
      targetId: cycle.id,
      metaJson: { cycle, isManual, billingMode: fleet.billingMode },
    });

    return cycle;
  }

  /**
   * Reconciles and finalizes an open/pending PAYG billing cycle with completed GPS active days
   */
  async reconcilePaygCycle(cycleId: string): Promise<BillingCycle> {
    const cycle = await this.prisma.billingCycle.findUnique({
      where: { id: cycleId },
      include: { fleet: true },
    });

    if (
      !cycle ||
      cycle.status === BillingCycleStatus.PAID ||
      cycle.status === BillingCycleStatus.VOID
    ) {
      return cycle!;
    }

    const isPayg =
      cycle.fleet.plan === 'PAYG' ||
      cycle.fleet.billingMode === FleetBillingMode.PAYG_TRIP_VALIDATED;

    if (!isPayg) {
      return cycle;
    }

    const audit = await this.paygAuditService.getPaygAuditForFleet(
      cycle.fleetId,
      cycle.periodStart.toISOString(),
      cycle.periodEnd.toISOString(),
    );

    const effectiveRatePerBike =
      cycle.fleet.type === 'DELIVERY' &&
      (!cycle.fleet.emotoPaygRatePerActiveDay ||
        cycle.fleet.emotoPaygRatePerActiveDay === 350)
        ? 500
        : (cycle.fleet.emotoPaygRatePerActiveDay ?? 350);

    const subtotal =
      audit.totalPaygSubtotalRwf ??
      audit.totalActiveBikeDays * effectiveRatePerBike;

    let discountAmount = 0;
    if (cycle.discountId) {
      const discount = await this.prisma.discount.findUnique({
        where: { id: cycle.discountId },
      });
      if (discount) {
        discountAmount =
          discount.type === 'PERCENTAGE'
            ? Math.round(subtotal * (Number(discount.value) / 100))
            : Math.min(subtotal, Math.round(Number(discount.value)));
      }
    }

    const operatingBikesCount = audit.perBikeSummary.filter(
      (b) => b.activeDays > 0,
    ).length;

    const totalDue = Math.max(0, subtotal - discountAmount);
    const cycleNotes = `Calculated via Active Days (${effectiveRatePerBike.toLocaleString()} RWF/active day - ${cycle.fleet.type || 'COOP'} Fleet) — ${audit.totalActiveBikeDays} active bike-day(s) across ${operatingBikesCount} operating bike(s).`;

    const updated = await this.prisma.billingCycle.update({
      where: { id: cycleId },
      data: {
        bikeCount: operatingBikesCount,
        subtotal,
        discountAmount,
        totalDue,
        ratePerBike: effectiveRatePerBike,
        notes: cycleNotes,
      },
    });

    return updated;
  }

  async voidCycle(id: string, user: AuthenticatedUser): Promise<BillingCycle> {
    const current = await this.getCycle(id);

    if (current.status === BillingCycleStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }

    const updated = await this.prisma.billingCycle.update({
      where: { id },
      data: { status: BillingCycleStatus.VOID },
    });

    await this.auditService.createAuditLog({
      fleetId: current.fleetId,
      actorUserId: user.id,
      actionType: 'FLEET_PLAN_CHANGED',
      targetType: 'BillingCycle',
      targetId: id,
      metaJson: { before: current, after: updated },
    });

    return updated;
  }

  async updateCycleNotes(id: string, notes: string): Promise<BillingCycle> {
    await this.getCycle(id);

    return this.prisma.billingCycle.update({
      where: { id },
      data: { notes },
    });
  }

  async getCycleBreakdown(id: string) {
    const cycle = await this.getCycle(id);
    const audit = await this.paygAuditService.getPaygAuditForFleet(
      cycle.fleetId,
      cycle.periodStart.toISOString(),
      cycle.periodEnd.toISOString(),
    );

    return {
      cycle,
      audit,
      notes: cycle.notes || `Calculated via Active Days (350 RWF/active day)`,
    };
  }

  /**
   * Generates a clean, printable HTML invoice statement for official fleet records
   */
  async generateInvoiceHtml(cycleId: string): Promise<string> {
    const cycle = await this.getCycle(cycleId);
    const issueDate = new Date(cycle.createdAt).toLocaleDateString('en-GB');
    const periodStartStr = new Date(cycle.periodStart).toLocaleDateString('en-GB');
    const periodEndStr = new Date(cycle.periodEnd).toLocaleDateString('en-GB');
    const dueDateStr = new Date(cycle.dueDate).toLocaleDateString('en-GB');
    const statusColor =
      cycle.status === 'PAID'
        ? '#16a34a'
        : cycle.status === 'OVERDUE'
          ? '#dc2626'
          : '#ca8a04';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${cycle.cycleNumber} - ${cycle.fleet.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .brand { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; text-transform: uppercase; color: #fff; background-color: ${statusColor}; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
    .meta-box { background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9; }
    .meta-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .meta-val { font-size: 14px; font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { text-align: left; background-color: #f8fafc; padding: 12px; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; }
    td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .total-section { margin-left: auto; width: 300px; margin-top: 16px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-row.grand { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 12px; color: #0f172a; }
    .settlement-box { margin-top: 36px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; }
    .settlement-title { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 6px; }
    .settlement-code { font-size: 16px; font-family: monospace; font-weight: 700; color: #15803d; }
    .print-btn { display: inline-block; margin-top: 24px; padding: 10px 20px; background: #0f172a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; text-decoration: none; }
    @media print { .print-btn { display: none; } body { padding: 0; } .invoice-card { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">⚡ E-MOTO FLEET OS</div>
        <div class="brand-sub">Smart Fleet Operations & IoT Telematics • Kigali, Rwanda</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 700; color: #0f172a;">INVOICE #${cycle.cycleNumber}</div>
        <div class="badge" style="margin-top: 6px;">${cycle.status}</div>
      </div>
    </div>

    <div class="details-grid">
      <div class="meta-box">
        <div class="meta-label">Billed To</div>
        <div class="meta-val" style="font-size: 16px;">${cycle.fleet.name}</div>
        <div class="brand-sub">Plan: ${cycle.fleet.plan} • Fleet OS ID: ${cycle.fleetId.slice(0, 8)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Invoice Details</div>
        <div class="meta-val">Issue Date: ${issueDate}</div>
        <div class="meta-val">Period: ${periodStartStr} – ${periodEndStr}</div>
        <div class="meta-val" style="color: #b91c1c;">Due Date: ${dueDateStr}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Bikes / Days</th>
          <th style="text-align: right;">Rate (RWF)</th>
          <th style="text-align: right;">Amount (RWF)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Fleet OS Operations & Telematics</strong><br>
            <span style="font-size: 12px; color: #64748b;">${cycle.notes || 'Fleet platform subscription'}</span>
          </td>
          <td style="text-align: center;">${cycle.bikeCount}</td>
          <td style="text-align: right;">${cycle.ratePerBike.toLocaleString()}</td>
          <td style="text-align: right; font-weight: 600;">${cycle.subtotal.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <div class="total-section">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${cycle.subtotal.toLocaleString()} RWF</span>
      </div>
      ${
        cycle.discountAmount > 0
          ? `<div class="total-row" style="color: #16a34a;">
              <span>Discount Applied:</span>
              <span>-${cycle.discountAmount.toLocaleString()} RWF</span>
            </div>`
          : ''
      }
      <div class="total-row grand">
        <span>Total Due:</span>
        <span>${cycle.totalDue.toLocaleString()} RWF</span>
      </div>
      <div class="total-row" style="color: #64748b; font-size: 13px;">
        <span>Amount Paid:</span>
        <span>${cycle.totalPaid.toLocaleString()} RWF</span>
      </div>
    </div>

    <div class="settlement-box">
      <div class="settlement-title">💳 Official Settlement Instructions</div>
      ${
        cycle.fleet.momoPhoneNumber
          ? `<div>MTN / Airtel Mobile Money:</div>
      <div class="settlement-code">${cycle.fleet.momoPhoneNumber} (${cycle.fleet.name})</div>`
          : `<div>MTN Mobile Money Merchant Code:</div>
      <div class="settlement-code">*182*8*1*1347154# (BRUNO)</div>`
      }
      ${
        cycle.fleet.bankName && cycle.fleet.bankAccountNumber
          ? `<div style="margin-top: 8px; font-size: 13px; color: #166534;">
        Bank: <strong>${cycle.fleet.bankName}</strong> | Account: <strong>${cycle.fleet.bankAccountNumber}</strong>
      </div>`
          : ''
      }
      <div style="font-size: 12px; color: #475569; margin-top: 6px;">
        Reference: <strong>INV-${cycle.cycleNumber}-${cycle.fleet.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}</strong>
      </div>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;
  }
}
