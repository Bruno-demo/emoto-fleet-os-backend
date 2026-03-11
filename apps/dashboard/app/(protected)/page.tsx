'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Bike, ShieldAlert, TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import { Incident, PaginatedResponse, WeeklyReport } from '@/lib/types/dashboard';
import { formatEnumLabel } from '@/lib/ui';

export default function OverviewPage() {
  const weeklyReportQuery = useQuery({
    queryKey: ['reports', 'weekly'],
    queryFn: () => apiFetch<WeeklyReport>('/reports/weekly'),
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-open'],
    queryFn: () => apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=20'),
  });

  const report = weeklyReportQuery.data;
  const openIncidents = incidentsQuery.data?.total ?? 0;

  return (
    <PageShell
      title="Overview"
      description="Weekly fleet pulse, open-risk visibility, and the bikes or riders that need dispatcher attention first."
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {weeklyReportQuery.isLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Weekly Trips"
              value={report ? String(report.tripCount) : '--'}
              hint="Trips recorded in the current rolling seven-day window."
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title="Average Score"
              value={report ? report.avgScore.toFixed(1) : '--'}
              hint="Fleet-wide driving score across completed trips."
              icon={<TrendingUp size={18} />}
              tone="success"
            />
            <MetricCard
              title="Open Incidents"
              value={String(openIncidents)}
              hint="Incidents still awaiting acknowledgement or resolution."
              icon={<ShieldAlert size={18} />}
              tone="danger"
            />
            <MetricCard
              title="Crash Events"
              value={String(report?.eventCounts.CRASH ?? 0)}
              hint="Crash detections created during the weekly reporting period."
              icon={<AlertTriangle size={18} />}
              tone="warning"
            />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardCard
          eyebrow="Event Mix"
          title="Weekly risk distribution"
          description="A quick read on which rules are driving current risk and which surfaces need more attention."
        >
          {weeklyReportQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-[20px]" />
              <Skeleton className="h-28 w-full rounded-[20px]" />
              <Skeleton className="h-28 w-full rounded-[20px]" />
              <Skeleton className="h-28 w-full rounded-[20px]" />
            </div>
          ) : report && Object.keys(report.eventCounts).length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(report.eventCounts).map(([type, count]) => (
                <div
                  key={type}
                  className="rounded-[20px] border border-line bg-surface-muted px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{formatEnumLabel(type)}</p>
                    <Activity size={16} className="text-accent" />
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">{count}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Activity size={18} />}
              title="No weekly events yet"
              description="Weekly event distribution will appear once telemetry and rules generate activity."
            />
          )}
        </DashboardCard>

        <DashboardCard
          eyebrow="Dispatcher Watchlist"
          title="Risk queues"
          description="The weakest bikes and riders in the current summary, surfaced for rapid coaching or follow-up."
        >
          <div className="space-y-5">
            <WatchlistSection
              title="Top risky bikes"
              emptyLabel="No risky bikes in this range."
              items={(report?.topRiskyBikes ?? []).slice(0, 5).map((bike) => ({
                id: bike.bikeId,
                title: bike.label,
                subtitle: `${bike.tripCount} trips · ${bike.eventCount} events`,
                score: bike.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />

            <WatchlistSection
              title="Top risky riders"
              emptyLabel="No risky riders in this range."
              items={(report?.topRiskyRiders ?? []).slice(0, 5).map((rider) => ({
                id: rider.riderId,
                title: `Rider ${rider.riderId.slice(0, 8)}`,
                subtitle: `${rider.tripCount} trips`,
                score: rider.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />
          </div>
        </DashboardCard>
      </section>
    </PageShell>
  );
}

function WatchlistSection({
  title,
  emptyLabel,
  items,
  loading,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    score: number;
  }>;
  loading: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Priority
        </span>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-18 w-full rounded-[18px]" />
          <Skeleton className="h-18 w-full rounded-[18px]" />
        </div>
      ) : items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface-muted px-4 py-3"
            >
              <div>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{item.subtitle}</p>
              </div>
              <ScorePill score={item.score} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <EmptyState title={emptyLabel} description="This ranking will populate once the weekly report has enough completed trips." />
        </div>
      )}
    </section>
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
