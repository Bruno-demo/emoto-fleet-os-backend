import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RiderController } from './rider.controller';
import { RidersAdminController } from './riders-admin.controller';
import { RidersService } from './riders.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule, IncidentsModule],
  controllers: [RidersAdminController, RiderController],
  providers: [RidersService],
})
export class RidersModule {}
