import { BadRequestException, Injectable } from '@nestjs/common';
import { FleetPlan, FleetSubscriptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prismaService: PrismaService) {}

  async updateCurrentFleetPlan(
    user: AuthenticatedUser,
    plan: FleetPlan,
  ): Promise<{
    fleetPlan: FleetPlan;
    subscriptionStatus: FleetSubscriptionStatus;
    upgradeRequested: boolean;
  }> {
    if (plan !== FleetPlan.PREMIUM) {
      throw new BadRequestException(
        'Only Operations Plus upgrades are supported right now',
      );
    }

    const fleet = await this.prismaService.fleet.update({
      where: { id: user.fleetId },
      data: {
        upgradeRequested: true,
        upgradeRequestedAt: new Date(),
      },
      select: {
        plan: true,
        subscriptionStatus: true,
        upgradeRequested: true,
      },
    });

    return {
      fleetPlan: fleet.plan,
      subscriptionStatus: fleet.subscriptionStatus,
      upgradeRequested: fleet.upgradeRequested,
    };
  }
}
