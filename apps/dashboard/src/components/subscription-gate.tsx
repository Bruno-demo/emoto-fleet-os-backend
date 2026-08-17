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
      title={isInactive ? 'Restore your subscription to continue' : `${lockedLabel} requires plan update`}
      description={
        isInactive
          ? 'Your fleet can still access account settings, but operational dashboard features are paused until the subscription is active again.'
          : 'Your current plan includes core monitoring. Upgrade to unlock advanced controls, reporting, provisioning, and compliance tools.'
      }
      actions={
        <Link
          href={isInactive ? '/settings?tab=fleet#billing' : '/checkout?plan=operations-plus'}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-strong"
          style={{ background: isInactive ? '#EF4444' : '#3B82F6', color: 'white' }}
        >
          <Sparkles size={15} />
          {isInactive ? 'Review subscription' : 'Upgrade plan'}
        </Link>
      }
    >
      <div className="space-y-4">
        {isInactive && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-xs">
            <p className="font-extrabold text-amber-300 text-sm flex items-center gap-2">
              💳 Settle Invoice via MTN Mobile Money
            </p>
            <p className="text-zinc-300 mt-1">
              Dial USSD code <span className="font-mono font-extrabold text-amber-400 select-all">*182*8*1*1347154#</span> on MTN (Recipient: <span className="font-extrabold text-white">BRUNO</span>) to pay your weekly invoice. HQ will immediately restore your fleet access.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <SubscriptionReason
            icon={<Lock size={18} />}
            title={lockedLabel}
            description={
              isInactive
                ? 'Paused while the subscription is not active.'
                : 'Available after upgrading this fleet to Delivery Fleet.'
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
            description="Overview, live map, alerts, events, bikes, riders, and settings remain available on the core plan."
          />
        </div>
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

