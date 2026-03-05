import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  HealthChecks,
  HealthErrorResponse,
  HealthResponse,
} from './health.types';

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // Checks database and Redis connectivity and returns a combined health snapshot.
  async check(): Promise<HealthResponse> {
    const checks: HealthChecks = {
      db: 'down',
      redis: 'down',
    };
    const errors: HealthErrorResponse['errors'] = {};

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      checks.db = 'up';
    } catch (error: unknown) {
      errors.db = this.getErrorMessage(error);
    }

    try {
      const pingResponse = await this.redisService.ping();
      if (pingResponse === 'PONG') {
        checks.redis = 'up';
      } else {
        errors.redis = `Unexpected Redis ping response: ${pingResponse}`;
      }
    } catch (error: unknown) {
      errors.redis = this.getErrorMessage(error);
    }

    if (checks.db === 'up' && checks.redis === 'up') {
      return {
        status: 'ok',
        checks,
      };
    }

    throw new ServiceUnavailableException({
      status: 'error',
      checks,
      errors,
    } satisfies HealthErrorResponse);
  }

  // Normalizes unknown thrown values into a safe message string.
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
