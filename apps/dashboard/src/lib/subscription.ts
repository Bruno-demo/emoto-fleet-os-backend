import type { SessionUser } from '@/lib/types/dashboard';

export type DashboardFeature =
  | 'overview'
  | 'live'
  | 'incidents'
  | 'events'
  | 'bikes'
  | 'riders'
  | 'devices'
  | 'zones'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'commands'
  | 'evidence';

export type SubscriptionTier = 'core' | 'premium';

export interface SubscriptionEntitlements {
  tier: SubscriptionTier;
  planLabel: string;
  statusLabel: string;
  isActive: boolean;
  isPremium: boolean;
  allowedFeatures: Set<DashboardFeature>;
}

const CORE_FEATURES: DashboardFeature[] = [
  'overview',
  'live',
  'incidents',
  'events',
  'bikes',
  'riders',
  'settings',
];

const PREMIUM_FEATURES: DashboardFeature[] = [
  ...CORE_FEATURES,
  'devices',
  'zones',
  'reports',
  'audit',
  'commands',
  'evidence',
];

const INACTIVE_FEATURES: DashboardFeature[] = ['settings'];

const PREMIUM_ONLY_LABELS: Partial<Record<DashboardFeature, string>> = {
  devices: 'Device provisioning',
  zones: 'Policy zones',
  reports: 'Trip analytics and reports',
  audit: 'Compliance audit log',
  commands: 'Remote lock and unlock',
  evidence: 'Incident evidence packs',
};

export function getSubscriptionEntitlements(
  user: SessionUser | null | undefined,
): SubscriptionEntitlements {
  const plan = user?.fleetPlan ?? 'DEMO';
  const status = user?.subscriptionStatus ?? 'ACTIVE';
  const isActive = status === 'ACTIVE';
  const isPremium = plan === 'PREMIUM' && isActive;
  const tier: SubscriptionTier = isPremium ? 'premium' : 'core';
  const allowedFeatures = !isActive
    ? INACTIVE_FEATURES
    : isPremium
      ? PREMIUM_FEATURES
      : CORE_FEATURES;

  return {
    tier,
    planLabel: tier === 'premium' ? 'Operations Plus' : 'Safety Core',
    statusLabel: formatSubscriptionStatus(status),
    isActive,
    isPremium,
    allowedFeatures: new Set(allowedFeatures),
  };
}

export function canUseFeature(
  user: SessionUser | null | undefined,
  feature: DashboardFeature,
): boolean {
  return getSubscriptionEntitlements(user).allowedFeatures.has(feature);
}

export function getLockedFeatureLabel(feature: DashboardFeature): string {
  return PREMIUM_ONLY_LABELS[feature] ?? 'Premium feature';
}

export function featureForPath(pathname: string): DashboardFeature {
  if (pathname.startsWith('/live')) return 'live';
  if (pathname.startsWith('/incidents')) return 'incidents';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/bikes')) return 'bikes';
  if (pathname.startsWith('/riders')) return 'riders';
  if (pathname.startsWith('/devices')) return 'devices';
  if (pathname.startsWith('/zones')) return 'zones';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/audit')) return 'audit';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'overview';
}

function formatSubscriptionStatus(status: NonNullable<SessionUser['subscriptionStatus']>) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
