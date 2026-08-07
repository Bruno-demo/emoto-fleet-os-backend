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

  async getRateForFleetPlan(planCode: FleetPlan): Promise<number> {
    const tier = await this.prisma.pricingTier.findUnique({
      where: { planCode },
    });
    return tier?.monthlyRatePerBike ?? 10000;
  }

  static getRateForFleetType(fleetType?: string): number {
    if (fleetType === 'DELIVERY') return 15000;
    if (fleetType === 'INSURER') return 0;
    return 10000; // COOP and INDIVIDUAL rate
  }

  async seedDefaultTiers(): Promise<void> {
    const defaults = [
      {
        name: 'Cooperative & Individual Fleet',
        planCode: FleetPlan.DEMO,
        monthlyRatePerBike: 10000,
        setupFeePerBike: 0,
        description:
          '10,000 RWF / month per bike. Full access to live map, remote control, rider scoring, financial management & reports. No device setup fee (hardware remains eMoto company property).',
        sortOrder: 0,
      },
      {
        name: 'Delivery Fleet',
        planCode: FleetPlan.PREMIUM,
        monthlyRatePerBike: 15000,
        setupFeePerBike: 0,
        description:
          '15,000 RWF / month per bike. High-volume delivery fleet tracking, incident workflows, priority support & analytics. No device setup fee (hardware remains eMoto company property).',
        sortOrder: 1,
      },
      {
        name: 'Insurance Partner',
        planCode: FleetPlan.INSURANCE,
        monthlyRatePerBike: 0,
        setupFeePerBike: 0,
        description:
          'Telemetry access, crash evidence packs, claims verification & partner API.',
        sortOrder: 2,
      },
    ];

    for (const tier of defaults) {
      await this.prisma.pricingTier.upsert({
        where: { planCode: tier.planCode },
        update: {}, // DO NOT OVERWRITE DATABASE CUSTOMIZATIONS ON SERVER RESTART
        create: tier,
      });
    }
  }
}
