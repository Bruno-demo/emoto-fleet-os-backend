import { Injectable, OnModuleInit } from '@nestjs/common';
import { BillingConfig } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { UpdateBillingConfigDto } from '../dto/update-billing-config.dto';

@Injectable()
export class BillingConfigService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultConfig();
  }

  async getConfig(): Promise<BillingConfig> {
    const config = await this.prisma.billingConfig.findFirst();
    if (!config) {
      return this.seedDefaultConfig();
    }
    return config;
  }

  async updateConfig(
    dto: UpdateBillingConfigDto,
    user: AuthenticatedUser,
  ): Promise<BillingConfig> {
    const current = await this.getConfig();

    const updated = await this.prisma.billingConfig.update({
      where: { id: current.id },
      data: dto,
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'BILLING_CONFIG_UPDATED',
      targetType: 'BillingConfig',
      targetId: updated.id,
      metaJson: { before: current, after: updated },
    });

    return updated;
  }

  async seedDefaultConfig(): Promise<BillingConfig> {
    const count = await this.prisma.billingConfig.count();
    if (count > 0) {
      const config = await this.prisma.billingConfig.findFirst();
      return config!;
    }

    return this.prisma.billingConfig.create({
      data: {
        billingCycleDays: 30,
        gracePeriodDays: 7,
        trialEnabled: true,
        trialDurationDays: 14,
        upcomingReminderDays: [7, 3, 1],
        overdueReminderDays: [1, 3, 7],
        currencyCode: 'RWF',
      },
    });
  }
}
