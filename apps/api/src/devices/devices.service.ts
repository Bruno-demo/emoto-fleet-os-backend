import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DeviceStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignBikeDto } from './dto/assign-bike.dto';
import { CreateDeviceDto } from './dto/create-device.dto';

interface DeviceWithBike {
  id: string;
  fleetId: string;
  imei: string | null;
  deviceUid: string;
  bikeId: string | null;
  lastSeenAt: Date | null;
  fwVersion: string | null;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
  bike: {
    id: string;
    label: string;
  } | null;
}

export interface PublicDevice {
  id: string;
  fleetId: string;
  imei: string | null;
  deviceUid: string;
  bikeId: string | null;
  lastSeenAt: Date | null;
  fwVersion: string | null;
  status: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
  bike: {
    id: string;
    label: string;
  } | null;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly prismaService: PrismaService) {}

  // Returns all devices in the caller fleet without exposing secret hashes.
  async listDevicesForUser(user: AuthenticatedUser): Promise<PublicDevice[]> {
    const devices = await this.prismaService.device.findMany({
      where: { fleetId: user.fleetId },
      include: {
        bike: {
          select: {
            id: true,
            label: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return devices.map((device) => this.toPublicDevice(device));
  }

  // Loads a single device for caller fleet while omitting secret hash material.
  async getDeviceForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PublicDevice> {
    const device = await this.loadDeviceOrThrow(id);
    this.assertFleetAccess(device.fleetId, user);
    return this.toPublicDevice(device);
  }

  // Creates a device and returns a one-time plaintext secret while storing only hash.
  async createDeviceForUser(
    dto: CreateDeviceDto,
    user: AuthenticatedUser,
  ): Promise<{ device: PublicDevice; deviceSecret: string }> {
    const deviceSecret = this.generateSecret();
    const secretHash = this.hashSecret(deviceSecret);

    try {
      const device = await this.prismaService.device.create({
        data: {
          fleetId: user.fleetId,
          deviceUid: dto.deviceUid,
          imei: dto.imei,
          fwVersion: dto.fwVersion,
          secretHash,
          status: 'ACTIVE',
        },
        include: {
          bike: {
            select: {
              id: true,
              label: true,
            },
          },
        },
      });

      this.logger.log(
        `Created device ${this.truncateDeviceUid(device.deviceUid)}`,
      );

      return {
        device: this.toPublicDevice(device),
        deviceSecret,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('deviceUid or imei already exists');
      }

      throw error;
    }
  }

  // Assigns a fleet-owned device to a fleet-owned bike.
  async assignBikeForUser(
    id: string,
    dto: AssignBikeDto,
    user: AuthenticatedUser,
  ): Promise<PublicDevice> {
    const device = await this.loadDeviceOrThrow(id);
    this.assertFleetAccess(device.fleetId, user);

    const bike = await this.prismaService.bike.findUnique({
      where: { id: dto.bikeId },
      select: {
        id: true,
        fleetId: true,
      },
    });

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    this.assertFleetAccess(bike.fleetId, user);

    const updatedDevice = await this.prismaService.device.update({
      where: { id: device.id },
      data: {
        bikeId: bike.id,
      },
      include: {
        bike: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    });

    this.logger.log(
      `Assigned bike to device ${this.truncateDeviceUid(updatedDevice.deviceUid)}`,
    );

    return this.toPublicDevice(updatedDevice);
  }

  // Rotates device secret and returns the new plaintext value only in this response.
  async rotateSecretForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ deviceId: string; deviceUid: string; deviceSecret: string }> {
    const device = await this.prismaService.device.findUnique({
      where: { id },
      select: {
        id: true,
        fleetId: true,
        deviceUid: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    this.assertFleetAccess(device.fleetId, user);

    const deviceSecret = this.generateSecret();
    const secretHash = this.hashSecret(deviceSecret);

    await this.prismaService.device.update({
      where: { id: device.id },
      data: {
        secretHash,
      },
    });

    this.logger.log(
      `Rotated secret for device ${this.truncateDeviceUid(device.deviceUid)}`,
    );

    return {
      deviceId: device.id,
      deviceUid: device.deviceUid,
      deviceSecret,
    };
  }

  // Loads a device with bike projection for response serialization.
  private async loadDeviceOrThrow(id: string): Promise<DeviceWithBike> {
    const device = await this.prismaService.device.findUnique({
      where: { id },
      include: {
        bike: {
          select: {
            id: true,
            label: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return device;
  }

  // Validates caller fleet ownership against a target fleet id.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Serializes device output while excluding secret hash fields.
  private toPublicDevice(device: DeviceWithBike): PublicDevice {
    return {
      id: device.id,
      fleetId: device.fleetId,
      imei: device.imei,
      deviceUid: device.deviceUid,
      bikeId: device.bikeId,
      lastSeenAt: device.lastSeenAt,
      fwVersion: device.fwVersion,
      status: device.status,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      bike: device.bike,
    };
  }

  // Generates a one-time secret string returned only during provisioning operations.
  private generateSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  // Hashes plaintext secrets prior to database persistence.
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  // Produces a truncated device identifier safe for operational logs.
  private truncateDeviceUid(deviceUid: string): string {
    if (deviceUid.length <= 8) {
      return `${deviceUid.slice(0, 2)}***${deviceUid.slice(-2)}`;
    }

    return `${deviceUid.slice(0, 4)}...${deviceUid.slice(-4)}`;
  }
}
