import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    // Creates a single Redis client with lazy connection to avoid boot-time hard failures.
    this.client = new Redis(
      this.configService.getOrThrow<string>('REDIS_URL'),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    );

    // Normalizes Redis connection errors into structured app logs.
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis unavailable: ${error.message}`);
    });
  }

  // Sends a Redis PING command to verify connectivity.
  async ping(): Promise<string> {
    await this.ensureConnected();

    return this.client.ping();
  }

  // Atomically sets a key with TTL only if it does not already exist.
  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    await this.ensureConnected();
    const response = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return response === 'OK';
  }

  // Sets a string value with optional TTL in seconds.
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.ensureConnected();
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, value);
  }

  // Reads a string value by key.
  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }

  // Lists keys for a pattern; intended for small fleet-scoped datasets.
  async keys(pattern: string): Promise<string[]> {
    await this.ensureConnected();
    return this.client.keys(pattern);
  }

  // Fetches multiple values in one Redis roundtrip.
  async mget(keys: string[]): Promise<Array<string | null>> {
    await this.ensureConnected();
    if (keys.length === 0) {
      return [];
    }

    return this.client.mget(keys);
  }

  // Deletes a Redis key if it exists.
  async del(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }

  // Closes the Redis connection during app shutdown.
  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end' && this.client.status !== 'wait') {
      await this.client.quit();
    }
  }

  // Lazily establishes the Redis connection for runtime operations.
  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
