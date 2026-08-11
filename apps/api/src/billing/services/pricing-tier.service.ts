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

  static getRateForFleetType(): number {
    return 10000; // Uniform PAYG rate across all fleet types (350 RWF/day per bike)
  }

  async seedDefaultTiers(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'PAYG';`);
      await this.prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'INSURANCE';`);
      await this.prisma.$executeRawUnsafe(`ALTER TYPE "FleetPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';`);
    } catch {
      // Ignore if non-superuser or already present
    }

    const tiers = [
      {
        name: 'Pay-As-You-Go',
        planCode: FleetPlan.PAYG,
        monthlyRatePerBike: 0,
        setupFeePerBike: 0,
        description:
          '350 RWF / day per active bike. Pay only for bikes active on the road each day with full telemetry, remote lock/unlock, rider scoring, and financial management.',
        sortOrder: 0,
      },
      {
        name: 'Insurance & Compliance',
        planCode: FleetPlan.INSURANCE,
        monthlyRatePerBike: 0,
        setupFeePerBike: 0,
        description:
          'Dedicated Insurer Portal, FNOL crash & theft evidence packs, automated risk analytics, and underwriter compliance monitoring.',
        sortOrder: 1,
      },
      {
        name: 'Enterprise Operations',
        planCode: FleetPlan.ENTERPRISE,
        monthlyRatePerBike: 0,
        setupFeePerBike: 0,
        description:
          'Tailored multi-fleet HQ command center, custom IoT integrations, dedicated account manager, and SLA guarantees.',
        sortOrder: 2,
      },
    ];

    for (const tier of tiers) {
      try {
        await this.prisma.pricingTier.upsert({
          where: { planCode: tier.planCode },
          update: {
            name: tier.name,
            description: tier.description,
            monthlyRatePerBike: tier.monthlyRatePerBike,
            sortOrder: tier.sortOrder,
          },
          create: tier,
        });
      } catch (error) {
        console.warn(`[PricingTierService] Could not seed tier ${tier.planCode}:`, error);
      }
    }

    // Delete legacy pricing tiers if present
    try {
      await this.prisma.pricingTier.deleteMany({
        where: {
          planCode: {
            in: ['DEMO' as any, 'PREMIUM' as any],
          },
        },
      });
    } catch {
      // Ignore if enums removed from DB
    }
  }
}
