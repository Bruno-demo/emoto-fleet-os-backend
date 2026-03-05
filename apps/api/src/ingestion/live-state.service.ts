import { Injectable, Logger } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { RedisService } from '../redis/redis.service';
import { LiveBikeState } from './ingestion.types';

const LIVE_STATE_TTL_SECONDS = 60 * 60;

@Injectable()
export class LiveStateService {
  private readonly logger = new Logger(LiveStateService.name);

  constructor(private readonly redisService: RedisService) {}

  // Stores the latest bike state in Redis with fleet-scoped key and expiration.
  async setLatestBikeState(state: LiveBikeState): Promise<void> {
    const key = this.buildBikeStateKey(state.fleetId, state.bikeId);
    await this.redisService.set(
      key,
      JSON.stringify(state),
      LIVE_STATE_TTL_SECONDS,
    );
  }

  // Loads all latest bike states for a fleet from Redis cache.
  async getFleetBikeStates(
    fleetId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<LiveBikeState>> {
    const pagination = getPaginationParams(query);
    const keys = await this.redisService.keys(
      this.buildFleetBikeKeyPattern(fleetId),
    );
    if (keys.length === 0) {
      return createPaginatedResponse(
        [],
        0,
        pagination.page,
        pagination.pageSize,
      );
    }

    const values = await this.redisService.mget(keys);
    const parsedStates: LiveBikeState[] = [];

    for (const value of values) {
      if (!value) {
        continue;
      }

      const parsedState = this.parseState(value);
      if (parsedState) {
        parsedStates.push(parsedState);
      }
    }

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
