import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionFeatureGuard } from './subscription-feature.guard';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    {
      provide: APP_GUARD,
      useClass: SubscriptionFeatureGuard,
    },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
