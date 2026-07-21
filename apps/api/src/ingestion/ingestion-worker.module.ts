import { Module } from '@nestjs/common';
import { CommandsModule } from '../commands/commands.module';
import { EventsModule } from '../events/events.module';
import { FinancialsModule } from '../financials/financials.module';
import { MetricsModule } from '../metrics/metrics.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RoadsModule } from '../roads/roads.module';
import { IngestionService } from './ingestion.service';
import { LiveStateService } from './live-state.service';
import { RulesEngineService } from './rules-engine.service';
import { TripBuilderService } from './trip-builder.service';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EventsModule,
    CommandsModule,
    RoadsModule,
    MetricsModule,
    FinancialsModule,
  ],
  providers: [
    IngestionService,
    LiveStateService,
    RulesEngineService,
    TripBuilderService,
  ],
})
export class IngestionWorkerModule {}
