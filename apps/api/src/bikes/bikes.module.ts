import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BikesController } from './bikes.controller';
import { BikesService } from './bikes.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BikesController],
  providers: [BikesService],
})
export class BikesModule {}
