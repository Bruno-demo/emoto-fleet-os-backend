import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface InMemoryRedisEntry {
  value: string;
  expiresAt: number | null;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;
  private readonly useInMemoryStore: boolean;
  private readonly memoryStore = new Map<string, InMemoryRedisEntry>();

  constructor(private readonly configService: ConfigService) {
    this.useInMemoryStore = this.configService.get<boolean>(
      'REDIS_IN_MEMORY',
      false,
    );

    if (this.useInMemoryStore) {
      this.client = null;
      this.logger.log('RedisService running in in-memory mode');
      return;
    }

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
    if (this.useInMemoryStore) {
      return 'PONG';
    }

    await this.ensureConnected();

    return this.client!.ping();
  }

  // Atomically sets a key with TTL only if it does not already exist.
  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (this.useInMemoryStore) {
      this.purgeExpiredKey(key);
      if (this.memoryStore.has(key)) {
        return false;
      }

      this.writeInMemoryValue(key, value, ttlSeconds);
      return true;
    }

    await this.ensureConnected();
    const response = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
    return response === 'OK';
  }

  // Sets a string value with optional TTL in seconds.
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.useInMemoryStore) {
      this.writeInMemoryValue(key, value, ttlSeconds);
      return;
    }

    await this.ensureConnected();
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client!.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.client!.set(key, value);
  }

  // Reads a string value by key.
  async get(key: string): Promise<string | null> {
    if (this.useInMemoryStore) {
      this.purgeExpiredKey(key);
      return this.memoryStore.get(key)?.value ?? null;
    }

    await this.ensureConnected();
    return this.client!.get(key);
  }

  // Lists keys for a pattern; intended for small fleet-scoped datasets.
  async keys(pattern: string): Promise<string[]> {
    if (this.useInMemoryStore) {
      const regex = this.globPatternToRegex(pattern);
      return Array.from(this.memoryStore.keys()).filter((key) => {
        this.purgeExpiredKey(key);
        return this.memoryStore.has(key) && regex.test(key);
      });
    }

    await this.ensureConnected();
    return this.client!.keys(pattern);
  }

  // Fetches multiple values in one Redis roundtrip.
  async mget(keys: string[]): Promise<Array<string | null>> {
    if (this.useInMemoryStore) {
      return keys.map((key) => {
        this.purgeExpiredKey(key);
        return this.memoryStore.get(key)?.value ?? null;
      });
    }

    await this.ensureConnected();
    if (keys.length === 0) {
      return [];
    }

    return this.client!.mget(keys);
  }

  // Deletes a Redis key if it exists.
  async del(key: string): Promise<void> {
    if (this.useInMemoryStore) {
      this.memoryStore.delete(key);
      return;
    }

    await this.ensureConnected();
    await this.client!.del(key);
  }

  // Closes the Redis connection during app shutdown.
  async onModuleDestroy(): Promise<void> {
    if (this.useInMemoryStore) {
      this.memoryStore.clear();
      return;
    }

    if (
      this.client &&
      this.client.status !== 'end' &&
      this.client.status !== 'wait'
    ) {
      await this.client.quit();
    }
  }

  // Lazily establishes the Redis connection for runtime operations.
  private async ensureConnected(): Promise<void> {
    if (!this.client) {
      return;
    }

    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  // Stores in-memory values with optional expiration for test-mode Redis behavior.
  private writeInMemoryValue(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): void {
    const expiresAt =
      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(key, {
      value,
      expiresAt,
    });
  }

  // Removes expired in-memory keys before read operations.
  private purgeExpiredKey(key: string): void {
    const entry = this.memoryStore.get(key);
    if (!entry?.expiresAt) {
      return;
    }

    if (entry.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
    }
  }

  // Converts simple Redis glob patterns to regex for in-memory key scans.
  private globPatternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
  }
}
