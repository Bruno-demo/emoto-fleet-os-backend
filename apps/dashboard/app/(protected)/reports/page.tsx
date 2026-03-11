'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { WeeklyReport } from '@/lib/types/dashboard';
import { formatEnumLabel } from '@/lib/ui';

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
      description="Weekly KPI reporting for dispatch and risk teams, using the same fleet summary, scoring, and event models that power the command center."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportQuery.isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Average Score"
              value={report ? report.avgScore.toFixed(1) : '--'}
              hint="Fleet-wide trip score across the current weekly range."
              icon={<TrendingUp size={18} />}
              tone="info"
            />
            <MetricCard
              title="Trip Count"
              value={report ? String(report.tripCount) : '--'}
              hint="Trips included in the current weekly summary window."
              icon={<Activity size={18} />}
              tone="success"
            />
            <MetricCard
              title="Overspeed Events"
              value={report ? String(report.eventCounts.OVERSPEED ?? 0) : '--'}
              hint="Overspeed rule hits recorded during the same range."
              icon={<AlertTriangle size={18} />}
              tone="warning"
            />
            <MetricCard
              title="Crash / SOS"
              value={report ? String(crashAndSosCount) : '--'}
              hint="High-priority safety incidents requiring rapid dispatcher review."
              icon={<AlertCircle size={18} />}
              tone="danger"
            />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardCard
          eyebrow="Risk Ranking"
          title="Top risky bikes"
          description="Bikes with the weakest scores and the highest event counts in the current weekly range."
        >
          {reportQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
            </div>
          ) : (report?.topRiskyBikes ?? []).length ? (
            <ul className="space-y-3">
              {(report?.topRiskyBikes ?? []).map((bike, index) => (
                <li
                  key={bike.bikeId}
                  className="rounded-[20px] border border-line bg-surface-muted px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-soft">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-ink">{bike.label}</p>
                        <ScorePill score={bike.avgScore} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-ink-soft">
                        {bike.tripCount} trips · {bike.eventCount} events
                      </p>
                      <ScoreBar score={bike.avgScore} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Activity size={18} />}
              title="No bike risk data yet"
              description="Weekly bike risk rankings will appear once trips and events are available."
            />
          )}
        </DashboardCard>

        <DashboardCard
          eyebrow="Rider Ranking"
          title="Top risky riders"
          description="Rider aggregates from the weekly summary, useful for coaching and insurer review."
        >
          {reportQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
              <Skeleton className="h-20 w-full rounded-[20px]" />
            </div>
          ) : (report?.topRiskyRiders ?? []).length ? (
            <ul className="space-y-3">
              {(report?.topRiskyRiders ?? []).map((rider, index) => (
                <li
                  key={rider.riderId}
                  className="rounded-[20px] border border-line bg-surface-muted px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-ink-soft">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-ink">
                          Rider {rider.riderId.slice(0, 8)}
                        </p>
                        <ScorePill score={rider.avgScore} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-ink-soft">
                        {rider.tripCount} trips
                      </p>
                      <ScoreBar score={rider.avgScore} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<TrendingUp size={18} />}
              title="No rider risk data yet"
              description="Weekly rider rankings will appear once rider-linked trips are generated."
            />
          )}
        </DashboardCard>
      </section>

      <DashboardCard
        eyebrow="Event Breakdown"
        title="Weekly incident mix"
        description="A quick view of the event composition behind the fleet score and incident counts."
      >
        {reportQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-28 w-full rounded-[20px]" />
            <Skeleton className="h-28 w-full rounded-[20px]" />
            <Skeleton className="h-28 w-full rounded-[20px]" />
            <Skeleton className="h-28 w-full rounded-[20px]" />
          </div>
        ) : report && Object.keys(report.eventCounts).length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(report.eventCounts).map(([type, count]) => (
              <div
                key={type}
                className="rounded-[20px] border border-line bg-surface-muted px-4 py-4"
              >
                <p className="text-sm font-semibold text-ink">{formatEnumLabel(type)}</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">{count}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<AlertCircle size={18} />}
            title="No event counts for this range"
            description="Weekly event totals will appear here once fleet activity is available."
          />
        )}
      </DashboardCard>
    </PageShell>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={
        score >= 85
          ? 'rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
          : score >= 70
            ? 'rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-ink'
            : 'rounded-full bg-danger-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger-ink'
      }
    >
      Score {score.toFixed(1)}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
      <div
        className={
          score >= 85 ? 'h-full bg-emerald-500' : score >= 70 ? 'h-full bg-amber-500' : 'h-full bg-rose-500'
        }
        style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
      />
    </div>
  );
}
