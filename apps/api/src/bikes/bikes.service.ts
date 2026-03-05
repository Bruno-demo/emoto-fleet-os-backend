import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Bike } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BikesService {
  constructor(private readonly prismaService: PrismaService) {}

  // Loads a bike by id and enforces fleet isolation on access.
  async getBikeForUser(id: string, user: AuthenticatedUser): Promise<Bike> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id },
    });

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    if (bike.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }

    return bike;
  }
}
