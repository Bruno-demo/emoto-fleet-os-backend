import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FleetPlan, FleetSubscriptionStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CheckoutSubscriptionDto } from './dto/checkout-subscription.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('subscription')
@ApiBearerAuth()
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('checkout')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Apply the selected fleet subscription plan' })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CheckoutSubscriptionDto,
  ): Promise<{
    fleetPlan: FleetPlan;
    subscriptionStatus: FleetSubscriptionStatus;
  }> {
    return this.subscriptionService.updateCurrentFleetPlan(user, body.plan);
  }
}
