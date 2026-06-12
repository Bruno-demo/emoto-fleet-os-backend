import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Trip } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ListTripsDto } from './dto/list-trips.dto';
import { normalizeTripEventCounts } from './trip-scoring.util';
import { FleetTrip } from './trips.types';

type TripWithRelations = Prisma.TripGetPayload<{
  include: {
    bike: {
      select: {
        label: true;
      };
    };
    rider: {
      select: {
        riderProfile: {
          select: {
            fullName: true;
          };
        };
        email: true;
        phone: true;
      };
    };
  };
}>;

@Injectable()
export class TripsService {
  constructor(private readonly prismaService: PrismaService) {}

  // Lists all trips in the caller's fleet with optional filtering.
  async listAllTripsForUser(
    user: AuthenticatedUser,
    query: ListTripsDto,
  ): Promise<PaginatedResponse<FleetTrip>> {
    const where: Prisma.TripWhereInput = {};

    if (user.role === 'INSURER') {
      where.bike = { insurerName: user.insurerName };
    } else {
      where.fleetId = user.fleetId;
    }

    if (query.from || query.to) {
      where.startTs = {};
      if (query.from) {
        where.startTs.gte = new Date(query.from);
      }
      if (query.to) {
        where.startTs.lte = new Date(query.to);
      }
    }

    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = {};
      if (query.minScore !== undefined) {
        where.score.gte = query.minScore;
      }
      if (query.maxScore !== undefined) {
        where.score.lte = query.maxScore;
      }
    }

    if (
      query.minDistanceKm !== undefined ||
      query.maxDistanceKm !== undefined
    ) {
      where.distanceKm = {};
      if (query.minDistanceKm !== undefined) {
        where.distanceKm.gte = query.minDistanceKm;
      }
      if (query.maxDistanceKm !== undefined) {
        where.distanceKm.lte = query.maxDistanceKm;
      }
    }

    const pagination = getPaginationParams(query);

    const [trips, total] = await Promise.all([
      this.prismaService.trip.findMany({
        where,
        include: {
          bike: {
            select: {
              label: true,
            },
          },
          rider: {
            select: {
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { startTs: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.trip.count({ where }),
    ]);

    const data = await Promise.all(trips.map((trip) => this.toFleetTrip(trip)));
    return createPaginatedResponse(
      data,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Lists trips for one bike in caller fleet with optional date filtering.
  async listBikeTripsForUser(
    user: AuthenticatedUser,
    bikeId: string,
    query: ListTripsDto,
  ): Promise<PaginatedResponse<FleetTrip>> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
      select: {
        id: true,
        fleetId: true,
        insurerName: true,
      },
    });

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    if (user.role === 'INSURER') {
      if (bike.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this bike is denied');
      }
    } else {
      this.assertFleetAccess(bike.fleetId, user);
    }

    const where: Prisma.TripWhereInput = {
      bikeId: bike.id,
    };

    if (user.role !== 'INSURER') {
      where.fleetId = user.fleetId;
    }

    if (query.from || query.to) {
      where.startTs = {};
      if (query.from) {
        where.startTs.gte = new Date(query.from);
      }
      if (query.to) {
        where.startTs.lte = new Date(query.to);
      }
    }

    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = {};
      if (query.minScore !== undefined) {
        where.score.gte = query.minScore;
      }
      if (query.maxScore !== undefined) {
        where.score.lte = query.maxScore;
      }
    }

    if (
      query.minDistanceKm !== undefined ||
      query.maxDistanceKm !== undefined
    ) {
      where.distanceKm = {};
      if (query.minDistanceKm !== undefined) {
        where.distanceKm.gte = query.minDistanceKm;
      }
      if (query.maxDistanceKm !== undefined) {
        where.distanceKm.lte = query.maxDistanceKm;
      }
    }

    const pagination = getPaginationParams(query);

    const [trips, total] = await Promise.all([
      this.prismaService.trip.findMany({
        where,
        include: {
          bike: {
            select: {
              label: true,
            },
          },
          rider: {
            select: {
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { startTs: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.trip.count({ where }),
    ]);

    const data = await Promise.all(trips.map((trip) => this.toFleetTrip(trip)));
    return createPaginatedResponse(
      data,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Loads one trip by id after enforcing fleet isolation.
  async getTripForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<FleetTrip> {
    const trip = await this.prismaService.trip.findUnique({
      where: { id },
      include: {
        bike: {
          select: {
            label: true,
          },
        },
        rider: {
          select: {
            riderProfile: {
              select: {
                fullName: true,
              },
            },
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (user.role === 'INSURER') {
      const bike = await this.prismaService.bike.findUnique({
        where: { id: trip.bikeId },
        select: { insurerName: true },
      });
      if (bike?.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this trip is denied');
      }
    } else {
      this.assertFleetAccess(trip.fleetId, user);
    }

    return this.toFleetTrip(trip);
  }

  // Retrieves historical telemetry path coordinates for a trip.
  async getTripRouteForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<any[]> {
    // 1. Enforce subscription plan validation
    if (user.fleetPlan === 'DEMO') {
      throw new ForbiddenException(
        'Trip route replay requires an active Operations Plus subscription',
      );
    }

    // 2. Retrieve trip and check permissions
    const trip = await this.prismaService.trip.findUnique({
      where: { id },
      select: {
        id: true,
        fleetId: true,
        bikeId: true,
        startTs: true,
        endTs: true,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    if (user.role === 'INSURER') {
      const bike = await this.prismaService.bike.findUnique({
        where: { id: trip.bikeId },
        select: { insurerName: true },
      });
      if (bike?.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this trip is denied');
      }
    } else {
      this.assertFleetAccess(trip.fleetId, user);
    }

    // 3. Locate the device linked to this bike
    const device = await this.prismaService.device.findFirst({
      where: { bikeId: trip.bikeId },
      select: { id: true },
    });

    if (!device) {
      return [];
    }

    // 4. Query telemetry points during the trip duration
    const points = await this.prismaService.telemetryPoint.findMany({
      where: {
        deviceId: device.id,
        ts: {
          gte: trip.startTs,
          lte: trip.endTs || new Date(),
        },
      },
      select: {
        ts: true,
        lat: true,
        lng: true,
        speedKph: true,
        batteryPct: true,
        ignition: true,
      },
      orderBy: {
        ts: 'asc',
      },
    });

    // 5. Convert Decimal structures to standard numeric formats for the response
    return points.map((p) => ({
      ts: p.ts.toISOString(),
      lat: Number(p.lat),
      lng: Number(p.lng),
      speedKph: Number(p.speedKph),
      batteryPct: p.batteryPct,
      ignition: p.ignition,
    }));
  }

  // Converts persisted trip plus event aggregates into API response object.
  private async toFleetTrip(trip: TripWithRelations): Promise<FleetTrip> {
    const eventCounts = await this.getTripEventCounts(trip);
    const startBatteryPct =
      trip.startBatteryPct !== null ? Number(trip.startBatteryPct) : null;
    const endBatteryPct =
      trip.endBatteryPct !== null ? Number(trip.endBatteryPct) : null;
    const powerUsedPct =
      startBatteryPct !== null && endBatteryPct !== null
        ? Number((startBatteryPct - endBatteryPct).toFixed(2))
        : null;

    return {
      id: trip.id,
      fleetId: trip.fleetId,
      bikeId: trip.bikeId,
      bikeLabel: trip.bike?.label,
      riderId: trip.riderId,
      riderName:
        trip.rider?.riderProfile?.fullName ??
        trip.rider?.email ??
        trip.rider?.phone ??
        null,
      startTs: trip.startTs,
      endTs: trip.endTs,
      distanceKm: Number(trip.distanceKm),
      durationSec: trip.durationSec,
      score: Number(trip.score),
      startBatteryPct,
      endBatteryPct,
      powerUsedPct,
      eventCounts,
    };
  }

  // Aggregates event counts inside one trip window for client display and scoring transparency.
  private async getTripEventCounts(trip: Trip) {
    if (!trip.endTs) {
      return normalizeTripEventCounts([]);
    }

    const groupedRows = await this.prismaService.event.groupBy({
      by: ['type'],
      where: {
        fleetId: trip.fleetId,
        bikeId: trip.bikeId,
        ts: {
          gte: trip.startTs,
          lte: trip.endTs,
        },
      },
      _count: {
        _all: true,
      },
    });

    return normalizeTripEventCounts(
      groupedRows.map((row) => ({ type: row.type, count: row._count._all })),
    );
  }

  // Enforces fleet isolation on trip resources.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }
}
