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
import { BatterySwapDetectorService } from '../financials/battery-swap-detector.service';
import { LiveBikeState } from './ingestion.types';

const LIVE_STATE_TTL_SECONDS = 60 * 60;

@Injectable()
export class LiveStateService {
  private readonly logger = new Logger(LiveStateService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly eventsGateway: EventsGateway,
    private readonly prismaService: PrismaService,
    private readonly batterySwapDetectorService: BatterySwapDetectorService,
  ) {}

  // Calculates Haversine distance between two lat/lng points in meters
  private calculateHaversineDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Filters out stationary GPS drift, normalizes precision to 6 decimals (~11cm), and locks location when parked.
  async filterStationaryDrift(
    fleetId: string,
    bikeId: string | null,
    incoming: {
      lat: number;
      lng: number;
      speedKph: number;
      ignition?: boolean;
    },
  ): Promise<{ lat: number; lng: number; speedKph: number }> {
    // Normalize coordinates to 6 decimal places (~0.11m precision)
    let lat = Math.round(incoming.lat * 1000000) / 1000000;
    let lng = Math.round(incoming.lng * 1000000) / 1000000;
    let speedKph = incoming.speedKph;

    // Noise threshold for low speeds
    if (speedKph < 2.0) {
      speedKph = 0;
    }

    if (bikeId) {
      try {
        const cached = await this.getBikeState(fleetId, bikeId);
        if (cached && cached.lat && cached.lng) {
          const distMeters = this.calculateHaversineDistanceMeters(
            cached.lat,
            cached.lng,
            lat,
            lng,
          );

          // 1. If ignition is OFF, lock coordinates to last known parked location
          if (incoming.ignition === false) {
            lat = cached.lat;
            lng = cached.lng;
            speedKph = 0;
          }
          // 2. If stationary/low speed and drift is under 15 meters, lock position to eliminate map jitter
          else if (speedKph === 0 && distMeters < 15.0) {
            lat = cached.lat;
            lng = cached.lng;
          }
        }
      } catch (err: unknown) {
        this.logger.debug(`Failed to fetch cached state for drift filter: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { lat, lng, speedKph };
  }

  // Stores the latest bike state in Redis with fleet-scoped key and expiration.
  async setLatestBikeState(state: LiveBikeState): Promise<void> {
    const key = this.buildBikeStateKey(state.fleetId, state.bikeId);

    // Safety check: Don't let older packets overwrite a newer cached position in Redis
    const existing = await this.getBikeState(state.fleetId, state.bikeId);
    if (existing && existing.ts.localeCompare(state.ts) > 0) {
      this.logger.debug(
        `Discarding out-of-order Redis live state write for bike ${state.bikeId} (incoming ts: ${state.ts} is older than cached ts: ${existing.ts})`,
      );
      return;
    }

    await this.redisService.set(
      key,
      JSON.stringify(state),
      LIVE_STATE_TTL_SECONDS,
    );
    this.eventsGateway.emitBikeState(state);

    // Evaluate telemetry for automatic battery swap detection
    try {
      await this.batterySwapDetectorService.evaluateTelemetryForSwap(
        existing,
        state,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to evaluate automatic battery swap for bike ${state.bikeId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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

    // Filter bikes with active devices
    const bikesWithDevices = bikes.filter((bike) => bike.devices[0]);

    if (bikesWithDevices.length > 0) {
      // Build keys for all these bikes in one go
      const keys = bikesWithDevices.map((bike) =>
        this.buildBikeStateKey(fleetId, bike.id),
      );
      const cachedValues = await this.redisService.mget(keys);

      for (let index = 0; index < bikesWithDevices.length; index++) {
        const bike = bikesWithDevices[index];
        const activeDevice = bike.devices[0];
        const cachedValue = cachedValues[index];

        if (cachedValue) {
          const cachedState = this.parseState(cachedValue);
          if (cachedState) {
            parsedStates.push(cachedState);
            continue;
          }
        }

        // Fall back to the latest telemetry point in the database
        const latestTelemetry = activeDevice.telemetry[0];
        if (latestTelemetry) {
          const lastSeen = activeDevice.lastSeenAt ?? latestTelemetry.ts;
          const isStale = Date.now() - lastSeen.getTime() > 10 * 60 * 1000; // 10 minutes stale threshold
          const fallbackState: LiveBikeState = {
            fleetId,
            bikeId: bike.id,
            deviceId: activeDevice.id,
            deviceUid: activeDevice.deviceUid,
            ts: lastSeen.toISOString(),
            lat: Number(latestTelemetry.lat),
            lng: Number(latestTelemetry.lng),
            speedKph: isStale ? 0 : Number(latestTelemetry.speedKph),
            heading: latestTelemetry.heading
              ? Number(latestTelemetry.heading)
              : undefined,
            batteryV: latestTelemetry.batteryV
              ? Number(latestTelemetry.batteryV)
              : undefined,
            batteryPct: latestTelemetry.batteryPct
              ? Number(latestTelemetry.batteryPct)
              : undefined,
            ignition: latestTelemetry.ignition ?? undefined,
          };
          parsedStates.push(fallbackState);
        }
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
