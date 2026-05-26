'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { Topbar } from '@/components/layout/topbar';
import { SubscriptionGate } from '@/components/subscription-gate';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { canUseFeature, getSubscriptionEntitlements } from '@/lib/subscription';
import type { Incident, IncidentStats, PaginatedResponse } from '@/lib/types/dashboard';
import { cx } from '@/lib/ui';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: user } = useCurrentUser();
  const entitlements = getSubscriptionEntitlements(user);
  const canViewIncidents = canUseFeature(user, 'incidents');

  const incidentsStatsQuery = useQuery({
    queryKey: ['incidents', 'stats', 'shell'],
    queryFn: () => apiFetch<IncidentStats>('/incidents/stats'),
    refetchInterval: 30_000,
    enabled: canViewIncidents,
  });
  const openIncidentCount = canViewIncidents ? incidentsStatsQuery.data?.open ?? 0 : 0;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarOpen(false);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav
        collapsed={sidebarCollapsed}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        openIncidentCount={openIncidentCount}
      />
      <div
        className={cx(
          'min-h-screen bg-background transition-[padding] duration-300',
          sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-[272px]',
        )}
      >
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="px-4 py-5 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto max-w-[1600px]">
            {user ? (
              <SubscriptionNotice
                isActive={entitlements.isActive}
                isPremium={entitlements.isPremium}
                planLabel={entitlements.planLabel}
                statusLabel={entitlements.statusLabel}
              />
            ) : null}
            <SubscriptionGate>{children}</SubscriptionGate>
          </div>
        </main>
      </div>
    </div>
  );
}

function SubscriptionNotice({
  isActive,
  isPremium,
  planLabel,
  statusLabel,
}: {
  isActive: boolean;
  isPremium: boolean;
  planLabel: string;
  statusLabel: string;
}) {
  if (isPremium && isActive) {
    return null;
  }

  return (
    <div
      className={cx(
        'mb-5 rounded-[20px] border px-5 py-4 text-sm',
        isActive
          ? 'border-accent/20 bg-accent/10 text-ink'
          : 'border-danger-ink/25 bg-danger-soft text-danger-ink',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">
            {isActive
              ? `${planLabel} plan: core dashboard features are active.`
              : `Subscription ${statusLabel.toLowerCase()}: operational features are paused.`}
          </p>
          <p className={cx('mt-1 text-xs leading-5', isActive ? 'text-ink-muted' : 'text-danger-ink')}>
            {isActive
              ? 'Upgrade to Operations Plus for device provisioning, zones, reports, audit logs, evidence packs, and remote commands.'
              : 'Open settings to review the fleet subscription before continuing operations.'}
          </p>
        </div>
        <a
          href={isActive ? '/checkout?plan=operations-plus' : '/settings'}
          className={cx(
            'inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition',
            isActive
              ? 'bg-accent text-white hover:brightness-110'
              : 'bg-danger-ink text-white hover:brightness-110',
          )}
          style={{ background: isActive ? '#3B82F6' : '#EF4444', color: 'white' }}
        >
          {isActive ? 'Upgrade' : 'Review subscription'}
        </a>
      </div>
    </div>
  );
}

