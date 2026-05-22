import { Module } from '@nestjs/common';
import { CommandsModule } from '../commands/commands.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RoadsModule } from '../roads/roads.module';
import { IngestionService } from './ingestion.service';
import { LiveController } from './live.controller';
import { LiveStateService } from './live-state.service';
import { RulesEngineService } from './rules-engine.service';
import { TripBuilderService } from './trip-builder.service';
import { SinoTrackAdapterService } from './sinotrack-adapter.service';

@Module({
  imports: [PrismaModule, RedisModule, EventsModule, CommandsModule, RoadsModule],
  controllers: [LiveController],
  providers: [
    IngestionService,
    LiveStateService,
    RulesEngineService,
    TripBuilderService,
    SinoTrackAdapterService,
  ],
  exports: [LiveStateService],
})
export class IngestionModule {}
