import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ConsoleNotificationProvider } from './console-notification.provider';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NOTIFICATION_PROVIDER } from './notification-provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IncidentsController, ContactsController],
  providers: [
    IncidentsService,
    ContactsService,
    NotificationOutboxService,
    ConsoleNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      useExisting: ConsoleNotificationProvider,
    },
  ],
  exports: [IncidentsService],
})
export class IncidentsModule {}
