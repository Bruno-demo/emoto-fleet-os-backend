import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingCycleStatus, FleetSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { MailService } from '../../mail/mail.service';
import { BillingCycleService } from './billing-cycle.service';
import { BillingConfigService } from './billing-config.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly billingCycleService: BillingCycleService,
    private readonly billingConfigService: BillingConfigService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async generateBillingCycles() {
    this.logger.log('Starting daily billing cycle generation cron job...');
    const activeFleets = await this.prisma.fleet.findMany({
      where: {
        subscriptionStatus: FleetSubscriptionStatus.ACTIVE,
      },
    });

    for (const fleet of activeFleets) {
      try {
        const lastCycle = await this.prisma.billingCycle.findFirst({
          where: { fleetId: fleet.id },
          orderBy: { cycleNumber: 'desc' },
        });

        const now = new Date();
        let shouldGenerate = false;

        if (!lastCycle) {
          shouldGenerate = true;
        } else {
          const periodEnd = new Date(lastCycle.periodEnd);
          if (now >= periodEnd) {
            shouldGenerate = true;
          }
        }

        if (shouldGenerate) {
          this.logger.log(
            `Generating billing cycle for fleet ${fleet.name} (${fleet.id})`,
          );
          await this.billingCycleService.generateCycleForFleet(fleet.id);
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate billing cycle for fleet ${fleet.id}:`,
          error,
        );
      }
    }
    this.logger.log('Finished daily billing cycle generation cron job.');
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async autoMarkOverdue() {
    this.logger.log('Starting auto-mark overdue cron job...');
    const config = await this.billingConfigService.getConfig();
    const gracePeriodDays = config.gracePeriodDays;
    const now = new Date();

    // 1. Heal legacy billing cycles where dueDate was incorrectly set to periodStart instead of periodEnd
    const cyclesToHeal = await this.prisma.billingCycle.findMany({
      where: {
        status: {
          in: [
            BillingCycleStatus.PENDING,
            BillingCycleStatus.PARTIAL,
            BillingCycleStatus.OVERDUE,
          ],
        },
      },
    });

    for (const c of cyclesToHeal) {
      if (c.dueDate.getTime() < c.periodEnd.getTime()) {
        await this.prisma.billingCycle.update({
          where: { id: c.id },
          data: { dueDate: c.periodEnd },
        });
      }
    }

    // 2. Heal fleets that were prematurely set to PAST_DUE before their invoice periodEnd + grace period passed
    const pastDueFleets = await this.prisma.fleet.findMany({
      where: { subscriptionStatus: FleetSubscriptionStatus.PAST_DUE },
      include: {
        billingCycles: {
          where: {
            status: {
              in: [
                BillingCycleStatus.PENDING,
                BillingCycleStatus.PARTIAL,
                BillingCycleStatus.OVERDUE,
              ],
            },
          },
        },
      },
    });

    for (const fleet of pastDueFleets) {
      let genuinelyOverdueCount = 0;
      for (const cycle of fleet.billingCycles) {
        const cycleGraceEnd = new Date(cycle.periodEnd);
        cycleGraceEnd.setDate(cycleGraceEnd.getDate() + gracePeriodDays);
        if (now >= cycleGraceEnd) {
          genuinelyOverdueCount++;
        } else if (cycle.status === BillingCycleStatus.OVERDUE) {
          // Revert premature OVERDUE status back to PENDING if active month is still ongoing
          await this.prisma.billingCycle.update({
            where: { id: cycle.id },
            data: { status: BillingCycleStatus.PENDING },
          });
        }
      }

      if (genuinelyOverdueCount === 0) {
        await this.prisma.fleet.update({
          where: { id: fleet.id },
          data: { subscriptionStatus: FleetSubscriptionStatus.ACTIVE },
        });
      }
    }

    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - gracePeriodDays);

    const pendingCycles = await this.prisma.billingCycle.findMany({
      where: {
        status: {
          in: [BillingCycleStatus.PENDING, BillingCycleStatus.PARTIAL],
        },
        dueDate: { lt: limitDate },
      },
      include: {
        fleet: true,
      },
    });

    for (const cycle of pendingCycles) {
      try {
        this.logger.log(
          `Marking cycle ${cycle.id} for fleet ${cycle.fleet.name} as OVERDUE`,
        );
        await this.prisma.$transaction(async (tx) => {
          await tx.billingCycle.update({
            where: { id: cycle.id },
            data: { status: BillingCycleStatus.OVERDUE },
          });

          await tx.fleet.update({
            where: { id: cycle.fleetId },
            data: { subscriptionStatus: FleetSubscriptionStatus.PAST_DUE },
          });
        });

        await this.auditService.createAuditLog({
          fleetId: cycle.fleetId,
          actionType: 'BILLING_OVERDUE_MARKED',
          targetType: 'BillingCycle',
          targetId: cycle.id,
          metaJson: { cycleId: cycle.id, fleetId: cycle.fleetId },
        });
      } catch (error) {
        this.logger.error(
          `Failed to mark cycle ${cycle.id} as overdue:`,
          error,
        );
      }
    }
    this.logger.log('Finished auto-mark overdue cron job.');
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendUpcomingReminders() {
    this.logger.log('Starting upcoming reminders cron job...');
    const config = await this.billingConfigService.getConfig();
    const reminderDays = config.upcomingReminderDays;

    for (const days of reminderDays) {
      const targetDateStart = new Date();
      targetDateStart.setDate(targetDateStart.getDate() + days);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDateStart);
      targetDateEnd.setHours(23, 59, 59, 999);

      const cycles = await this.prisma.billingCycle.findMany({
        where: {
          status: BillingCycleStatus.PENDING,
          dueDate: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
        include: {
          fleet: true,
        },
      });

      for (const cycle of cycles) {
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
                `Upcoming Subscription Renewal - ${cycle.fleet.name}`,
                'Upcoming Subscription Renewal',
                `Your Fleet OS subscription renewal invoice of ${cycle.totalDue.toLocaleString()} RWF is due on ${new Date(cycle.dueDate).toLocaleDateString()}. Please ensure payment setup is completed.`,
              );
            }
          }

          await this.prisma.billingCycle.update({
            where: { id: cycle.id },
            data: {
              remindersSent: { increment: 1 },
              lastReminderAt: new Date(),
            },
          });

          await this.auditService.createAuditLog({
            fleetId: cycle.fleetId,
            actionType: 'BILLING_REMINDER_SENT',
            targetType: 'BillingCycle',
            targetId: cycle.id,
            metaJson: {
              cycleId: cycle.id,
              reminderType: 'upcoming',
              daysAhead: days,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send upcoming reminder for cycle ${cycle.id}:`,
            error,
          );
        }
      }
    }
    this.logger.log('Finished upcoming reminders cron job.');
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueReminders() {
    this.logger.log('Starting overdue reminders cron job...');
    const config = await this.billingConfigService.getConfig();
    const reminderDays = config.overdueReminderDays;

    for (const days of reminderDays) {
      const targetDateStart = new Date();
      targetDateStart.setDate(targetDateStart.getDate() - days);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDateStart);
      targetDateEnd.setHours(23, 59, 59, 999);

      const cycles = await this.prisma.billingCycle.findMany({
        where: {
          status: BillingCycleStatus.OVERDUE,
          dueDate: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
        include: {
          fleet: true,
        },
      });

      for (const cycle of cycles) {
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
                `URGENT: Subscription Invoice Overdue - ${cycle.fleet.name}`,
                'Subscription Invoice Overdue',
                `Your Fleet OS subscription invoice #${cycle.cycleNumber} of ${cycle.totalDue.toLocaleString()} RWF is now ${days} days overdue. Access to premium features may be suspended. Please complete payment setup immediately.`,
              );
            }
          }

          await this.prisma.billingCycle.update({
            where: { id: cycle.id },
            data: {
              remindersSent: { increment: 1 },
              lastReminderAt: new Date(),
            },
          });

          await this.auditService.createAuditLog({
            fleetId: cycle.fleetId,
            actionType: 'BILLING_REMINDER_SENT',
            targetType: 'BillingCycle',
            targetId: cycle.id,
            metaJson: {
              cycleId: cycle.id,
              reminderType: 'overdue',
              daysLate: days,
            },
          });
        } catch (error) {
          this.logger.error(
            `Failed to send overdue reminder for cycle ${cycle.id}:`,
            error,
          );
        }
      }
    }
    this.logger.log('Finished overdue reminders cron job.');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireTrials() {
    this.logger.log('Starting trial expiration cron job...');
    const now = new Date();

    const trialFleets = await this.prisma.fleet.findMany({
      where: {
        subscriptionStatus: FleetSubscriptionStatus.ACTIVE,
        trialEndsAt: { lt: now },
      },
    });

    for (const fleet of trialFleets) {
      try {
        this.logger.log(
          `Free trial ended for fleet ${fleet.name} (${fleet.id})`,
        );

        await this.prisma.fleet.update({
          where: { id: fleet.id },
          data: {
            trialEndsAt: null,
          },
        });

        await this.billingCycleService.generateCycleForFleet(fleet.id);

        await this.auditService.createAuditLog({
          fleetId: fleet.id,
          actionType: 'TRIAL_EXPIRED',
          targetType: 'Fleet',
          targetId: fleet.id,
          metaJson: { fleetId: fleet.id },
        });

        const fleetUsers = await this.prisma.user.findMany({
          where: {
            fleetId: fleet.id,
            role: { in: ['OWNER', 'ADMIN'] },
            email: { not: null },
          },
        });

        for (const fUser of fleetUsers) {
          if (fUser.email) {
            await this.mailService.sendNotificationEmail(
              fUser.email,
              `Your Free Trial Has Ended - ${fleet.name}`,
              'Free Trial Ended',
              `Your free trial of E-Moto Fleet OS has ended. A new billing invoice has been generated. Please subscribe to continue using premium features.`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to expire trial for fleet ${fleet.id}:`,
          error,
        );
      }
    }
    this.logger.log('Finished trial expiration cron job.');
  }
}
