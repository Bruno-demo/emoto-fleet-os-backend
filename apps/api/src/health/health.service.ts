import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  HealthChecks,
  HealthErrorResponse,
  HealthResponse,
} from './health.types';

@Injectable()
export class HealthService {
  private readonly mqttDisabled: boolean;
  private failUntil = 0;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.mqttDisabled = this.configService.get<boolean>('MQTT_DISABLED', false);
  }

  private cachedResult: { response?: HealthResponse; error?: any } | null = null;
  private cachedTime = 0;
  private readonly CACHE_TTL_MS = 10_000; // Cache for 10 seconds

  // Checks database, Redis, and optionally MQTT connectivity and returns a combined health snapshot.
  async check(): Promise<HealthResponse> {
    if (Date.now() < this.failUntil) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          db: 'down',
          redis: 'down',
        },
        errors: {
          simulation: 'Simulated health failure active for testing failover',
        },
      });
    }

    const now = Date.now();
    if (this.cachedResult && (now - this.cachedTime < this.CACHE_TTL_MS)) {
      if (this.cachedResult.error) {
        throw new ServiceUnavailableException(this.cachedResult.error);
      }
      return this.cachedResult.response!;
    }

    try {
      const response = await this.performCheck();
      this.cachedResult = { response };
      this.cachedTime = now;
      return response;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.cachedResult = { error: error.getResponse() };
        this.cachedTime = now;
      }
      throw error;
    }
  }

  // Performs the actual connectivity tests for database, Redis, and MQTT broker.
  private async performCheck(): Promise<HealthResponse> {
    const checks: HealthChecks = {
      db: 'down',
      redis: 'down',
    };
    if (!this.mqttDisabled) {
      checks.mqtt = 'down';
    }
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

    if (!this.mqttDisabled) {
      try {
        await this.checkMqtt();
        checks.mqtt = 'up';
      } catch (error: unknown) {
        errors.mqtt = this.getErrorMessage(error);
      }
    }

    const criticalUp = checks.db === 'up' && checks.redis === 'up';
    if (criticalUp) {
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

  // Performs a lightweight MQTT connection to verify broker reachability.
  private async checkMqtt(): Promise<void> {
    const mqtt = await import('mqtt');
    const mqttUrl = this.configService.getOrThrow<string>('MQTT_URL');
    const mqttUser = this.configService.get<string>('MQTT_USER');
    const mqttPassword = this.configService.get<string>('MQTT_PASSWORD');

    await new Promise<void>((resolve, reject) => {
      const options: Record<string, any> = {
        connectTimeout: 5_000,
        reconnectPeriod: 0,
      };
      if (mqttUser) {
        options.username = mqttUser;
      }
      if (mqttPassword) {
        options.password = mqttPassword;
      }

      const client = mqtt.connect(mqttUrl, options);
      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error('MQTT connection timed out'));
      }, 5_000);
      client.once('connect', () => {
        clearTimeout(timeout);
        client.end(true);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(timeout);
        client.end(true);
        reject(err);
      });
    });
  }

  simulateFail() {
    this.failUntil = Date.now() + 3 * 60 * 1000; // 3 minutes
    return {
      message: 'Simulated health failure activated. This instance will return 503 for the next 3 minutes.',
      failUntil: new Date(this.failUntil).toISOString(),
    };
  }

  // Normalizes unknown thrown values into a safe message string.
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
