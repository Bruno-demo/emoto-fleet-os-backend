import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';

import { BillingController } from './billing.controller';
import { MomoWebhookController } from './momo-webhook.controller';
import { PricingTierService } from './services/pricing-tier.service';
import { DiscountService } from './services/discount.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingCycleService } from './services/billing-cycle.service';
import { BillingPaymentService } from './services/billing-payment.service';
import { BillingCronService } from './services/billing-cron.service';
import { MomoGatewayService } from './services/momo-gateway.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    MailModule,
    AuthModule,
    ScheduleModule.forRoot(),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
  ],
  controllers: [BillingController, MomoWebhookController],
  providers: [
    PricingTierService,
    DiscountService,
    BillingConfigService,
    BillingCycleService,
    BillingPaymentService,
    BillingCronService,
    MomoGatewayService,
    SubscriptionPlanService,
  ],
  exports: [
    PricingTierService,
    DiscountService,
    BillingConfigService,
    BillingCycleService,
    BillingPaymentService,
    MomoGatewayService,
    SubscriptionPlanService,
  ],
})
export class BillingModule {}
