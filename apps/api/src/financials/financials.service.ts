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
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';

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
        where.paidAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.paidAt.lte = new Date(query.endDate);
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
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

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

    // Overdue/unpaid counts
    const overdueCount = rangePayments.filter(
      (p) => p.status === 'OVERDUE',
    ).length;
    const unpaidCount = rangePayments.filter(
      (p) => p.status === 'UNPAID',
    ).length;

    // Outstanding total unpaid logs
    const unpaidLogsSum = rangePayments
      .filter((p) => p.status === 'UNPAID' || p.status === 'OVERDUE')
      .reduce((acc, p) => acc + p.amount.toNumber(), 0);

    // Statistics for Today, This Month, This Year
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const todayPayments = allPayments.filter(
      (p) => p.createdAt >= todayStart && p.createdAt <= todayEnd,
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
      methodBreakdown,
      statusBreakdown,
      dailyEarnings,
    };
  }

  async getLeases(user: AuthenticatedUser): Promise<any[]> {
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
