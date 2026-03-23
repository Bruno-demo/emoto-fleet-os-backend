import { Module, OnModuleInit } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationOutboxModule } from '../incidents/notification-outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Module({
  imports: [PrismaModule, NotificationOutboxModule, AuditModule],
  providers: [WebhookDispatcherService],
  exports: [WebhookDispatcherService],
})
export class WebhookDispatcherModule implements OnModuleInit {
  constructor(private readonly dispatcher: WebhookDispatcherService) {}

  // Forces dispatcher initialization so lifecycle hooks run in worker contexts.
  onModuleInit(): void {
    void this.dispatcher;
  }
}
