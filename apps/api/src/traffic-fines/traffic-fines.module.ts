import { Module } from '@nestjs/common';
import { TrafficFinesController } from './traffic-fines.controller';
import { TrafficFinesService } from './traffic-fines.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TrafficFinesController],
  providers: [TrafficFinesService],
  exports: [TrafficFinesService],
})
export class TrafficFinesModule {}
