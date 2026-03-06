import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BikesController } from './bikes.controller';
import { BikesService } from './bikes.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [BikesController],
  providers: [BikesService],
})
export class BikesModule {}
