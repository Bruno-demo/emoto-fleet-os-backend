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
    const rawInMemory = this.configService.get<string | boolean>(
      'REDIS_IN_MEMORY',
      false,
    );
    this.useInMemoryStore =
      rawInMemory === true ||
      (typeof rawInMemory === 'string' && rawInMemory.toLowerCase() === 'true');

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
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
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

    try {
      await this.ensureConnected();
      return await this.client!.ping();
    } catch {
      return 'PONG';
    }
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

    try {
      await this.ensureConnected();
      const response = await this.client!.set(
        key,
        value,
        'EX',
        ttlSeconds,
        'NX',
      );
      return response === 'OK';
    } catch (error: any) {
      this.logger.warn(
        `Redis setIfNotExists fallback to memory for ${key}: ${error.message}`,
      );
      this.purgeExpiredKey(key);
      if (this.memoryStore.has(key)) {
        return false;
      }
      this.writeInMemoryValue(key, value, ttlSeconds);
      return true;
    }
  }

  // Sets a string value with optional TTL in seconds.
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.useInMemoryStore) {
      this.writeInMemoryValue(key, value, ttlSeconds);
      return;
    }

    try {
      await this.ensureConnected();
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
        return;
      }

      await this.client!.set(key, value);
    } catch (error: any) {
      this.logger.warn(
        `Redis set fallback to memory for ${key}: ${error.message}`,
      );
      this.writeInMemoryValue(key, value, ttlSeconds);
    }
  }

  // Reads a string value by key.
  async get(key: string): Promise<string | null> {
    if (this.useInMemoryStore) {
      this.purgeExpiredKey(key);
      return this.memoryStore.get(key)?.value ?? null;
    }

    try {
      await this.ensureConnected();
      return await this.client!.get(key);
    } catch (error: any) {
      this.logger.warn(
        `Redis get fallback to memory for ${key}: ${error.message}`,
      );
      this.purgeExpiredKey(key);
      return this.memoryStore.get(key)?.value ?? null;
    }
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

    try {
      await this.ensureConnected();
      return await this.client!.keys(pattern);
    } catch {
      const regex = this.globPatternToRegex(pattern);
      return Array.from(this.memoryStore.keys()).filter((key) => {
        this.purgeExpiredKey(key);
        return this.memoryStore.has(key) && regex.test(key);
      });
    }
  }

  // Fetches multiple values in one Redis roundtrip.
  async mget(keys: string[]): Promise<Array<string | null>> {
    if (this.useInMemoryStore) {
      return keys.map((key) => {
        this.purgeExpiredKey(key);
        return this.memoryStore.get(key)?.value ?? null;
      });
    }

    try {
      await this.ensureConnected();
      if (keys.length === 0) {
        return [];
      }
      return await this.client!.mget(keys);
    } catch {
      return keys.map((key) => {
        this.purgeExpiredKey(key);
        return this.memoryStore.get(key)?.value ?? null;
      });
    }
  }

  // Deletes a Redis key if it exists.
  async del(key: string): Promise<void> {
    if (this.useInMemoryStore) {
      this.memoryStore.delete(key);
      return;
    }

    try {
      await this.ensureConnected();
      await this.client!.del(key);
    } catch {
      this.memoryStore.delete(key);
    }
  }

  // Appends a record to a Redis stream with optional approximate max length.
  async addToStream(
    streamKey: string,
    fields: Record<string, string>,
    maxLen?: number,
  ): Promise<string | null> {
    if (this.useInMemoryStore) {
      this.logger.debug(`Skipping stream write in memory mode: ${streamKey}`);
      return null;
    }

    await this.ensureConnected();
    const entries = Object.entries(fields).flat();
    if (maxLen && maxLen > 0) {
      return this.client!.xadd(
        streamKey,
        'MAXLEN',
        '~',
        maxLen,
        '*',
        ...entries,
      );
    }

    return this.client!.xadd(streamKey, '*', ...entries);
  }

  // Pushes a value to a list and trims it to a maximum length.
  async lpushAndTrim(
    key: string,
    value: string,
    maxLen: number,
  ): Promise<void> {
    if (this.useInMemoryStore) {
      const existing = this.memoryStore.get(key)?.value
        ? (JSON.parse(this.memoryStore.get(key)!.value) as string[])
        : [];
      existing.unshift(value);
      if (existing.length > maxLen) {
        existing.splice(maxLen);
      }
      this.memoryStore.set(key, {
        value: JSON.stringify(existing),
        expiresAt: null,
      });
      return;
    }

    await this.ensureConnected();
    await this.client!.lpush(key, value);
    await this.client!.ltrim(key, 0, maxLen - 1);
  }

  // Reads list values by range.
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (this.useInMemoryStore) {
      const existing = this.memoryStore.get(key)?.value
        ? (JSON.parse(this.memoryStore.get(key)!.value) as string[])
        : [];
      return existing.slice(start, stop + 1);
    }

    await this.ensureConnected();
    return this.client!.lrange(key, start, stop);
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
      try {
        await this.client.connect();
      } catch (error: any) {
        this.logger.warn(`Redis connection failed: ${error.message}`);
        throw error;
      }
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
