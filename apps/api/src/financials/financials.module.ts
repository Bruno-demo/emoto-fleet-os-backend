import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { FinancialsController } from './financials.controller';
import { FinancialsService } from './financials.service';
import { BatterySwapDetectorService } from './battery-swap-detector.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [FinancialsController],
  providers: [FinancialsService, BatterySwapDetectorService],
  exports: [FinancialsService, BatterySwapDetectorService],
})
export class FinancialsModule {}
