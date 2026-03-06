import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsController } from './events.controller';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EventsController],
  providers: [EventsService, EventsGateway],
  exports: [EventsService, EventsGateway],
})
export class EventsModule {}
