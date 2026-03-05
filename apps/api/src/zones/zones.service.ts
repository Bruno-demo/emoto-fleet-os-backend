import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ZoneType } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { polygonGeoJsonSchema } from './geojson.schema';

interface ZoneEntity {
  id: string;
  fleetId: string;
  name: string;
  type: ZoneType;
  geojsonPolygon: Prisma.JsonValue;
  speedLimitKph: Prisma.Decimal | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FleetZone {
  id: string;
  fleetId: string;
  name: string;
  type: ZoneType;
  geojsonPolygon: Prisma.JsonValue;
  speedLimitKph: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ZonesService {
  constructor(private readonly prismaService: PrismaService) {}

  // Lists geofence zones for the caller fleet.
  async listZonesForUser(user: AuthenticatedUser): Promise<FleetZone[]> {
    const zones = await this.prismaService.geofenceZone.findMany({
      where: { fleetId: user.fleetId },
      orderBy: { createdAt: 'desc' },
    });

    return zones.map((zone) => this.toFleetZone(zone));
  }

  // Creates a new geofence zone under the caller fleet.
  async createZoneForUser(
    user: AuthenticatedUser,
    dto: CreateZoneDto,
  ): Promise<FleetZone> {
    const geojsonPolygon = this.validatePolygon(dto.geojsonPolygon);
    this.validateSpeedLimit(dto.type, dto.speedLimitKph);

    const zone = await this.prismaService.geofenceZone.create({
      data: {
        fleetId: user.fleetId,
        name: dto.name,
        type: dto.type,
        geojsonPolygon,
        speedLimitKph: dto.speedLimitKph,
        active: dto.active ?? true,
      },
    });

    return this.toFleetZone(zone);
  }

  // Returns a zone by id after enforcing fleet isolation.
  async getZoneForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<FleetZone> {
    const zone = await this.loadZoneOrThrow(id);
    this.assertFleetAccess(zone.fleetId, user);
    return this.toFleetZone(zone);
  }

  // Updates a fleet zone and validates zone-type specific constraints.
  async updateZoneForUser(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateZoneDto,
  ): Promise<FleetZone> {
    const existingZone = await this.loadZoneOrThrow(id);
    this.assertFleetAccess(existingZone.fleetId, user);

    const effectiveType = dto.type ?? existingZone.type;
    const effectiveSpeedLimit =
      dto.speedLimitKph ?? existingZone.speedLimitKph?.toNumber();
    this.validateSpeedLimit(effectiveType, effectiveSpeedLimit);

    const geojsonPolygon = dto.geojsonPolygon
      ? this.validatePolygon(dto.geojsonPolygon)
      : undefined;

    const updatedZone = await this.prismaService.geofenceZone.update({
      where: { id: existingZone.id },
      data: {
        name: dto.name,
        type: dto.type,
        geojsonPolygon,
        speedLimitKph: dto.speedLimitKph,
        active: dto.active,
      },
    });

    return this.toFleetZone(updatedZone);
  }

  // Deletes a fleet zone record.
  async deleteZoneForUser(id: string, user: AuthenticatedUser): Promise<void> {
    const zone = await this.loadZoneOrThrow(id);
    this.assertFleetAccess(zone.fleetId, user);
    await this.prismaService.geofenceZone.delete({ where: { id: zone.id } });
  }

  // Loads zone entity by id or throws 404.
  private async loadZoneOrThrow(id: string): Promise<ZoneEntity> {
    const zone = await this.prismaService.geofenceZone.findUnique({
      where: { id },
    });

    if (!zone) {
      throw new NotFoundException('Zone not found');
    }

    return zone;
  }

  // Enforces fleet isolation for zone operations.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Validates GeoJSON polygon structure with Zod parser.
  private validatePolygon(input: unknown): Prisma.InputJsonValue {
    const parsed = polygonGeoJsonSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Invalid polygon GeoJSON');
    }

    return parsed.data as Prisma.InputJsonValue;
  }

  // Enforces that SLOW zones include a positive speed limit.
  private validateSpeedLimit(
    type: ZoneType,
    speedLimitKph?: number | null,
  ): void {
    if (type === ZoneType.SLOW && (!speedLimitKph || speedLimitKph <= 0)) {
      throw new BadRequestException(
        'SLOW zones require a positive speedLimitKph',
      );
    }
  }

  // Maps Prisma zone entity into API-safe response format.
  private toFleetZone(zone: ZoneEntity): FleetZone {
    return {
      id: zone.id,
      fleetId: zone.fleetId,
      name: zone.name,
      type: zone.type,
      geojsonPolygon: zone.geojsonPolygon,
      speedLimitKph: zone.speedLimitKph ? zone.speedLimitKph.toNumber() : null,
      active: zone.active,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };
  }
}
