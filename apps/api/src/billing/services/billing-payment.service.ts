import { BadRequestException, Injectable } from '@nestjs/common';
import { BillingCycleStatus, FleetSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MailService } from '../../mail/mail.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { RecordBillingPaymentDto } from '../dto/record-billing-payment.dto';
import {
  BillingCycleService,
  BillingCycleWithDetails,
} from './billing-cycle.service';

@Injectable()
export class BillingPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly billingCycleService: BillingCycleService,
    private readonly mailService: MailService,
  ) {}

  async recordPayment(
    cycleId: string,
    dto: RecordBillingPaymentDto,
    user: AuthenticatedUser,
  ) {
    const cycle: BillingCycleWithDetails =
      await this.billingCycleService.getCycle(cycleId);

    if (cycle.status === BillingCycleStatus.PAID) {
      throw new BadRequestException('This invoice is already fully paid');
    }

    const remainingDue = cycle.totalDue - cycle.totalPaid;
    if (dto.amount > remainingDue) {
      throw new BadRequestException(
        `Payment amount (${dto.amount} RWF) exceeds remaining due (${remainingDue} RWF)`,
      );
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const payment = await this.prisma.billingPayment.create({
      data: {
        billingCycleId: cycleId,
        fleetId: cycle.fleetId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        notes: dto.notes,
        recordedById: user.id,
        paidAt,
      },
    });

    const newTotalPaid = cycle.totalPaid + dto.amount;
    const newStatus =
      newTotalPaid >= cycle.totalDue
        ? BillingCycleStatus.PAID
        : BillingCycleStatus.PARTIAL;

    await this.prisma.billingCycle.update({
      where: { id: cycleId },
      data: {
        totalPaid: newTotalPaid,
        status: newStatus,
        paidAt: newStatus === BillingCycleStatus.PAID ? paidAt : null,
      },
    });

    if (newStatus === BillingCycleStatus.PAID) {
      // Cancel any pending MoMo transactions for this cycle to prevent race condition double deductions
      await this.prisma.momoTransaction.updateMany({
        where: {
          billingCycleId: cycleId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          failureReason: 'Invoice settled via direct manual payment',
        },
      });

      const overdueCycles = await this.prisma.billingCycle.count({
        where: {
          fleetId: cycle.fleetId,
          status: {
            in: [
              BillingCycleStatus.PENDING,
              BillingCycleStatus.OVERDUE,
              BillingCycleStatus.PARTIAL,
            ],
          },
          dueDate: { lt: new Date() },
        },
      });

      if (overdueCycles === 0) {
        await this.prisma.fleet.update({
          where: { id: cycle.fleetId },
          data: { subscriptionStatus: FleetSubscriptionStatus.ACTIVE },
        });
      }

      try {
        await this.billingCycleService.generateCycleForFleet(
          cycle.fleetId,
          true,
        );
      } catch {
        // Next weekly period has not arrived yet or is already active
      }
    }

    await this.auditService.createAuditLog({
      fleetId: cycle.fleetId,
      actorUserId: user.id,
      actionType: 'BILLING_PAYMENT_RECORDED',
      targetType: 'BillingPayment',
      targetId: payment.id,
      metaJson: { payment, newStatus, newTotalPaid },
    });

    try {
      const fleetUsers = await this.prisma.user.findMany({
        where: {
          fleetId: cycle.fleetId,
          role: { in: ['OWNER', 'ADMIN'] },
          email: { not: null },
        },
      });

      for (const fUser of fleetUsers) {
        if (fUser.email) {
          await this.mailService.sendNotificationEmail(
            fUser.email,
            `Invoice Paid Confirmation - ${cycle.fleet.name}`,
            'Payment Received',
            `Thank you for your payment of ${dto.amount.toLocaleString()} RWF for invoice #${cycle.cycleNumber}. Your invoice is now ${newStatus.toLowerCase()}.`,
          );
        }
      }
    } catch {
      // Don't fail the payment transaction if mail sending fails
    }

    return payment;
  }
}
