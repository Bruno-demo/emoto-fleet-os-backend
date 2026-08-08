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
    momoPhoneNumber?: string,
  ): Promise<{
    fleetPlan: FleetPlan;
    subscriptionStatus: FleetSubscriptionStatus;
    upgradeRequested: boolean;
  }> {
    if (plan !== FleetPlan.PREMIUM) {
      throw new BadRequestException(
        'Only Delivery Fleet upgrades are supported right now',
      );
    }

    const updateData: any = {
      upgradeRequested: true,
      upgradeRequestedAt: new Date(),
    };

    if (momoPhoneNumber && momoPhoneNumber.trim()) {
      updateData.momoPhoneNumber = momoPhoneNumber.trim();
    }

    const fleet = await this.prismaService.fleet.update({
      where: { id: user.fleetId },
      data: updateData,
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

  async updateBillingRate(
    user: AuthenticatedUser,
    monthlyRatePerBike: number,
  ): Promise<{ monthlyRatePerBike: number }> {
    if (typeof monthlyRatePerBike !== 'number' || monthlyRatePerBike < 0) {
      throw new BadRequestException('Invalid monthly rate per bike');
    }

    const fleet = await this.prismaService.fleet.update({
      where: { id: user.fleetId },
      data: {
        monthlyRatePerBike: Math.round(monthlyRatePerBike),
      },
      select: {
        monthlyRatePerBike: true,
      },
    });

    return {
      monthlyRatePerBike: fleet.monthlyRatePerBike,
    };
  }
}
