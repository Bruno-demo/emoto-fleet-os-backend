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
  | 'evidence'
  | 'financial'
  | 'deliveries';

export type SubscriptionTier = 'core' | 'premium' | 'insurance';

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
  'events',
  'bikes',
  'riders',
  'zones',
  'settings',
  'deliveries',
];

const PREMIUM_FEATURES: DashboardFeature[] = [
  ...CORE_FEATURES,
  'incidents',
  'commands',
  'devices',
  'reports',
  'audit',
  'evidence',
  'financial',
];

const DEMO_FEATURES: DashboardFeature[] = [
  ...CORE_FEATURES,
];

const INACTIVE_FEATURES: DashboardFeature[] = ['settings'];

const PREMIUM_ONLY_LABELS: Partial<Record<DashboardFeature, string>> = {
  incidents: 'Incident & crash management',
  commands: 'Remote commands',
  devices: 'Device provisioning',
  reports: 'Trip analytics and reports',
  audit: 'Compliance audit log',
  evidence: 'Incident evidence packs',
  financial: 'Financial management',
};

export function getSubscriptionEntitlements(
  user: SessionUser | null | undefined,
): SubscriptionEntitlements {
  const status = user?.subscriptionStatus ?? 'ACTIVE';
  const isActive = status === 'ACTIVE';
  const tier: SubscriptionTier = isActive ? 'premium' : 'core';
  const allowedFeatures = !isActive ? INACTIVE_FEATURES : PREMIUM_FEATURES;

  return {
    tier,
    planLabel: 'Pay-As-You-Go Plan',
    statusLabel: formatSubscriptionStatus(status),
    isActive,
    isPremium: true,
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
  if (pathname.startsWith('/financial')) return 'financial';
  if (pathname.startsWith('/deliveries')) return 'deliveries';
  return 'overview';
}

function formatSubscriptionStatus(status: NonNullable<SessionUser['subscriptionStatus']>) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
