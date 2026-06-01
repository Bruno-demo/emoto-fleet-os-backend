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

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.mqttDisabled = this.configService.get<boolean>('MQTT_DISABLED', false);
  }

  // Checks database, Redis, and optionally MQTT connectivity and returns a combined health snapshot.
  async check(): Promise<HealthResponse> {
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

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(mqttUrl, {
        connectTimeout: 5_000,
        reconnectPeriod: 0,
      });
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

  // Normalizes unknown thrown values into a safe message string.
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
