import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { IngestionService } from './ingestion.service';
import { LiveController } from './live.controller';
import { LiveStateService } from './live-state.service';
import { RulesEngineService } from './rules-engine.service';

@Module({
  imports: [PrismaModule, RedisModule, EventsModule],
  controllers: [LiveController],
  providers: [IngestionService, LiveStateService, RulesEngineService],
  exports: [LiveStateService],
})
export class IngestionModule {}
