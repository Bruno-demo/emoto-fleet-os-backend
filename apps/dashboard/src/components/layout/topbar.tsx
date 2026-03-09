'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Search, Siren, Wifi } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type {
  Incident,
  LiveBikeState,
  PaginatedResponse,
} from '@/lib/types/dashboard';

export function Topbar() {
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
    <header className="border-b border-line bg-white/92 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">
            Fleet Operations
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{fleetLabel}</h1>
        </div>

        <div className="flex flex-1 flex-col gap-3 xl:max-w-3xl xl:flex-row xl:items-center xl:justify-end">
          <label className="relative block xl:min-w-[340px] xl:flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search bike label, plate, rider, or device..."
              className="w-full rounded-2xl border border-line bg-surface-muted py-3 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <StatChip
              icon={<Wifi size={15} />}
              label={`${liveBikesQuery.data?.total ?? 0} Bikes Online`}
              tone="success"
            />
            <StatChip
              icon={<Siren size={15} />}
              label={`${incidentsQuery.data?.total ?? 0} Active Alerts`}
              tone="danger"
            />
            <StatChip icon={<CalendarDays size={15} />} label={todayLabel} tone="neutral" />
          </div>
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
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-800'
      : tone === 'danger'
        ? 'bg-danger-soft text-rose-800'
        : 'bg-surface-muted text-ink';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${toneClass}`}
    >
      {icon}
      {label}
    </span>
  );
}
