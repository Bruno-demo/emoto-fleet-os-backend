import { Injectable, OnModuleInit } from '@nestjs/common';
import { FleetPlan, PricingTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { UpdatePricingTierDto } from '../dto/update-pricing-tier.dto';

@Injectable()
export class PricingTierService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultTiers();
  }

  async getAllTiers(): Promise<PricingTier[]> {
    return this.prisma.pricingTier.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getTierByPlanCode(planCode: FleetPlan): Promise<PricingTier | null> {
    return this.prisma.pricingTier.findUnique({
      where: { planCode },
    });
  }

  async updateTier(
    planCode: FleetPlan,
    dto: UpdatePricingTierDto,
    user: AuthenticatedUser,
  ): Promise<PricingTier> {
    const current = await this.prisma.pricingTier.findUnique({
      where: { planCode },
    });

    if (!current) {
      throw new Error(`Pricing tier for plan code ${planCode} not found`);
    }

    const updated = await this.prisma.pricingTier.update({
      where: { planCode },
      data: dto,
    });

    if (typeof dto.monthlyRatePerBike === 'number') {
      await this.prisma.fleet.updateMany({
        where: { plan: planCode },
        data: { monthlyRatePerBike: dto.monthlyRatePerBike },
      });
    }

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'PRICING_TIER_UPDATED',
      targetType: 'PricingTier',
      targetId: updated.id,
      metaJson: { planCode, before: current, after: updated },
    });

    return updated;
  }

  async seedDefaultTiers(): Promise<void> {
    const count = await this.prisma.pricingTier.count();
    if (count > 0) return;

    const defaults = [
      {
        name: 'Safety Core',
        planCode: FleetPlan.DEMO,
        monthlyRatePerBike: 7000,
        setupFeePerBike: 40000,
        description:
          'Live map, remote lock/unlock, rider scoring, and support.',
        sortOrder: 0,
      },
      {
        name: 'Operations Plus',
        planCode: FleetPlan.PREMIUM,
        monthlyRatePerBike: 15000,
        setupFeePerBike: 40000,
        description:
          'Incident workflows, financial management, reports, and priority support.',
        sortOrder: 1,
      },
      {
        name: 'Insurance Partner',
        planCode: FleetPlan.INSURANCE,
        monthlyRatePerBike: 0,
        setupFeePerBike: 0,
        description:
          'Telemetry access, weekly reports, crash evidence, and API keys.',
        sortOrder: 2,
      },
    ];

    for (const tier of defaults) {
      await this.prisma.pricingTier.create({ data: tier });
    }
  }
}
