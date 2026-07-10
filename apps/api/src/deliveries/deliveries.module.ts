import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { NotificationOutboxModule } from '../incidents/notification-outbox.module';
import { RedisModule } from '../redis/redis.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    IngestionModule,
    NotificationOutboxModule,
    RedisModule,
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
