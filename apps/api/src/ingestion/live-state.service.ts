import { Injectable, Logger } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { EventsGateway } from '../events/events.gateway';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { LiveBikeState } from './ingestion.types';

const LIVE_STATE_TTL_SECONDS = 60 * 60;

@Injectable()
export class LiveStateService {
  private readonly logger = new Logger(LiveStateService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly eventsGateway: EventsGateway,
    private readonly prismaService: PrismaService,
  ) {}

  // Stores the latest bike state in Redis with fleet-scoped key and expiration.
  async setLatestBikeState(state: LiveBikeState): Promise<void> {
    const key = this.buildBikeStateKey(state.fleetId, state.bikeId);
    await this.redisService.set(
      key,
      JSON.stringify(state),
      LIVE_STATE_TTL_SECONDS,
    );
    this.eventsGateway.emitBikeState(state);
  }

  // Loads a single latest bike state from Redis cache.
  async getBikeState(
    fleetId: string,
    bikeId: string,
  ): Promise<LiveBikeState | null> {
    const key = this.buildBikeStateKey(fleetId, bikeId);
    const value = await this.redisService.get(key);
    if (!value) {
      return null;
    }
    return this.parseState(value);
  }

  // Loads all latest bike states for a fleet, falling back to database telemetry if Redis is missing/expired.
  async getFleetBikeStates(
    fleetId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<LiveBikeState>> {
    const pagination = getPaginationParams(query);

    // Fetch all active bikes in this fleet with their active devices and the latest telemetry point for each
    const bikes = await this.prismaService.bike.findMany({
      where: {
        fleetId,
        status: 'ACTIVE',
      },
      include: {
        devices: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            telemetry: {
              orderBy: {
                ts: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    const parsedStates: LiveBikeState[] = [];

    for (const bike of bikes) {
      const activeDevice = bike.devices[0];
      if (!activeDevice) {
        continue;
      }

      // 1. Try to load from Redis first
      const cachedState = await this.getBikeState(fleetId, bike.id);
      if (cachedState) {
        parsedStates.push(cachedState);
        continue;
      }

      // 2. Fall back to the latest telemetry point in the database
      const latestTelemetry = activeDevice.telemetry[0];
      if (latestTelemetry) {
        const fallbackState: LiveBikeState = {
          fleetId,
          bikeId: bike.id,
          deviceId: activeDevice.id,
          deviceUid: activeDevice.deviceUid,
          ts: latestTelemetry.ts.toISOString(),
          lat: Number(latestTelemetry.lat),
          lng: Number(latestTelemetry.lng),
          speedKph: Number(latestTelemetry.speedKph),
          heading: latestTelemetry.heading ? Number(latestTelemetry.heading) : undefined,
          batteryV: latestTelemetry.batteryV ? Number(latestTelemetry.batteryV) : undefined,
          batteryPct: latestTelemetry.batteryPct ? Number(latestTelemetry.batteryPct) : undefined,
          ignition: latestTelemetry.ignition ?? undefined,
        };
        parsedStates.push(fallbackState);
      }
    }

    // Sort by timestamp desc (ISO date strings compare alphabetically)
    const sortedStates = parsedStates.sort((left, right) =>
      right.ts.localeCompare(left.ts),
    );
    const start = pagination.skip;
    const end = start + pagination.take;

    return createPaginatedResponse(
      sortedStates.slice(start, end),
      sortedStates.length,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Creates the Redis key for storing latest fleet bike positions.
  private buildBikeStateKey(fleetId: string, bikeId: string): string {
    return `live:fleet:${fleetId}:bike:${bikeId}`;
  }

  // Builds the Redis key pattern used for fleet-level live bike scans.
  private buildFleetBikeKeyPattern(fleetId: string): string {
    return `live:fleet:${fleetId}:bike:*`;
  }

  // Parses and validates cached live-state JSON from Redis.
  private parseState(value: string): LiveBikeState | null {
    try {
      const parsed = JSON.parse(value) as LiveBikeState;
      if (
        !parsed.bikeId ||
        !parsed.fleetId ||
        !parsed.deviceUid ||
        !parsed.ts
      ) {
        return null;
      }

      return parsed;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Ignoring malformed live state entry: ${message}`);
      return null;
    }
  }
}
