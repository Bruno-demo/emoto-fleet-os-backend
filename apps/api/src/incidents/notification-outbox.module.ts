import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsoleNotificationProvider } from './console-notification.provider';
import { NotificationOutboxService } from './notification-outbox.service';
import { NOTIFICATION_PROVIDER } from './notification-provider';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [
    NotificationOutboxService,
    ConsoleNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      useExisting: ConsoleNotificationProvider,
    },
  ],
  exports: [NotificationOutboxService],
})
export class NotificationOutboxModule {}
