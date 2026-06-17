import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

import { BillingController } from './billing.controller';
import { PricingTierService } from './services/pricing-tier.service';
import { DiscountService } from './services/discount.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingCycleService } from './services/billing-cycle.service';
import { BillingPaymentService } from './services/billing-payment.service';
import { BillingCronService } from './services/billing-cron.service';

@Module({
  imports: [PrismaModule, AuditModule, MailModule, ScheduleModule.forRoot()],
  controllers: [BillingController],
  providers: [
    PricingTierService,
    DiscountService,
    BillingConfigService,
    BillingCycleService,
    BillingPaymentService,
    BillingCronService,
  ],
  exports: [
    PricingTierService,
    DiscountService,
    BillingConfigService,
    BillingCycleService,
    BillingPaymentService,
  ],
})
export class BillingModule {}
