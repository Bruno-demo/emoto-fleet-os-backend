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
import { FleetPlan, SubscriptionPlanDuration } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { HqGuard } from '../hq/guards/hq.guard';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

import { PricingTierService } from './services/pricing-tier.service';
import { DiscountService } from './services/discount.service';
import { BillingConfigService } from './services/billing-config.service';
import { BillingCycleService } from './services/billing-cycle.service';
import { BillingPaymentService } from './services/billing-payment.service';
import { MomoGatewayService } from './services/momo-gateway.service';
import { SubscriptionPlanService } from './services/subscription-plan.service';

import { UpdatePricingTierDto } from './dto/update-pricing-tier.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';
import { RecordBillingPaymentDto } from './dto/record-billing-payment.dto';
import { ListBillingCyclesDto } from './dto/list-billing-cycles.dto';
import { SubscribeDto } from './dto/subscribe.dto';
import { MomoPayNowDto } from './dto/momo-pay-now.dto';

import { PaygAuditService } from './services/payg-audit.service';

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
    private readonly momoGatewayService: MomoGatewayService,
    private readonly subscriptionPlanService: SubscriptionPlanService,
    private readonly paygAuditService: PaygAuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('payg-audit')
  @ApiOperation({
    summary: 'Get PAYG active-day trip validation audit breakdown for a fleet',
  })
  async getPaygAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fleetId') fleetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetFleetId = fleetId || user?.fleetId;
    if (!targetFleetId) {
      throw new BadRequestException('Fleet ID is required for PAYG audit');
    }
    if (
      targetFleetId !== user?.fleetId &&
      user?.role !== 'OWNER' &&
      user?.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Access to this fleet billing audit is denied',
      );
    }
    return await this.paygAuditService.getPaygAuditForFleet(
      targetFleetId,
      startDate,
      endDate,
    );
  }

  @Get('inactive-devices')
  @UseGuards(HqGuard)
  @ApiOperation({
    summary: 'HQ: List non-working devices causing revenue risk with fleet admin contacts',
  })
  async getInactiveDevices() {
    return await this.paygAuditService.getRevenueRiskDevices();
  }

  @Get('active-revenue')
  @UseGuards(HqGuard)
  @ApiOperation({
    summary: 'HQ: List active working devices generating daily revenue and MRR',
  })
  async getActiveRevenue() {
    return await this.paygAuditService.getActiveRevenueDevices();
  }

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
  async validateDiscountPublic(@Query('code') code: string) {
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

  @Get('cycles/:id/breakdown')
  @UseGuards(HqGuard)
  @ApiOperation({
    summary: 'HQ: Get full active-days breakdown for a billing cycle',
  })
  async getCycleBreakdown(@Param('id') id: string) {
    return await this.billingCycleService.getCycleBreakdown(id);
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

  // ── MoMo Subscription & Payment Endpoints ────────────────────────

  @Get('plans')
  @Public()
  @ApiOperation({
    summary: 'List all available subscription plans with pricing',
  })
  async getPlans() {
    return await this.subscriptionPlanService.getAllPlans();
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe fleet to a plan with MoMo auto-pay' })
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribeDto,
  ) {
    const subscription = await this.subscriptionPlanService.subscribeToPlan(
      user.fleetId,
      dto.planDuration,
      dto.momoPhoneNumber,
      user,
    );

    // Calculate savings info
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: user.fleetId },
      select: { monthlyRatePerBike: true },
    });
    const bikes = await this.prisma.bike.count({
      where: { fleetId: user.fleetId },
    });
    const baseMonthly = (fleet?.monthlyRatePerBike ?? 10000) * bikes;
    const discountedMonthly =
      this.subscriptionPlanService.calculateDiscountedRate(
        baseMonthly,
        subscription.plan.discountPercent,
      );
    const totalSavings =
      (baseMonthly - discountedMonthly) * subscription.plan.durationMonths;

    return {
      subscription,
      pricing: {
        monthlyRate: discountedMonthly,
        originalMonthlyRate: baseMonthly,
        bikeCount: bikes,
        totalSavings,
      },
    };
  }

  @Put('subscription/cancel')
  @ApiOperation({ summary: 'Cancel auto-renewal of current subscription' })
  async cancelSubscription(@CurrentUser() user: AuthenticatedUser) {
    return await this.subscriptionPlanService.cancelSubscription(
      user.fleetId,
      user,
    );
  }

  @Get('my-subscription')
  @ApiOperation({ summary: 'Get current subscription details' })
  async getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    try {
      const subscription =
        await this.subscriptionPlanService.getFleetSubscription(user.fleetId);
      if (!subscription) {
        return { subscription: null, message: 'No active subscription' };
      }
      return { subscription };
    } catch {
      return { subscription: null, message: 'No active subscription' };
    }
  }

  @Post('my-cycles/:id/pay-now')
  @ApiOperation({ summary: 'Trigger MoMo payment for a billing cycle' })
  async payNow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') cycleId: string,
    @Body() dto: MomoPayNowDto,
  ) {
    const cycle = await this.billingCycleService.getCycle(cycleId);
    if (cycle.fleetId !== user.fleetId) {
      throw new ForbiddenException(
        'You do not have access to this billing cycle',
      );
    }
    if (cycle.status === 'PAID') {
      throw new BadRequestException('This invoice is already fully paid');
    }

    // Determine phone number: explicit > fleet default
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: user.fleetId },
      select: { momoPhoneNumber: true },
    });
    const phone = dto.momoPhoneNumber || fleet?.momoPhoneNumber;
    if (!phone) {
      throw new BadRequestException(
        'No MoMo phone number provided. Set a default in your subscription settings or provide one in the request.',
      );
    }

    const remainingDue = cycle.totalDue - cycle.totalPaid;
    const transaction = await this.momoGatewayService.requestToPay(
      user.fleetId,
      cycleId,
      remainingDue,
      phone,
    );

    const maskedPhone = phone.replace(/(.{3})(.*)(.{3})/, '$1*****$3');
    return {
      transaction,
      message: `A payment prompt has been sent to ${maskedPhone}. Enter your MoMo PIN to complete.`,
    };
  }

  @Get('my-transactions')
  @ApiOperation({ summary: 'List MoMo transaction history for this fleet' })
  async getMyTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    try {
      const [transactions, total] = await Promise.all([
        this.prisma.momoTransaction.findMany({
          where: { fleetId: user.fleetId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.prisma.momoTransaction.count({ where: { fleetId: user.fleetId } }),
      ]);

      return {
        data: transactions,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      };
    } catch {
      return {
        data: [],
        meta: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
        },
      };
    }
  }

  // ── HQ MoMo Admin Endpoints ──────────────────────────────────────

  @Get('momo/transactions')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: List all MoMo transactions globally' })
  async getMomoTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      this.prisma.momoTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { fleet: { select: { id: true, name: true } } },
        skip,
        take: limitNum,
      }),
      this.prisma.momoTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  @Post('momo/retry/:id')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Manually retry a failed MoMo transaction' })
  async retryMomoTransaction(@Param('id') id: string) {
    return await this.momoGatewayService.retryFailedPayment(id);
  }

  @Put('plans/:duration')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: Update a subscription plan discount' })
  async updatePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('duration') duration: SubscriptionPlanDuration,
    @Body()
    body: { discountPercent?: number; isActive?: boolean; label?: string },
  ) {
    return await this.subscriptionPlanService.updatePlan(duration, body, user);
  }

  @Get('momo/stats')
  @UseGuards(HqGuard)
  @ApiOperation({ summary: 'HQ: MoMo payment statistics' })
  async getMomoStats() {
    const [total, successful, failed, pending, totalRevenue] =
      await Promise.all([
        this.prisma.momoTransaction.count(),
        this.prisma.momoTransaction.count({ where: { status: 'SUCCESSFUL' } }),
        this.prisma.momoTransaction.count({ where: { status: 'FAILED' } }),
        this.prisma.momoTransaction.count({ where: { status: 'PENDING' } }),
        this.prisma.momoTransaction.aggregate({
          where: { status: 'SUCCESSFUL' },
          _sum: { amount: true },
        }),
      ]);

    return {
      total,
      successful,
      failed,
      pending,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      totalRevenue: totalRevenue._sum.amount ?? 0,
    };
  }
}
