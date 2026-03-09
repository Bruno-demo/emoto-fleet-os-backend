'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
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
  const crashAndSosCount = (report?.eventCounts.CRASH ?? 0) + (report?.eventCounts.SOS ?? 0);

  return (
    <PageShell
      title="Reports"
      description="Weekly KPI reporting for dispatch and risk teams, using the backend fleet summary and the same trip scoring already used in the rider experience."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Average Score"
          value={report ? report.avgScore.toFixed(1) : '--'}
          hint="Fleet-wide trip score across the current weekly range."
          icon={<TrendingUp size={18} />}
          tone="info"
        />
        <KpiCard
          title="Trip Count"
          value={report ? String(report.tripCount) : '--'}
          hint="Trips included in the current weekly summary window."
          icon={<Activity size={18} />}
          tone="success"
        />
        <KpiCard
          title="Overspeed Events"
          value={report ? String(report.eventCounts.OVERSPEED ?? 0) : '--'}
          hint="Overspeed rule hits recorded during the same range."
          icon={<AlertTriangle size={18} />}
          tone="warning"
        />
        <KpiCard
          title="Crash / SOS"
          value={String(crashAndSosCount || '--')}
          hint="High-priority safety incidents requiring rapid dispatcher review."
          icon={<AlertCircle size={18} />}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Risk Ranking
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                Top risky bikes
              </h2>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              Weekly
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            {(report?.topRiskyBikes ?? []).map((bike, index) => (
              <li
                key={bike.bikeId}
                className="rounded-[24px] border border-line bg-surface-muted px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-soft">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">{bike.label}</p>
                      <StatusPill
                        label={`Score ${bike.avgScore.toFixed(1)}`}
                        tone={bike.avgScore < 70 ? 'danger' : 'warning'}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {bike.tripCount} trips · {bike.eventCount} events
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full ${
                          bike.avgScore >= 85
                            ? 'bg-emerald-500'
                            : bike.avgScore >= 70
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, Math.min(100, bike.avgScore))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {(report?.topRiskyBikes ?? []).length === 0 ? (
              <li className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-ink-soft">
                No bike risk data yet.
              </li>
            ) : null}
          </ul>
        </article>

        <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Rider Ranking
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
                Top risky riders
              </h2>
            </div>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-soft">
              Weekly
            </span>
          </div>

          <ul className="mt-5 space-y-3">
            {(report?.topRiskyRiders ?? []).map((rider, index) => (
              <li
                key={rider.riderId}
                className="rounded-[24px] border border-line bg-surface-muted px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-soft">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">
                        Rider {rider.riderId.slice(0, 8)}
                      </p>
                      <StatusPill
                        label={`Score ${rider.avgScore.toFixed(1)}`}
                        tone={rider.avgScore < 70 ? 'danger' : 'warning'}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{rider.tripCount} trips</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full ${
                          rider.avgScore >= 85
                            ? 'bg-emerald-500'
                            : rider.avgScore >= 70
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(5, Math.min(100, rider.avgScore))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {(report?.topRiskyRiders ?? []).length === 0 ? (
              <li className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-ink-soft">
                No rider risk data yet.
              </li>
            ) : null}
          </ul>
        </article>
      </section>

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Event Breakdown
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Weekly incident mix
            </h2>
          </div>
          {report?.range ? (
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-soft">
              {new Date(report.range.from).toLocaleDateString()} -{' '}
              {new Date(report.range.to).toLocaleDateString()}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(report?.eventCounts ?? {}).map(([type, count]) => (
            <div
              key={type}
              className="rounded-[24px] border border-line bg-surface-muted px-4 py-4"
            >
              <p className="text-sm font-medium text-ink">{formatLabel(type)}</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{count}</p>
            </div>
          ))}
          {report && Object.keys(report.eventCounts).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-ink-soft sm:col-span-2 xl:col-span-4">
              No event counts are available for the current reporting range.
            </div>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'info' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-700'
      : tone === 'warning'
        ? 'bg-warning-soft text-amber-700'
        : tone === 'danger'
          ? 'bg-danger-soft text-rose-700'
          : 'bg-accent-soft text-accent';

  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            {title}
          </p>
          <p className="mt-4 font-display text-4xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-soft">{hint}</p>
    </article>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
