'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { Topbar } from '@/components/layout/topbar';
import { SubscriptionGate } from '@/components/subscription-gate';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { canUseFeature, getSubscriptionEntitlements } from '@/lib/subscription';
import type { Incident, IncidentStats, PaginatedResponse } from '@/lib/types/dashboard';
import { cx } from '@/lib/ui';
import { useTranslation } from '../i18n/LanguageProvider';
import { WifiOff } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const entitlements = getSubscriptionEntitlements(user);
  const canViewIncidents = user?.role !== 'INSURER' && canUseFeature(user, 'incidents');

  const incidentsStatsQuery = useQuery({
    queryKey: ['incidents', 'stats', 'shell'],
    queryFn: () => apiFetch<IncidentStats>('/incidents/stats'),
    refetchInterval: 30_000,
    enabled: canViewIncidents,
  });
  const showBadge = user?.notifOpenIncidents ?? true;
  const openIncidentCount = canViewIncidents && showBadge ? incidentsStatsQuery.data?.open ?? 0 : 0;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        <Topbar
          onOpenSidebar={() => setSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="px-4 py-5 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto max-w-[1600px]">
            {!isOnline && (
              <div className="mb-5 rounded-[20px] border border-warning-ink/25 bg-warning-soft px-5 py-4 text-sm text-warning-ink animate-pulse flex items-center gap-3">
                <WifiOff size={16} className="shrink-0" />
                <div>
                  <p className="font-semibold">{t('you_are_currently_offline')}</p>
                  <p className="mt-1 text-xs text-warning-ink">
                    {t('operational_controls_are_disabled_and_dashboard_data_will_not_refresh_until_your_network_connection_is_restored')}
                  </p>
                </div>
              </div>
            )}
            {user ? (
              <SubscriptionNotice
                isActive={entitlements.isActive}
                isPremium={entitlements.isPremium}
                planLabel={entitlements.planLabel}
                statusLabel={entitlements.statusLabel}
              />
            ) : null}
            <Breadcrumbs />
            <SubscriptionGate>{children}</SubscriptionGate>
          </div>
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/overview') return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const segmentLabels: Record<string, string> = {
    overview: 'Overview',
    bikes: 'Bikes',
    riders: 'Riders',
    trips: 'Trips',
    devices: 'Devices',
    reports: 'Reports',
    events: 'Events',
    incidents: 'Incidents',
    zones: 'Zones',
    financial: 'Financials',
    audit: 'Audit Log',
    settings: 'Settings',
    deliveries: 'Deliveries',
    insurer: 'Insurer Lookup',
  };

  const pathGroups: Record<string, string> = {
    overview: 'Operations',
    live: 'Operations',
    deliveries: 'Operations',
    incidents: 'Operations',
    bikes: 'Fleet',
    riders: 'Fleet',
    trips: 'Fleet',
    devices: 'Fleet',
    reports: 'Intelligence',
    events: 'Intelligence',
    zones: 'Management',
    financial: 'Management',
    audit: 'Management',
    settings: 'Management',
  };

  const breadcrumbs = [];

  const firstSegment = segments[0];
  const group = pathGroups[firstSegment];
  if (group) {
    breadcrumbs.push({ label: group, href: null });
  }

  let currentPath = '';
  segments.forEach((seg, index) => {
    currentPath += `/${seg}`;
    const label = segmentLabels[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
    breadcrumbs.push({
      label,
      href: index === segments.length - 1 ? null : currentPath,
    });
  });

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-xs text-ink-muted bg-surface-muted/30 border border-line/20 rounded-xl px-4 py-2 w-fit">
      <Link href="/overview" className="hover:text-ink transition-colors font-medium">
        Home
      </Link>
      {breadcrumbs.map((bc, idx) => (
        <span key={idx} className="flex items-center gap-1.5 select-none">
          <span className="text-ink-faint">/</span>
          {bc.href ? (
            <Link href={bc.href} className="hover:text-ink transition-colors">
              {bc.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink-soft">{bc.label}</span>
          )}
        </span>
      ))}
    </nav>
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
  const { t } = useTranslation();
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
              ? t('{plan} plan: core dashboard features are active.').replace('{plan}', planLabel)
              : t('Subscription {status}: operational features are paused.').replace('{status}', statusLabel.toLowerCase())}
          </p>
          <p className={cx('mt-1 text-xs leading-5', isActive ? 'text-ink-muted' : 'text-danger-ink')}>
            {isActive
              ? t('Upgrade to Operations Plus for device provisioning, zones, reports, audit logs, evidence packs, and remote commands.')
              : t('Open settings to review the fleet subscription before continuing operations.')}
          </p>
        </div>
        <a
          href={isActive ? '/checkout?plan=operations-plus' : '/settings?tab=fleet#billing'}
          className={cx(
            'inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition',
            isActive
              ? 'bg-accent text-white hover:brightness-110'
              : 'bg-danger-ink text-white hover:brightness-110',
          )}
          style={{ background: isActive ? '#3B82F6' : '#EF4444', color: 'white' }}
        >
          {isActive ? t('Upgrade') : t('Review subscription')}
        </a>
      </div>
    </div>
  );
}

