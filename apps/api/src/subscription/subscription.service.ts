import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FleetPlan, FleetSubscriptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

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
    if (plan !== FleetPlan.ENTERPRISE && plan !== FleetPlan.INSURANCE) {
      throw new BadRequestException(
        'Only Enterprise and Insurance tier requests are supported right now',
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

  async getFleetSettings(user: AuthenticatedUser) {
    const fleet = await this.prismaService.fleet.findUnique({
      where: { id: user.fleetId },
      select: {
        id: true,
        name: true,
        type: true,
        plan: true,
        momoPhoneNumber: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
        monthlyRatePerBike: true,
        emotoPaygRatePerActiveDay: true,
        subscriptionStatus: true,
      },
    });

    if (!fleet) {
      throw new BadRequestException('Fleet not found');
    }

    return fleet;
  }

  async updateFleetSettings(
    user: AuthenticatedUser,
    dto: {
      momoPhoneNumber?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
    },
  ) {
    const updateData: {
      momoPhoneNumber?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
    } = {};

    if (dto.momoPhoneNumber !== undefined) {
      updateData.momoPhoneNumber = dto.momoPhoneNumber.trim();
    }
    if (dto.bankName !== undefined) {
      updateData.bankName = dto.bankName.trim();
    }
    if (dto.bankAccountNumber !== undefined) {
      updateData.bankAccountNumber = dto.bankAccountNumber.trim();
    }
    if (dto.bankAccountName !== undefined) {
      updateData.bankAccountName = dto.bankAccountName.trim();
    }

    return await this.prismaService.fleet.update({
      where: { id: user.fleetId },
      data: updateData,
      select: {
        id: true,
        name: true,
        momoPhoneNumber: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
        plan: true,
        monthlyRatePerBike: true,
      },
    });
  }
}
