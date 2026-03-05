import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Device } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prismaService: PrismaService) {}

  // Loads a device by id and blocks cross-fleet access based on its linked bike.
  async getDeviceForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<Omit<Device, 'secretHash'>> {
    const device = await this.prismaService.device.findUnique({
      where: { id },
      include: {
        bike: {
          select: {
            fleetId: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (!device.bike || device.bike.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }

    return {
      id: device.id,
      imei: device.imei,
      deviceUid: device.deviceUid,
      bikeId: device.bikeId,
      lastSeenAt: device.lastSeenAt,
      fwVersion: device.fwVersion,
      status: device.status,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
