import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FleetPlan, FleetSubscriptionStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  SUBSCRIPTION_FEATURE_KEY,
  type SubscriptionFeature,
} from './subscription-feature.decorator';

const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  devices: 'Device provisioning',
  zones: 'Policy zones',
  reports: 'Trip analytics and reports',
  audit: 'Compliance audit log',
  commands: 'Remote lock and unlock',
  evidence: 'Incident evidence packs',
  financial: 'Financial management',
};

@Injectable()
export class SubscriptionFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<
      SubscriptionFeature | undefined
    >(SUBSCRIPTION_FEATURE_KEY, [context.getHandler(), context.getClass()]);

    if (!feature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Unauthenticated request');
    }

    const isAllowed =
      user.subscriptionStatus === FleetSubscriptionStatus.ACTIVE &&
      (feature === 'commands' ||
        feature === 'reports' ||
        feature === 'devices' ||
        user.fleetPlan === FleetPlan.DEMO ||
        user.fleetPlan === FleetPlan.PREMIUM ||
        user.fleetPlan === FleetPlan.INSURANCE);

    if (isAllowed) {
      return true;
    }

    throw new ForbiddenException(
      `${FEATURE_LABELS[feature]} requires an active Operations Plus subscription`,
    );
  }
}
