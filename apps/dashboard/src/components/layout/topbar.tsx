'use client';

import { useQuery } from '@tanstack/react-query';
import { Menu, Siren } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type {
  Incident,
  PaginatedResponse,
} from '@/lib/types/dashboard';

interface TopbarProps {
  onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'topbar-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=10'),
  });

  const fleetLabel =
    user?.fleetName?.trim() || (user?.fleetId ? `Fleet ${user.fleetId.slice(0, 8)}` : 'Fleet');

  const routeContext = getRouteContext(pathname);

  return (
    <header className="sticky top-0 z-[880] border-b border-line bg-surface/92 px-4 py-2.5 backdrop-blur md:px-6 xl:px-8">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex rounded-2xl border border-line bg-white p-2 text-ink-soft shadow-sm hover:bg-surface-hover lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
              {routeContext.eyebrow}
            </p>
            <h1 className="mt-1 truncate font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] font-semibold text-ink">
              {routeContext.title}
            </h1>
            <p className="mt-1 truncate text-sm text-ink-soft">
              {fleetLabel} | {user?.role ?? 'Operator'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ConnectionIndicator />
          <StatChip
            icon={<Siren size={14} />}
            label={`${incidentsQuery.data?.total ?? 0} open incidents`}
            tone="danger"
          />
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
    };
  }
  if (pathname.startsWith('/incidents')) {
    return {
      eyebrow: 'Incident desk',
      title: 'Incidents',
    };
  }
  if (pathname.startsWith('/bikes')) {
    return {
      eyebrow: 'Fleet assets',
      title: 'Bikes',
    };
  }
  if (pathname.startsWith('/devices')) {
    return {
      eyebrow: 'Provisioning',
      title: 'Devices',
    };
  }
  if (pathname.startsWith('/events')) {
    return {
      eyebrow: 'Risk signals',
      title: 'Events',
    };
  }
  if (pathname.startsWith('/zones')) {
    return {
      eyebrow: 'Policy controls',
      title: 'Zones',
    };
  }
  if (pathname.startsWith('/reports')) {
    return {
      eyebrow: 'Reporting',
      title: 'Reports',
    };
  }
  return {
    eyebrow: 'Fleet overview',
    title: 'Overview',
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
