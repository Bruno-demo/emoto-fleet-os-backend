import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Trip } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListTripsDto } from './dto/list-trips.dto';
import { normalizeTripEventCounts } from './trip-scoring.util';
import { FleetTrip } from './trips.types';

@Injectable()
export class TripsService {
  constructor(private readonly prismaService: PrismaService) {}

  // Lists trips for one bike in caller fleet with optional date filtering.
  async listBikeTripsForUser(
    user: AuthenticatedUser,
    bikeId: string,
    query: ListTripsDto,
  ): Promise<FleetTrip[]> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
      select: {
        id: true,
        fleetId: true,
      },
    });

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }
    this.assertFleetAccess(bike.fleetId, user);

    const where: Prisma.TripWhereInput = {
      fleetId: user.fleetId,
      bikeId: bike.id,
    };

    if (query.from || query.to) {
      where.startTs = {};
      if (query.from) {
        where.startTs.gte = new Date(query.from);
      }
      if (query.to) {
        where.startTs.lte = new Date(query.to);
      }
    }

    const trips = await this.prismaService.trip.findMany({
      where,
      orderBy: { startTs: 'desc' },
      take: 500,
    });

    return Promise.all(trips.map((trip) => this.toFleetTrip(trip)));
  }

  // Loads one trip by id after enforcing fleet isolation.
  async getTripForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<FleetTrip> {
    const trip = await this.prismaService.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    this.assertFleetAccess(trip.fleetId, user);

    return this.toFleetTrip(trip);
  }

  // Converts persisted trip plus event aggregates into API response object.
  private async toFleetTrip(trip: Trip): Promise<FleetTrip> {
    const eventCounts = await this.getTripEventCounts(trip);

    return {
      id: trip.id,
      fleetId: trip.fleetId,
      bikeId: trip.bikeId,
      riderId: trip.riderId,
      startTs: trip.startTs,
      endTs: trip.endTs,
      distanceKm: Number(trip.distanceKm),
      durationSec: trip.durationSec,
      score: Number(trip.score),
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
