import { Body, Controller, Get, Post, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, FleetType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { FinancialsService } from './financials.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';

@ApiTags('financials')
@ApiBearerAuth()
@Controller('financials')
@Roles(UserRole.ADMIN, UserRole.OWNER)
@RequireSubscriptionFeature('financial')
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a daily rider payment' })
  async recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
  ) {
    if (user.fleetType !== FleetType.COOP) {
      throw new ForbiddenException('Financial management features are only available for cooperative fleets');
    }
    return this.financialsService.recordPayment(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter recorded rider payments' })
  async listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsDto,
  ) {
    if (user.fleetType !== FleetType.COOP) {
      throw new ForbiddenException('Financial management features are only available for cooperative fleets');
    }
    return this.financialsService.listPayments(user, query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Get aggregated financials, daily averages and method distribution',
  })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (user.fleetType !== FleetType.COOP) {
      throw new ForbiddenException('Financial management features are only available for cooperative fleets');
    }
    return this.financialsService.getSummary(user, startDate, endDate);
  }

  @Get('leases')
  @ApiOperation({
    summary: 'Get all active lease-to-own accounts',
  })
  async getLeases(@CurrentUser() user: AuthenticatedUser) {
    if (user.fleetType !== FleetType.COOP) {
      throw new ForbiddenException('Financial management features are only available for cooperative fleets');
    }
    return this.financialsService.getLeases(user);
  }
}
