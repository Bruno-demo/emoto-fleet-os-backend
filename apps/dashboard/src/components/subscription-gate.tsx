'use client';

import Link from 'next/link';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import {
  canUseFeature,
  featureForPath,
  getLockedFeatureLabel,
  getSubscriptionEntitlements,
} from '@/lib/subscription';

export function SubscriptionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: user, isLoading } = useCurrentUser();
  const feature = featureForPath(pathname);

  if (isLoading || !user) {
    return (
      <DashboardCard
        eyebrow="Subscription"
        title="Checking dashboard access"
        description="Loading the current fleet plan before opening this workspace."
      >
        <div className="h-1.5 w-36 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-accent/60" />
        </div>
      </DashboardCard>
    );
  }

  if (canUseFeature(user, feature)) {
    return <>{children}</>;
  }

  const entitlements = getSubscriptionEntitlements(user);
  const lockedLabel = getLockedFeatureLabel(feature);
  const isInactive = !entitlements.isActive;

  return (
    <DashboardCard
      eyebrow={isInactive ? 'Subscription inactive' : 'Upgrade required'}
      title={isInactive ? 'Restore your subscription to continue' : `${lockedLabel} is on Operations Plus`}
      description={
        isInactive
          ? 'Your fleet can still access account settings, but operational dashboard features are paused until the subscription is active again.'
          : 'Your current plan includes core monitoring. Upgrade to unlock advanced controls, reporting, provisioning, and compliance tools.'
      }
      actions={
        <Link
          href={isInactive ? '/settings' : '/checkout?plan=operations-plus'}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
        >
          <Sparkles size={15} />
          {isInactive ? 'Review subscription' : 'Upgrade plan'}
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <SubscriptionReason
          icon={<Lock size={18} />}
          title={lockedLabel}
          description={
            isInactive
              ? 'Paused while the subscription is not active.'
              : 'Available after upgrading this fleet to Operations Plus.'
          }
        />
        <SubscriptionReason
          icon={<ShieldCheck size={18} />}
          title={entitlements.planLabel}
          description={`Current plan: ${entitlements.planLabel}. Status: ${entitlements.statusLabel}.`}
        />
        <SubscriptionReason
          icon={<Sparkles size={18} />}
          title="Included now"
          description="Overview, live map, alerts, incidents, events, bikes, riders, and settings remain available on the core plan."
        />
      </div>
    </DashboardCard>
  );
}

function SubscriptionReason({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface-muted px-5 py-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold text-ink">{title}</p>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{description}</p>
    </div>
  );
}

