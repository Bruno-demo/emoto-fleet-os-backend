import { SetMetadata } from '@nestjs/common';

export const SUBSCRIPTION_FEATURE_KEY = 'subscriptionFeature';

export type SubscriptionFeature =
  | 'devices'
  | 'zones'
  | 'reports'
  | 'audit'
  | 'commands'
  | 'evidence';

export const RequireSubscriptionFeature = (
  feature: SubscriptionFeature,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(SUBSCRIPTION_FEATURE_KEY, feature);
