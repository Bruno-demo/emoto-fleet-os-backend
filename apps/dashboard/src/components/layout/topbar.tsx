'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarDays, Menu, Siren, Wifi } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { Badge } from '@/components/ui/badge';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type {
  Incident,
  LiveBikeState,
  PaginatedResponse,
} from '@/lib/types/dashboard';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { connectionState, recentEvents } = useRealtime();

  const liveBikesQuery = useQuery({
    queryKey: ['live', 'bikes', 'topbar-summary'],
    queryFn: () =>
      apiFetch<PaginatedResponse<LiveBikeState>>('/live/bikes?page=1&pageSize=100'),
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'topbar-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=10'),
  });

  const fleetLabel =
    user?.fleetName?.trim() || (user?.fleetId ? `Fleet ${user.fleetId.slice(0, 8)}` : 'Fleet');

  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
  const routeContext = getRouteContext(pathname);
  const realtimeSummary = getRealtimeSummary(connectionState, recentEvents.length);

  return (
    <header className="sticky top-0 z-[880] border-b border-line bg-surface/92 px-4 py-4 backdrop-blur md:px-6 xl:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex rounded-2xl border border-line bg-white p-2 text-ink-soft shadow-sm hover:bg-surface-hover lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
              {routeContext.eyebrow}
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] font-semibold text-ink">
              {routeContext.title}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {fleetLabel} | {user?.role ?? 'Operator'}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 xl:max-w-4xl xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionIndicator />
            <StatChip
              icon={<Wifi size={14} />}
              label={`${liveBikesQuery.data?.total ?? 0} live bikes`}
              tone="success"
            />
            <StatChip
              icon={<Siren size={14} />}
              label={`${incidentsQuery.data?.total ?? 0} open incidents`}
              tone="danger"
            />
            <StatChip icon={<CalendarDays size={14} />} label={todayLabel} tone="neutral" />
          </div>
          <div className="grid w-full gap-3 xl:max-w-3xl xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
            <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
                Current surface
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">{routeContext.summaryTitle}</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{routeContext.summary}</p>
            </div>
            <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
                <Activity size={14} />
                Realtime status
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{realtimeSummary.title}</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{realtimeSummary.description}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// Maps dashboard routes to operator-facing context so the topbar always reflects the active surface.
function getRouteContext(pathname: string) {
  if (pathname.startsWith('/live')) {
    return {
      eyebrow: 'Command center',
      title: 'Live operations',
      summaryTitle: 'Realtime fleet command',
      summary: 'Track bike movement, recent alerts, and command outcomes from one operational surface.',
    };
  }
  if (pathname.startsWith('/incidents')) {
    return {
      eyebrow: 'Incident desk',
      title: 'Incidents',
      summaryTitle: 'Crash, theft, and SOS triage',
      summary: 'Review open incidents, move them through acknowledgement, and keep evidence collection in view.',
    };
  }
  if (pathname.startsWith('/bikes')) {
    return {
      eyebrow: 'Fleet assets',
      title: 'Bikes',
      summaryTitle: 'Bike health and assignment view',
      summary: 'Inspect bike status, linked devices, recent trips, and command history without leaving the fleet scope.',
    };
  }
  if (pathname.startsWith('/devices')) {
    return {
      eyebrow: 'Provisioning',
      title: 'Devices',
      summaryTitle: 'Provision and assign hardware',
      summary: 'Create devices, rotate credentials, and keep hardware assignments aligned with the active bike roster.',
    };
  }
  if (pathname.startsWith('/events')) {
    return {
      eyebrow: 'Risk signals',
      title: 'Events',
      summaryTitle: 'Event stream and filters',
      summary: 'Filter operational events by time, severity, or bike to isolate the highest-risk patterns quickly.',
    };
  }
  if (pathname.startsWith('/zones')) {
    return {
      eyebrow: 'Policy controls',
      title: 'Zones',
      summaryTitle: 'Geofences and speed rules',
      summary: 'Maintain slow, no-go, and park zones so downstream event detection stays aligned with fleet policy.',
    };
  }
  if (pathname.startsWith('/reports')) {
    return {
      eyebrow: 'Reporting',
      title: 'Reports',
      summaryTitle: 'Weekly fleet performance',
      summary: 'Review aggregate score trends, risky bikes, and operational counts for the selected reporting window.',
    };
  }
  return {
    eyebrow: 'Fleet overview',
    title: 'Overview',
    summaryTitle: 'Daily operating snapshot',
    summary: 'Use the overview to spot changes in score, incidents, and fleet readiness before drilling into detail pages.',
  };
}

// Converts websocket health into concise operator guidance instead of static placeholder copy.
function getRealtimeSummary(
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'offline',
  bufferedEvents: number,
) {
  if (connectionState === 'connected') {
    return {
      title: 'Live stream healthy',
      description: `${bufferedEvents} recent event${bufferedEvents === 1 ? '' : 's'} buffered for quick triage.`,
    };
  }
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return {
      title: 'Reconnect in progress',
      description:
        'Cached API data remains visible while the websocket transport restores live bike and event updates.',
    };
  }
  return {
    title: 'Realtime unavailable',
    description:
      'The dashboard is running on API snapshots only. Use page-level refresh actions until the socket reconnects.',
  };
}

function StatChip({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: 'success' | 'danger' | 'neutral';
}) {
  return (
    <Badge
      label={label}
      icon={icon}
      tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'neutral'}
    />
  );
}
