import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FleetPlan } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { HqGuard } from '../hq/guards/hq.guard';
import { Public } from '../auth/public.decorator';

import { PricingTierService } from './services/pricing-tier.service';
import { DiscountService } from './services/discount.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingCycleService } from './services/billing-cycle.service';
import { BillingPaymentService } from './services/billing-payment.service';

import { UpdatePricingTierDto } from './dto/update-pricing-tier.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';
import { RecordBillingPaymentDto } from './dto/record-billing-payment.dto';
import { ListBillingCyclesDto } from './dto/list-billing-cycles.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly pricingTierService: PricingTierService,
    private readonly discountService: DiscountService,
    private readonly billingConfigService: BillingConfigService,
    private readonly billingCycleService: BillingCycleService,
    private readonly billingPaymentService: BillingPaymentService,
  ) {}

  // ── Fleet-Operator Endpoints ─────────────────────────────────────

  @Get('my-cycles')
  @ApiOperation({ summary: "List billing cycles for the user's own fleet" })
  async getMyCycles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBillingCyclesDto,
  ) {
    query.fleetId = user.fleetId;
    return await this.billingCycleService.listCycles(query);
  }

  @Get('my-cycles/:id')
  @ApiOperation({
    summary: "Get details of a specific billing cycle for the user's own fleet",
  })
  async getMyCycle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const cycle = await this.billingCycleService.getCycle(id);
    if (cycle.fleetId !== user.fleetId) {
      throw new ForbiddenException(
        'You do not have access to this billing cycle',
      );
    }
    return cycle;
  }

  @Post('validate-discount')
  @ApiOperation({ summary: 'Validate a discount code' })
  async validateDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      code: string;
      originalAmount: number;
      target: 'setup' | 'subscription';
    },
  ) {
    return await this.discountService.validateDiscountCode(
      body.code,
      user.fleetId,
      body.originalAmount,
      body.target,
    );
  }

  @Get('public/validate-discount')
  @Public()
  @ApiOperation({ summary: 'Validate a discount code publicly' })
  async validateDiscountPublic(
    @Query('code') code: string,
  ) {
    if (!code) {
      throw new BadRequestException('Discount code is required');
    }
    return await this.discountService.validateDiscountCode(
      code,
      '00000000-0000-0000-0000-000000000000', // Dummy UUID for validation
      10000, // Dummy originalAmount
      'subscription', // Dummy target
    );
  }

  // ── HQ-Only Endpoints ───────────────────────────────────────────

  @Get('pricing')
  @Public()
  @ApiOperation({ summary: 'List all pricing tiers' })
  async getPricingTiers() {
    return await this.pricingTierService.getAllTiers();
  }

  @Put('pricing/:planCode')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Update a pricing tier' })
  async updatePricingTier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planCode') planCode: FleetPlan,
    @Body() dto: UpdatePricingTierDto,
  ) {
    return await this.pricingTierService.updateTier(planCode, dto, user);
  }

  @Get('discounts')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: List all discount rules' })
  async getDiscounts() {
    return await this.discountService.listDiscounts();
  }

  @Post('discounts')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Create a new discount rule' })
  async createDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscountDto,
  ) {
    return await this.discountService.createDiscount(dto, user);
  }

  @Put('discounts/:id')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Update a discount rule' })
  async updateDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return await this.discountService.updateDiscount(id, dto, user);
  }

  @Delete('discounts/:id')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Delete a discount rule' })
  async deleteDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return await this.discountService.deleteDiscount(id, user);
  }

  @Get('config')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Get global billing settings' })
  async getBillingConfig() {
    return await this.billingConfigService.getConfig();
  }

  @Put('config')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Update global billing settings' })
  async updateBillingConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBillingConfigDto,
  ) {
    return await this.billingConfigService.updateConfig(dto, user);
  }

  @Get('cycles')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: List all billing cycles globally' })
  async getCycles(@Query() query: ListBillingCyclesDto) {
    return await this.billingCycleService.listCycles(query);
  }

  @Get('cycles/:id')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Get a single billing cycle details' })
  async getCycle(@Param('id') id: string) {
    return await this.billingCycleService.getCycle(id);
  }

  @Post('cycles/:id/payments')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Record payment against a billing cycle' })
  async recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordBillingPaymentDto,
  ) {
    return await this.billingPaymentService.recordPayment(id, dto, user);
  }

  @Post('cycles/generate')
  @UseGuards(HqGuard)
  @ApiOperation({
    summary: 'HQ: Manually trigger billing cycle generation for a fleet',
  })
  async generateCycle(@Body() body: { fleetId: string }) {
    return await this.billingCycleService.generateCycleForFleet(
      body.fleetId,
      true,
    );
  }

  @Put('cycles/:id/void')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Void a billing cycle' })
  async voidCycle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return await this.billingCycleService.voidCycle(id, user);
  }

  @Put('cycles/:id/notes')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Update billing cycle notes' })
  async updateCycleNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    return await this.billingCycleService.updateCycleNotes(id, body.notes);
  }
}
