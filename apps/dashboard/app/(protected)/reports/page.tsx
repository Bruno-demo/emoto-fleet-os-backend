'use client';

import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@/components/layout/page-shell';
import { StatusPill } from '@/components/ui/status-pill';
import { apiFetch } from '@/lib/api/client';
import type { WeeklyReport } from '@/lib/types/dashboard';

export default function ReportsPage() {
  const reportQuery = useQuery({
    queryKey: ['reports', 'weekly'],
    queryFn: () => apiFetch<WeeklyReport>('/reports/weekly'),
  });

  const report = reportQuery.data;

  return (
    <PageShell
      title="Reports"
      description="Weekly fleet KPIs from `/reports/weekly` for dashboard reporting."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Trips" value={report ? String(report.tripCount) : '--'} />
        <MetricCard
          title="Average Score"
          value={report ? report.avgScore.toFixed(2) : '--'}
        />
        <MetricCard
          title="Overspeed Events"
          value={report ? String(report.eventCounts.OVERSPEED ?? 0) : '--'}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Top Risky Bikes</h2>
          <ul className="mt-3 space-y-2">
            {(report?.topRiskyBikes ?? []).map((bike) => (
              <li key={bike.bikeId} className="rounded-xl border border-line bg-surface-muted p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{bike.label}</p>
                  <StatusPill label={`Score ${bike.avgScore.toFixed(1)}`} tone="warning" />
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {bike.tripCount} trips • {bike.eventCount} events
                </p>
              </li>
            ))}
            {(report?.topRiskyBikes ?? []).length === 0 ? (
              <li className="text-sm text-ink-soft">No bike risk data yet.</li>
            ) : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Top Risky Riders</h2>
          <ul className="mt-3 space-y-2">
            {(report?.topRiskyRiders ?? []).map((rider) => (
              <li
                key={rider.riderId}
                className="rounded-xl border border-line bg-surface-muted p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{rider.riderId.slice(0, 8)}...</p>
                  <StatusPill
                    label={`Score ${rider.avgScore.toFixed(1)}`}
                    tone={rider.avgScore < 70 ? 'danger' : 'warning'}
                  />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{rider.tripCount} trips</p>
              </li>
            ))}
            {(report?.topRiskyRiders ?? []).length === 0 ? (
              <li className="text-sm text-ink-soft">No rider risk data yet.</li>
            ) : null}
          </ul>
        </article>
      </section>
    </PageShell>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">{title}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink">{value}</p>
    </article>
  );
}
