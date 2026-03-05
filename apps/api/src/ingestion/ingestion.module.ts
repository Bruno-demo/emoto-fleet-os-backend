import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { IngestionService } from './ingestion.service';
import { LiveController } from './live.controller';
import { LiveStateService } from './live-state.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [LiveController],
  providers: [IngestionService, LiveStateService],
  exports: [LiveStateService],
})
export class IngestionModule {}
