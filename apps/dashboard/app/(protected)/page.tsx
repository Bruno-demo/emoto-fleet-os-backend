'use client';

import { useQuery } from '@tanstack/react-query';
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
      apiFetch<PaginatedResponse<Incident>>(
        '/incidents?status=OPEN&page=1&pageSize=20',
      ),
  });

  const report = weeklyReportQuery.data;
  const openIncidents = incidentsQuery.data?.total ?? 0;

  return (
    <PageShell
      title="Overview"
      description="Weekly fleet KPI summary and current open-risk snapshot."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Weekly Trips"
          value={report ? String(report.tripCount) : '--'}
          hint="Trips in rolling 7-day window"
        />
        <MetricCard
          title="Average Score"
          value={report ? report.avgScore.toFixed(2) : '--'}
          hint="Fleet average driving score"
        />
        <MetricCard
          title="Open Incidents"
          value={String(openIncidents)}
          hint="Current unresolved incidents"
        />
        <MetricCard
          title="Crash Events"
          value={String(report?.eventCounts.CRASH ?? '--')}
          hint="Weekly crash event count"
        />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Top Risky Bikes</h2>
          <ul className="mt-3 space-y-2">
            {(report?.topRiskyBikes ?? []).slice(0, 5).map((bike) => (
              <li
                key={bike.bikeId}
                className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{bike.label}</p>
                  <p className="text-xs text-ink-soft">{bike.tripCount} trips</p>
                </div>
                <StatusPill label={`Score ${bike.avgScore.toFixed(1)}`} tone="warning" />
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Top Risky Riders</h2>
          <ul className="mt-3 space-y-2">
            {(report?.topRiskyRiders ?? []).slice(0, 5).map((rider) => (
              <li
                key={rider.riderId}
                className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{rider.riderId.slice(0, 8)}...</p>
                  <p className="text-xs text-ink-soft">{rider.tripCount} trips</p>
                </div>
                <StatusPill
                  label={`Score ${rider.avgScore.toFixed(1)}`}
                  tone={rider.avgScore < 70 ? 'danger' : 'warning'}
                />
              </li>
            ))}
          </ul>
        </article>
      </section>
    </PageShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{title}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-ink-soft">{hint}</p>
    </article>
  );
}
