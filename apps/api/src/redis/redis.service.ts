import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    // Creates a single Redis connection reused across the application.
    this.client = new Redis(this.configService.getOrThrow<string>('REDIS_URL'));
  }

  // Sends a Redis PING command to verify connectivity.
  async ping(): Promise<string> {
    return this.client.ping();
  }

  // Closes the Redis connection during app shutdown.
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
