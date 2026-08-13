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
      select: { name: true; plan: true; monthlyRatePerBike: true };
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
          select: { name: true, plan: true, monthlyRatePerBike: true },
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

    const defaultRate = PricingTierService.getRateForFleetType();
    const tier = await this.pricingTierService.getTierByPlanCode(fleet.plan);
    const ratePerBike =
      fleet.monthlyRatePerBike ??
      defaultRate ??
      tier?.monthlyRatePerBike ??
      10000;

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

    // Set invoice due date to periodEnd (end of billing cycle month) instead of periodStart
    const dueDate = new Date(periodEnd);

    const bikeCount = fleet.bikes.length;
    let subtotal = 0;
    let effectiveRatePerBike = ratePerBike;
    let cycleNotes = '';

    const isPayg =
      fleet.plan === 'PAYG' ||
      fleet.billingMode === FleetBillingMode.PAYG_TRIP_VALIDATED;

    if (isPayg) {
      const audit = await this.paygAuditService.getPaygAuditForFleet(
        fleetId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
      );
      subtotal = audit.totalPaygSubtotalRwf;
      effectiveRatePerBike = fleet.emotoPaygRatePerActiveDay ?? 350;
      cycleNotes = `Calculated via Active Days (350 RWF/active day) — ${audit.totalActiveBikeDays} active bike-day(s) recorded across ${bikeCount} bike(s).`;
    } else {
      subtotal = bikeCount * ratePerBike;
      cycleNotes = `Standard rate per bike (${ratePerBike.toLocaleString()} RWF / month).`;
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
      actionType: 'FLEET_PLAN_CHANGED', // Or map to a general void audit log
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
}
