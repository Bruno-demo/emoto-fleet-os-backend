'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bike,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { StatusPill } from '@/components/ui/status-pill';
import { apiFetch } from '@/lib/api/client';
import type {
  Incident,
  PaginatedResponse,
  WeeklyReport,
} from '@/lib/types/dashboard';

export default function OverviewPage() {
  const weeklyReportQuery = useQuery({
    queryKey: ['reports', 'weekly'],
    queryFn: () => apiFetch<WeeklyReport>('/reports/weekly'),
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=20'),
  });

  const report = weeklyReportQuery.data;
  const openIncidents = incidentsQuery.data?.total ?? 0;

  return (
    <PageShell
      title="Overview"
      description="Weekly fleet pulse, open-risk visibility, and the bikes or riders that need dispatcher attention first."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Weekly Trips"
          value={report ? String(report.tripCount) : '--'}
          hint="Trips recorded in the current rolling seven-day window."
          accent="blue"
          icon={<Bike size={18} />}
        />
        <MetricCard
          title="Average Score"
          value={report ? report.avgScore.toFixed(1) : '--'}
          hint="Fleet-wide driving score across completed trips."
          accent="emerald"
          icon={<TrendingUp size={18} />}
        />
        <MetricCard
          title="Open Incidents"
          value={String(openIncidents)}
          hint="Incidents still awaiting acknowledgement or resolution."
          accent="rose"
          icon={<ShieldAlert size={18} />}
        />
        <MetricCard
          title="Crash Events"
          value={String(report?.eventCounts.CRASH ?? '--')}
          hint="Crash detections created during the weekly reporting period."
          accent="amber"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Event Mix
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                Weekly risk distribution
              </h2>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              Rolling 7 days
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(report?.eventCounts ?? {}).map(([type, count]) => (
              <div
                key={type}
                className="rounded-2xl border border-line bg-surface-muted px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{formatLabel(type)}</p>
                  <Activity size={16} className="text-accent" />
                </div>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">{count}</p>
              </div>
            ))}
            {report && Object.keys(report.eventCounts).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-ink-soft sm:col-span-2">
                No event activity for the current weekly range.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Dispatcher Watchlist
          </p>
          <div className="mt-4 space-y-5">
            <WatchlistSection
              title="Top Risky Bikes"
              emptyLabel="No risky bikes in this range."
              items={(report?.topRiskyBikes ?? []).slice(0, 5).map((bike) => ({
                id: bike.bikeId,
                title: bike.label,
                subtitle: `${bike.tripCount} trips · ${bike.eventCount} events`,
                score: bike.avgScore,
              }))}
            />

            <WatchlistSection
              title="Top Risky Riders"
              emptyLabel="No risky riders in this range."
              items={(report?.topRiskyRiders ?? []).slice(0, 5).map((rider) => ({
                id: rider.riderId,
                title: `Rider ${rider.riderId.slice(0, 8)}`,
                subtitle: `${rider.tripCount} trips`,
                score: rider.avgScore,
              }))}
            />
          </div>
        </article>
      </section>
    </PageShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent: 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const accentClass =
    accent === 'blue'
      ? 'bg-accent-soft text-accent'
      : accent === 'emerald'
        ? 'bg-success-soft text-emerald-700'
        : accent === 'rose'
          ? 'bg-danger-soft text-rose-700'
          : 'bg-warning-soft text-amber-700';

  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            {title}
          </p>
          <p className="mt-4 font-display text-4xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${accentClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-soft">{hint}</p>
    </article>
  );
}

function WatchlistSection({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    score: number;
  }>;
}) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <span className="text-xs uppercase tracking-[0.16em] text-ink-soft">Priority</span>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface-muted px-4 py-3"
          >
            <div>
              <p className="font-medium text-ink">{item.title}</p>
              <p className="mt-1 text-xs text-ink-soft">{item.subtitle}</p>
            </div>
            <StatusPill
              label={`Score ${item.score.toFixed(1)}`}
              tone={item.score < 70 ? 'danger' : 'warning'}
            />
          </li>
        ))}
        {items.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">
            {emptyLabel}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
