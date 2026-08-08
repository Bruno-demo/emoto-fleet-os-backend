import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommandsModule } from '../commands/commands.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { RedisModule } from '../redis/redis.module';
import { BillingModule } from '../billing/billing.module';
import { RiderController } from './rider.controller';
import { RidersAdminController } from './riders-admin.controller';
import { RidersService } from './riders.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    EventsModule,
    IncidentsModule,
    CommandsModule,
    IngestionModule,
    RedisModule,
    BillingModule,
  ],
  controllers: [RidersAdminController, RiderController],
  providers: [RidersService],
})
export class RidersModule {}
