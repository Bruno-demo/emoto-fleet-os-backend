import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SubscriptionPlanDuration, AuditActionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';

const DEFAULT_PLANS = [
  {
    duration: SubscriptionPlanDuration.MONTHLY,
    durationMonths: 1,
    label: 'Monthly',
    discountPercent: 0,
    sortOrder: 0,
  },
  {
    duration: SubscriptionPlanDuration.QUARTERLY,
    durationMonths: 3,
    label: '3 Months',
    discountPercent: 5,
    sortOrder: 1,
  },
  {
    duration: SubscriptionPlanDuration.SEMI_ANNUAL,
    durationMonths: 6,
    label: '6 Months',
    discountPercent: 10,
    sortOrder: 2,
  },
  {
    duration: SubscriptionPlanDuration.ANNUAL,
    durationMonths: 12,
    label: '1 Year',
    discountPercent: 15,
    sortOrder: 3,
  },
  {
    duration: SubscriptionPlanDuration.BIENNIAL,
    durationMonths: 24,
    label: '2 Years',
    discountPercent: 20,
    sortOrder: 4,
  },
];

@Injectable()
export class SubscriptionPlanService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPlans();
  }

  /**
   * Get all active subscription plans, sorted by sortOrder.
   */
  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get all plans including inactive (for HQ admin).
   */
  async getAllPlansAdmin() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Seed default subscription plans if none exist.
   */
  async seedDefaultPlans() {
    const existing = await this.prisma.subscriptionPlan.count();
    if (existing > 0) {
      this.logger.log('Subscription plans already exist, skipping seed.');
      return;
    }

    this.logger.log('Seeding default subscription plans...');
    for (const plan of DEFAULT_PLANS) {
      await this.prisma.subscriptionPlan.create({ data: plan });
    }
    this.logger.log(`Seeded ${DEFAULT_PLANS.length} subscription plans.`);
  }

  /**
   * Update a subscription plan's discount percentage (HQ admin).
   */
  async updatePlan(
    duration: SubscriptionPlanDuration,
    data: { discountPercent?: number; isActive?: boolean; label?: string },
    user: AuthenticatedUser,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { duration },
    });

    if (!plan) {
      throw new NotFoundException(`Subscription plan ${duration} not found`);
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { duration },
      data,
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: 'SUBSCRIPTION_CREATED' as AuditActionType, // Closest available type
      targetType: 'SubscriptionPlan',
      targetId: plan.id,
      metaJson: { changes: data },
    });

    return updated;
  }

  /**
   * Subscribe a fleet to a plan. Creates FleetSubscription and updates fleet auto-pay settings.
   */
  async subscribeToPlan(
    fleetId: string,
    planDuration: SubscriptionPlanDuration,
    momoPhoneNumber: string,
    user: AuthenticatedUser,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { duration: planDuration },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException(
        `Subscription plan ${planDuration} is not available`,
      );
    }

    // Deactivate any existing active subscription
    await this.prisma.fleetSubscription.updateMany({
      where: { fleetId, isActive: true },
      data: { isActive: false, cancelledAt: new Date() },
    });

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    const subscription = await this.prisma.fleetSubscription.create({
      data: {
        fleetId,
        planId: plan.id,
        startDate: now,
        endDate,
        autoRenew: true,
        momoPhoneNumber,
      },
      include: { plan: true },
    });

    // Update fleet auto-pay settings
    await this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        autoPayEnabled: true,
        momoPhoneNumber,
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.SUBSCRIPTION_CREATED,
      targetType: 'FleetSubscription',
      targetId: subscription.id,
      metaJson: {
        planDuration,
        discountPercent: plan.discountPercent,
        momoPhoneNumber,
        startDate: now,
        endDate,
      },
    });

    return subscription;
  }

  /**
   * Cancel a fleet's active subscription (stop auto-renewal).
   */
  async cancelSubscription(fleetId: string, user: AuthenticatedUser) {
    const subscription = await this.prisma.fleetSubscription.findFirst({
      where: { fleetId, isActive: true },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const updated = await this.prisma.fleetSubscription.update({
      where: { id: subscription.id },
      data: { autoRenew: false, cancelledAt: new Date() },
      include: { plan: true },
    });

    // Disable auto-pay on fleet
    await this.prisma.fleet.update({
      where: { id: fleetId },
      data: { autoPayEnabled: false },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.SUBSCRIPTION_CANCELLED,
      targetType: 'FleetSubscription',
      targetId: subscription.id,
      metaJson: { cancelledAt: new Date() },
    });

    return updated;
  }

  /**
   * Get the active subscription for a fleet.
   */
  async getFleetSubscription(fleetId: string) {
    return this.prisma.fleetSubscription.findFirst({
      where: { fleetId, isActive: true },
      include: { plan: true },
    });
  }

  /**
   * Calculate the discounted monthly rate for a fleet on a given plan.
   */
  calculateDiscountedRate(
    monthlyRate: number,
    discountPercent: number,
  ): number {
    return Math.round(monthlyRate * (1 - discountPercent / 100));
  }
}
