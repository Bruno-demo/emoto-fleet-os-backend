import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Module({
  imports: [PrismaModule, IncidentsModule, AuditModule],
  providers: [WebhookDispatcherService],
})
export class WebhookDispatcherModule {}
