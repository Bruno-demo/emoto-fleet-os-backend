import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
