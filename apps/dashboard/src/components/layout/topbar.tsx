'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Menu, Siren, Wifi } from 'lucide-react';
import { useState } from 'react';
import { ConnectionIndicator } from '@/components/ui/connection-indicator';
import { Badge } from '@/components/ui/badge';
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
  const [searchQuery, setSearchQuery] = useState('');
  const { data: user } = useCurrentUser();

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
              Fleet operations
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.5rem,1.25rem+1vw,2rem)] font-semibold text-ink">
              {fleetLabel}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">Role: {user?.role ?? 'Operator'}</p>
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
          <label className="block w-full xl:max-w-xl">
            <span className="sr-only">Context search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search is visual-only for now. Use page filters for exact results."
              className="w-full rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-3 text-sm text-ink placeholder:text-ink-muted"
            />
          </label>
        </div>
      </div>
    </header>
  );
}

function StatChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
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
