import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FinancialsController],
  providers: [FinancialsService],
  exports: [FinancialsService],
})
export class FinancialsModule {}
