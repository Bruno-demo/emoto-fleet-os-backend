import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, FleetType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { FinancialsService } from './financials.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { RecordDeliveryPayoutDto } from './dto/record-delivery-payout.dto';
import { CreateBatterySwapDto } from './dto/create-battery-swap.dto';
import { ListBatterySwapsDto } from './dto/list-battery-swaps.dto';

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
      throw new ForbiddenException(
        'Financial management features are only available for cooperative fleets',
      );
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
      throw new ForbiddenException(
        'Financial management features are only available for cooperative fleets',
      );
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
      throw new ForbiddenException(
        'Financial management features are only available for cooperative fleets',
      );
    }
    return this.financialsService.getSummary(user, startDate, endDate);
  }

  @Get('leases')
  @ApiOperation({
    summary: 'Get all active lease-to-own accounts',
  })
  async getLeases(@CurrentUser() user: AuthenticatedUser) {
    if (user.fleetType !== FleetType.COOP) {
      throw new ForbiddenException(
        'Financial management features are only available for cooperative fleets',
      );
    }
    return this.financialsService.getLeases(user);
  }

  @Get('delivery/summary')
  @ApiOperation({
    summary: 'Get summary of delivery payouts and pending commissions',
  })
  async getDeliverySummary(@CurrentUser() user: AuthenticatedUser) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery financials are only available for delivery fleets',
      );
    }
    return this.financialsService.getDeliveryFinancialSummary(user);
  }

  @Get('delivery/payouts')
  @ApiOperation({ summary: 'Get all delivery payout and commission records' })
  async getDeliveryPayouts(@CurrentUser() user: AuthenticatedUser) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery financials are only available for delivery fleets',
      );
    }
    return this.financialsService.getDeliveryPayouts(user);
  }

  @Post('delivery/payout')
  @ApiOperation({ summary: 'Record a delivery commission payout to a rider' })
  async recordDeliveryPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordDeliveryPayoutDto,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery financials are only available for delivery fleets',
      );
    }
    return this.financialsService.recordDeliveryPayout(user, dto);
  }

  @Get('battery-swaps')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.INSURER,
  )
  @ApiOperation({ summary: 'List and filter recorded battery swaps' })
  async listBatterySwaps(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBatterySwapsDto,
  ) {
    return this.financialsService.listBatterySwaps(user, query);
  }

  @Post('battery-swaps')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Record a new battery swap transaction' })
  async createBatterySwap(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBatterySwapDto,
  ) {
    return this.financialsService.createBatterySwap(user, dto);
  }

  @Delete('battery-swaps/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete or void a battery swap record' })
  async deleteBatterySwap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.financialsService.deleteBatterySwap(user, id);
  }
}
