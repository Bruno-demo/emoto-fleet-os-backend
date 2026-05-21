'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel } from '@/lib/ui';

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState(getDefaultRange);

  const reportQuery = useQuery({
    queryKey: ['reports', 'weekly', dateRange.from, dateRange.to],
    queryFn: () => apiFetch<WeeklyReport>(`/reports/weekly?from=${dateRange.from}&to=${dateRange.to}`),
  });

  const report = reportQuery.data;
  const crashAndSosCount = (report?.eventCounts.CRASH ?? 0) + (report?.eventCounts.SOS ?? 0);
  const trafficFineCount =
    (report?.eventCounts.OVERSPEED ?? 0) +
    (report?.eventCounts.SPEED_LIMIT_VIOLATION ?? 0) +
    (report?.eventCounts.SCHOOL_ZONE_SPEED ?? 0) +
    (report?.eventCounts.HOSPITAL_ZONE_SPEED ?? 0) +
    (report?.eventCounts.MARKET_ZONE_SPEED ?? 0);

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <DateRangePicker
        from={dateRange.from}
        to={dateRange.to}
        onChange={setDateRange}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportQuery.isLoading ? (
          <>
            <MetricCardSkeleton />
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
              title="Traffic fines"
              value={report ? String(trafficFineCount) : '--'}
              hint="Speed and road-safety violations that can translate into fines."
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

      <TrafficFinesCard />

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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink-soft">
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink-soft">
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
    </div>
  );
}

// Renders a static, API-ready fines panel until the Irembo feed is integrated.
function TrafficFinesCard() {
  return (
    <DashboardCard
      eyebrow="Compliance"
      title="Traffic fines"
      description="Irembo fines will stream here in real time once the integration is enabled."
    >
      <div className="rounded-[20px] border border-dashed border-line bg-surface-muted px-4 py-4">
        <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_1fr] gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          <span>Vehicle</span>
          <span>Reason</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Issued</span>
        </div>
        <div className="mt-3 grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_1fr] gap-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">--</span>
          <span>Awaiting Irembo feed</span>
          <span>--</span>
          <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Pending
          </span>
          <span>--</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Ready to map Irembo fines by plate or device UID once credentials are provided.
      </p>
    </DashboardCard>
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
    <div className="progress-bar mt-3">
      <div
        className={cx(
          'progress-bar-fill',
          score >= 85 ? '!bg-success-ink' : score >= 70 ? '!bg-warning-ink' : '!bg-danger-ink',
        )}
        style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
      />
    </div>
  );
}

