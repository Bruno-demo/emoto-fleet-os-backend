import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationOutboxModule } from './notification-outbox.module';

@Module({
  imports: [PrismaModule, AuditModule, EvidenceModule, NotificationOutboxModule],
  controllers: [IncidentsController, ContactsController],
  providers: [IncidentsService, ContactsService],
  exports: [IncidentsService, NotificationOutboxModule],
})
export class IncidentsModule {}
