import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  AuditActionType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import {
  CreateBatterySwapDto,
  SwapTypeEnum,
} from './dto/create-battery-swap.dto';
import { ListBatterySwapsDto } from './dto/list-battery-swaps.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';

export interface LeaseSummary {
  id: string;
  riderName: string;
  riderPhone: string;
  bikeLabel: string;
  bikePlate: string;
  totalPrincipal: number;
  totalPaid: number;
  dailyRate: number;
  arrears: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'DELINQUENT';
  lockState: 'LOCKED' | 'UNLOCKED';
  bikeId: string | null;
  pendingFines: number;
}

@Injectable()
export class FinancialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async recordPayment(user: AuthenticatedUser, dto: RecordPaymentDto) {
    // Enforce fleet isolation for rider
    const rider = await this.prisma.user.findFirst({
      where: {
        id: dto.riderId,
        fleetId: user.fleetId,
        role: 'RIDER',
      },
      include: {
        riderProfile: true,
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found in this fleet');
    }

    if (rider.riderProfile?.leaseToOwn) {
      const activeAssignment = await this.prisma.bikeAssignment.findFirst({
        where: {
          riderUserId: dto.riderId,
          active: true,
        },
      });
      if (!activeAssignment) {
        throw new BadRequestException(
          'Cannot collect lease fees for a rider who is not assigned to a bike',
        );
      }
    }

    const paidAtDate = new Date(dto.paidAt);

    // Define the day boundary in UTC
    const dayStart = new Date(paidAtDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(paidAtDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existingPayment = await this.prisma.riderPayment.findFirst({
      where: {
        fleetId: user.fleetId,
        riderId: dto.riderId,
        paidAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (existingPayment) {
      const payment = await this.prisma.riderPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: new Prisma.Decimal(dto.amount),
          paidAt: paidAtDate,
          method: dto.method,
          status: dto.status,
          reference: dto.reference || null,
          notes: dto.notes || null,
        },
        include: {
          rider: {
            select: {
              id: true,
              email: true,
              phone: true,
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      await this.auditService.createAuditLog({
        fleetId: user.fleetId,
        actorUserId: user.id,
        actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
        targetType: 'RIDER_PAYMENT',
        targetId: payment.id,
        metaJson: {
          riderId: dto.riderId,
          amount: dto.amount,
          method: dto.method,
          status: dto.status,
          reference: dto.reference || null,
          isUpdate: true,
        },
      });

      return this.toPaymentSummary(payment as unknown as PaymentWithRider);
    }

    const payment = await this.prisma.riderPayment.create({
      data: {
        fleetId: user.fleetId,
        riderId: dto.riderId,
        amount: new Prisma.Decimal(dto.amount),
        paidAt: paidAtDate,
        method: dto.method,
        status: dto.status,
        reference: dto.reference || null,
        notes: dto.notes || null,
      },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
      targetType: 'RIDER_PAYMENT',
      targetId: payment.id,
      metaJson: {
        riderId: dto.riderId,
        amount: dto.amount,
        method: dto.method,
        status: dto.status,
        reference: dto.reference || null,
      },
    });

    return this.toPaymentSummary(payment as unknown as PaymentWithRider);
  }

  async listPayments(
    user: AuthenticatedUser,
    query: ListPaymentsDto,
  ): Promise<PaginatedResponse<any>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.RiderPaymentWhereInput = {
      fleetId: user.fleetId,
    };

    if (query.riderId) {
      where.riderId = query.riderId;
    }

    if (query.method) {
      where.method = query.method;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.paidAt = {};
      if (query.startDate) {
        where.paidAt.gte = query.startDate.includes('T')
          ? new Date(query.startDate)
          : new Date(query.startDate + 'T00:00:00.000Z');
      }
      if (query.endDate) {
        where.paidAt.lte = query.endDate.includes('T')
          ? new Date(query.endDate)
          : new Date(query.endDate + 'T23:59:59.999Z');
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.riderPayment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          rider: {
            select: {
              id: true,
              email: true,
              phone: true,
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.riderPayment.count({ where }),
    ]);

    return createPaginatedResponse(
      payments.map((p) =>
        this.toPaymentSummary(p as unknown as PaymentWithRider),
      ),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  async getSummary(
    user: AuthenticatedUser,
    startDate?: string,
    endDate?: string,
  ) {
    const start = startDate
      ? startDate.includes('T')
        ? new Date(startDate)
        : new Date(startDate + 'T00:00:00.000Z')
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? endDate.includes('T')
        ? new Date(endDate)
        : new Date(endDate + 'T23:59:59.999Z')
      : new Date();

    // Sum of all payments in fleet
    const allPayments = await this.prisma.riderPayment.findMany({
      where: {
        fleetId: user.fleetId,
      },
    });

    // Filter payments in range
    const rangePayments = await this.prisma.riderPayment.findMany({
      where: {
        fleetId: user.fleetId,
        paidAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalEarnedAllTime = allPayments.reduce(
      (acc, p) => acc + p.amount.toNumber(),
      0,
    );
    const totalEarnedRange = rangePayments.reduce(
      (acc, p) => acc + p.amount.toNumber(),
      0,
    );

    // Earnings by method
    const methodBreakdown = rangePayments.reduce(
      (acc, p) => {
        const method = p.method;
        acc[method] = (acc[method] || 0) + p.amount.toNumber();
        return acc;
      },
      {} as Record<PaymentMethod, number>,
    );

    // Earnings by status
    const statusBreakdown = rangePayments.reduce(
      (acc, p) => {
        const status = p.status;
        acc[status] = (acc[status] || 0) + p.amount.toNumber();
        return acc;
      },
      {} as Record<PaymentStatus, number>,
    );

    // Daily earnings inside range
    const dailyEarningsMap = rangePayments.reduce(
      (acc, p) => {
        const day = p.paidAt.toISOString().slice(0, 10);
        acc[day] = (acc[day] || 0) + p.amount.toNumber();
        return acc;
      },
      {} as Record<string, number>,
    );

    const dailyEarnings = Object.entries(dailyEarningsMap)
      .map(([date, amount]) => ({
        date,
        amount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Active riders count
    const activeRidersCount = await this.prisma.user.count({
      where: {
        fleetId: user.fleetId,
        role: 'RIDER',
        status: 'ACTIVE',
      },
    });

    // Calculate lease contract arrears
    const leases = await this.getLeases(user);
    const totalLeaseArrears = leases.reduce(
      (sum, l) => sum + (l.arrears || 0),
      0,
    );

    // Overdue/unpaid counts (all-time outstanding)
    const overdueCount = allPayments.filter(
      (p) => p.status === 'OVERDUE',
    ).length;
    const unpaidCount = allPayments.filter((p) => p.status === 'UNPAID').length;

    // Outstanding total unpaid logs (all-time outstanding)
    const rawUnpaidLogsSum = allPayments
      .filter((p) => p.status === 'UNPAID' || p.status === 'OVERDUE')
      .reduce((acc, p) => acc + p.amount.toNumber(), 0);

    const unpaidLogsSum =
      rawUnpaidLogsSum > 0 ? rawUnpaidLogsSum : totalLeaseArrears;

    // Statistics for Today, This Month, This Year (aligned with reference end date)
    const referenceDate = endDate ? new Date(endDate) : new Date();

    const todayStart = new Date(referenceDate);
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayEnd = new Date(referenceDate);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const monthStart = new Date(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      1,
    );
    const yearStart = new Date(referenceDate.getUTCFullYear(), 0, 1);

    const todayPayments = allPayments.filter(
      (p) => p.paidAt >= todayStart && p.paidAt <= todayEnd,
    );
    const monthPayments = allPayments.filter((p) => p.paidAt >= monthStart);
    const yearPayments = allPayments.filter((p) => p.paidAt >= yearStart);

    const earnedToday = todayPayments.reduce(
      (acc, p) => acc + p.amount.toNumber(),
      0,
    );
    const earnedThisMonth = monthPayments.reduce(
      (acc, p) => acc + p.amount.toNumber(),
      0,
    );
    const earnedThisYear = yearPayments.reduce(
      (acc, p) => acc + p.amount.toNumber(),
      0,
    );

    return {
      earnedToday,
      earnedThisMonth,
      earnedThisYear,
      totalEarnedAllTime,
      totalEarnedRange,
      activeRidersCount,
      overdueCount,
      unpaidCount,
      unpaidLogsSum,
      totalLeaseArrears,
      methodBreakdown,
      statusBreakdown,
      dailyEarnings,
    };
  }

  async getLeases(user: AuthenticatedUser): Promise<LeaseSummary[]> {
    const riders = await this.prisma.user.findMany({
      where: {
        fleetId: user.fleetId,
        role: 'RIDER',
        riderProfile: {
          leaseToOwn: true,
        },
      },
      include: {
        riderProfile: true,
        trafficFines: true,
        bikeAssignments: {
          where: {
            active: true,
          },
          include: {
            bike: {
              include: {
                commands: {
                  where: {
                    status: 'ACKED',
                    type: { in: ['LOCK', 'UNLOCK'] },
                  },
                  orderBy: {
                    ackedAt: 'desc',
                  },
                  take: 1,
                },
              },
            },
          },
        },
        payments: {
          where: {
            status: 'PAID',
          },
        },
      },
    });

    return riders.map((rider) => {
      const profile = rider.riderProfile;
      const totalPrincipal = profile?.leasePrincipal ?? 2500000;
      const dailyRate = profile?.leaseDailyRate ?? 15000;
      const totalPaid = rider.payments.reduce(
        (sum, p) => sum + p.amount.toNumber(),
        0,
      );

      const activeAssignment = rider.bikeAssignments[0];
      let arrears = 0;
      let bikeLabel = 'N/A';
      let bikePlate = 'N/A';
      let lockState: 'LOCKED' | 'UNLOCKED' = 'UNLOCKED';

      if (activeAssignment) {
        const bike = activeAssignment.bike;
        bikeLabel = bike.label;
        bikePlate = bike.plate || 'N/A';

        const lastCommand = bike.commands[0];
        if (lastCommand && lastCommand.type === 'LOCK') {
          lockState = 'LOCKED';
        }

        const assignedAt = activeAssignment.assignedAt;
        const msDiff = Date.now() - assignedAt.getTime();
        const daysDiff = Math.max(
          0,
          Math.floor(msDiff / (1000 * 60 * 60 * 24)),
        );
        const expected = daysDiff * dailyRate;
        arrears = Math.max(0, expected - totalPaid);
      }

      const totalPendingFines = rider.trafficFines
        .filter((f) => f.status === 'PENDING')
        .reduce((sum, f) => sum + f.amount, 0);

      arrears += totalPendingFines;

      let status: 'ACTIVE' | 'PAID_OFF' | 'DELINQUENT' = 'ACTIVE';
      if (totalPaid >= totalPrincipal) {
        status = 'PAID_OFF';
      } else if (arrears > 0) {
        status = 'DELINQUENT';
      }

      return {
        id: rider.id,
        riderName: profile?.fullName ?? `Rider ${rider.id.slice(0, 8)}`,
        riderPhone: rider.phone ?? '',
        bikeLabel,
        bikePlate,
        totalPrincipal,
        totalPaid,
        dailyRate,
        arrears,
        status,
        lockState,
        bikeId: activeAssignment?.bikeId || null,
        pendingFines: totalPendingFines,
      };
    });
  }

  private toPaymentSummary(p: PaymentWithRider) {
    return {
      id: p.id,
      fleetId: p.fleetId,
      riderId: p.riderId,
      riderName:
        p.rider?.riderProfile?.fullName ?? `Rider ${p.riderId.slice(0, 8)}`,
      riderEmail: p.rider?.email || null,
      riderPhone: p.rider?.phone || null,
      amount: p.amount.toNumber(),
      paidAt: p.paidAt,
      method: p.method,
      status: p.status,
      reference: p.reference,
      notes: p.notes,
      createdAt: p.createdAt,
    };
  }

  async getDeliveryFinancialSummary(user: AuthenticatedUser) {
    const fleetId = user.fleetId;

    const payments = await this.prisma.riderPayment.findMany({
      where: {
        fleetId,
        notes: { startsWith: 'Delivery Commission' },
      },
    });

    let totalPending = 0;
    let totalPaid = 0;
    let count = 0;

    for (const p of payments) {
      const amt = Number(p.amount);
      if (p.status === 'UNPAID') {
        totalPending += amt;
      } else if (p.status === 'PAID') {
        totalPaid += amt;
      }
      count++;
    }

    const avgCommission = count > 0 ? (totalPending + totalPaid) / count : 0;

    return {
      totalPending,
      totalPaid,
      deliveryCount: count,
      avgCommission,
    };
  }

  async getDeliveryPayouts(user: AuthenticatedUser) {
    const fleetId = user.fleetId;

    const payments = await this.prisma.riderPayment.findMany({
      where: {
        fleetId,
        notes: { startsWith: 'Delivery Commission' },
      },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      riderId: p.riderId,
      riderName: p.rider?.riderProfile?.fullName || 'Unnamed Rider',
      riderPhone: p.rider?.phone || '',
      amount: Number(p.amount),
      paidAt: p.paidAt,
      status: p.status,
      notes: p.notes,
      reference: p.reference,
    }));
  }

  async recordDeliveryPayout(
    user: AuthenticatedUser,
    dto: { riderId: string },
  ) {
    const fleetId = user.fleetId;

    const unpaidCommissions = await this.prisma.riderPayment.findMany({
      where: {
        fleetId,
        riderId: dto.riderId,
        status: 'UNPAID',
        notes: { startsWith: 'Delivery Commission' },
      },
    });

    if (unpaidCommissions.length === 0) {
      throw new BadRequestException(
        'No pending commissions to pay out for this rider',
      );
    }

    const ids = unpaidCommissions.map((p) => p.id);
    await this.prisma.riderPayment.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: 'PAID',
        method: 'MOBILE_MONEY',
        paidAt: new Date(),
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
      targetType: 'RIDER_PAYOUT',
      targetId: dto.riderId,
      metaJson: {
        riderId: dto.riderId,
        totalPaid: unpaidCommissions.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        ),
        commissionCount: unpaidCommissions.length,
      },
    });

    return { success: true, count: unpaidCommissions.length };
  }

  async listBatterySwaps(user: AuthenticatedUser, query: ListBatterySwapsDto) {
    const pagination = getPaginationParams(query);
    const where: Prisma.BatterySwapWhereInput = {
      fleetId: user.fleetId,
    };

    if (query.bikeId) where.bikeId = query.bikeId;
    if (query.riderId) where.riderId = query.riderId;

    if (query.startDate || query.endDate) {
      where.ts = {};
      if (query.startDate) {
        where.ts.gte = query.startDate.includes('T')
          ? new Date(query.startDate)
          : new Date(query.startDate + 'T00:00:00.000Z');
      }
      if (query.endDate) {
        where.ts.lte = query.endDate.includes('T')
          ? new Date(query.endDate)
          : new Date(query.endDate + 'T23:59:59.999Z');
      }
    }

    if (query.search) {
      where.OR = [
        { swapStation: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
        { bike: { label: { contains: query.search, mode: 'insensitive' } } },
        { bike: { plate: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [swaps, total, aggregations] = await Promise.all([
      this.prisma.batterySwap.findMany({
        where,
        orderBy: { ts: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          bike: {
            select: { id: true, label: true, plate: true, serial: true },
          },
          rider: {
            select: {
              id: true,
              email: true,
              phone: true,
              riderProfile: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.batterySwap.count({ where }),
      this.prisma.batterySwap.aggregate({
        where,
        _sum: { totalCostRwf: true, fraction: true },
        _count: { id: true },
      }),
    ]);

    const typeCounts = await this.prisma.batterySwap.groupBy({
      by: ['swapType'],
      where,
      _count: { id: true },
      _sum: { totalCostRwf: true },
    });

    const breakdown: Record<string, { count: number; totalCost: number }> = {
      FULL: { count: 0, totalCost: 0 },
      HALF: { count: 0, totalCost: 0 },
      QUARTER: { count: 0, totalCost: 0 },
      CUSTOM: { count: 0, totalCost: 0 },
    };

    typeCounts.forEach((tc) => {
      if (breakdown[tc.swapType]) {
        breakdown[tc.swapType] = {
          count: tc._count.id,
          totalCost: tc._sum.totalCostRwf || 0,
        };
      }
    });

    const totalCostRwf = aggregations._sum.totalCostRwf || 0;
    const totalUnits = aggregations._sum.fraction || 0;

    return {
      data: swaps,
      meta: {
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
      summary: {
        totalSwaps: total,
        totalCostRwf,
        totalUnits: Math.round(totalUnits * 100) / 100,
        avgCostPerSwap: total > 0 ? Math.round(totalCostRwf / total) : 0,
        breakdown,
      },
    };
  }

  async createBatterySwap(user: AuthenticatedUser, dto: CreateBatterySwapDto) {
    const unitPrice = dto.unitPriceRwf ?? 2500;
    let fraction = 1.0;

    if (dto.swapType === SwapTypeEnum.FULL) {
      fraction = 1.0;
    } else if (dto.swapType === SwapTypeEnum.HALF) {
      fraction = 0.5;
    } else if (dto.swapType === SwapTypeEnum.QUARTER) {
      fraction = 0.25;
    } else if (dto.swapType === SwapTypeEnum.CUSTOM) {
      fraction = dto.fraction && dto.fraction > 0 ? dto.fraction : 1.0;
    }

    const totalCostRwf = Math.round(unitPrice * fraction);
    const timestamp = dto.ts ? new Date(dto.ts) : new Date();

    const swap = await this.prisma.batterySwap.create({
      data: {
        fleetId: user.fleetId,
        bikeId: dto.bikeId || null,
        riderId: dto.riderId || null,
        swapStation: dto.swapStation || 'Kigali Central Hub',
        swapType: dto.swapType,
        fraction,
        unitPriceRwf: unitPrice,
        totalCostRwf,
        batterySerialOut: dto.batterySerialOut || null,
        batterySerialIn: dto.batterySerialIn || null,
        soCOutPct: dto.soCOutPct !== undefined ? dto.soCOutPct : null,
        soCInPct: dto.soCInPct !== undefined ? dto.soCInPct : null,
        ts: timestamp,
        notes: dto.notes || null,
      },
      include: {
        bike: { select: { id: true, label: true, plate: true } },
        rider: {
          select: { id: true, riderProfile: { select: { fullName: true } } },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.RIDER_PAYMENT_RECORDED,
      targetType: 'BATTERY_SWAP',
      targetId: swap.id,
      metaJson: {
        swapType: dto.swapType,
        fraction,
        totalCostRwf,
        bikeId: dto.bikeId,
        riderId: dto.riderId,
      },
    });

    return swap;
  }

  async deleteBatterySwap(user: AuthenticatedUser, id: string) {
    const swap = await this.prisma.batterySwap.findFirst({
      where: { id, fleetId: user.fleetId },
    });
    if (!swap) {
      throw new NotFoundException('Battery swap record not found');
    }
    await this.prisma.batterySwap.delete({ where: { id } });
    return { success: true, id };
  }
}

interface PaymentWithRider {
  id: string;
  fleetId: string;
  riderId: string;
  amount: Prisma.Decimal;
  paidAt: Date;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  rider?: {
    id: string;
    email: string | null;
    phone: string | null;
    riderProfile?: {
      fullName: string;
    } | null;
  } | null;
}
