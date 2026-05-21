'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bike,
  Calendar,
  Clock,
  Gauge,
  ShieldAlert,
  Siren,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import type { Incident, PaginatedResponse, WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo } from '@/lib/ui';

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState(getDefaultRange);

  const weeklyReportQuery = useQuery({
    queryKey: ['reports', 'weekly', dateRange.from, dateRange.to],
    queryFn: () =>
      apiFetch<WeeklyReport>(`/reports/weekly?from=${dateRange.from}&to=${dateRange.to}`),
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=5'),
  });

  const recentIncidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-recent'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?page=1&pageSize=8'),
  });

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'overview-count'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string }>>('/bikes?page=1&pageSize=1'),
  });

  const report = weeklyReportQuery.data;
  const openIncidents = incidentsQuery.data?.total ?? 0;
  const totalBikes = bikesQuery.data?.total ?? 0;
  const recentIncidents = recentIncidentsQuery.data?.data ?? [];

  const totalEvents = report
    ? Object.values(report.eventCounts).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Date range picker */}
      <DateRangePicker
        from={dateRange.from}
        to={dateRange.to}
        onChange={setDateRange}
      />

      {/* KPI row */}
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
              hint="Trips in the current 7-day window"
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title="Fleet Score"
              value={report ? report.avgScore.toFixed(1) : '--'}
              hint="Avg driving score across completed trips"
              icon={<TrendingUp size={18} />}
              tone={
                report
                  ? report.avgScore >= 85
                    ? 'success'
                    : report.avgScore >= 70
                      ? 'warning'
                      : 'danger'
                  : 'success'
              }
            />
            <MetricCard
              title="Open Incidents"
              value={String(openIncidents)}
              hint="Awaiting acknowledgement or resolution"
              icon={<ShieldAlert size={18} />}
              tone={openIncidents > 0 ? 'danger' : 'neutral'}
            />
            <MetricCard
              title="Total Events"
              value={String(totalEvents)}
              hint={`${report?.eventCounts.CRASH ?? 0} crashes · ${report?.eventCounts.HARSH_BRAKE ?? 0} brakes`}
              icon={<Zap size={18} />}
              tone="warning"
            />
          </>
        )}
      </section>

      {/* Fleet health bar */}
      <section className="grid gap-4 sm:grid-cols-3">
        <FleetStatCard
          label="Active Bikes"
          value={totalBikes}
          icon={<Bike size={16} />}
          loading={bikesQuery.isLoading}
        />
        <FleetStatCard
          label="Risk Events"
          value={totalEvents}
          icon={<AlertTriangle size={16} />}
          loading={weeklyReportQuery.isLoading}
        />
        <FleetStatCard
          label="Incidents"
          value={openIncidents}
          icon={<Siren size={16} />}
          loading={incidentsQuery.isLoading}
          urgent={openIncidents > 0}
        />
      </section>

      {/* Main grid */}
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Left: Event mix + chart area */}
        <div className="space-y-5">
          <DashboardCard
            eyebrow="Risk profile"
            title="Event breakdown"
            actions={
              <Link
                href="/events"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            }
          >
            {weeklyReportQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : report && Object.keys(report.eventCounts).length ? (
              <>
                {/* Horizontal bar chart */}
                <div className="space-y-3">
                  {Object.entries(report.eventCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
                      return (
                        <div key={type} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cx(
                                'flex h-6 w-6 items-center justify-center rounded-md text-[10px]',
                                type === 'CRASH'
                                  ? 'bg-danger-soft text-danger-ink'
                                  : type === 'SPEEDING'
                                    ? 'bg-warning-soft text-warning-ink'
                                    : 'bg-accent/20 text-accent',
                              )}>
                                <Activity size={11} />
                              </span>
                              <span className="text-sm font-medium text-ink">
                                {formatEnumLabel(type)}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-ink tabular-nums">
                              {count}
                            </span>
                          </div>
                          <div className="progress-bar">
                            <div
                              className={cx(
                                'progress-bar-fill',
                                type === 'CRASH'
                                  ? '!bg-danger-ink'
                                  : type === 'SPEEDING'
                                    ? '!bg-warning-ink'
                                    : '',
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Activity size={18} />}
                title="No events this week"
                description="Event distribution appears once telemetry generates activity."
              />
            )}
          </DashboardCard>

          {/* Recent incidents timeline */}
          <DashboardCard
            eyebrow="Activity"
            title="Recent incidents"
            actions={
              <Link
                href="/incidents"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Incident desk <ArrowRight size={12} />
              </Link>
            }
          >
            {recentIncidentsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : recentIncidents.length === 0 ? (
              <EmptyState
                icon={<Siren size={18} />}
                title="No recent incidents"
                description="Incidents will appear here as they are created."
              />
            ) : (
              <div className="space-y-1">
                {recentIncidents.map((inc, i) => (
                  <div
                    key={inc.id}
                    className={cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-hover',
                      i < recentIncidents.length - 1
                        ? 'border-b border-line'
                        : '',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        inc.status === 'OPEN'
                          ? 'bg-danger-soft text-danger-ink'
                          : inc.status === 'ACKNOWLEDGED'
                            ? 'bg-warning-soft text-warning-ink'
                            : 'bg-success-soft text-success-ink',
                      )}
                    >
                      <Siren size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {formatEnumLabel(inc.status)} Incident
                      </p>
                      <p className="text-xs text-ink-muted">
                        {inc.createdAt ? formatTimeAgo(inc.createdAt) : 'Recently'}
                      </p>
                    </div>
                    <Badge
                      label={formatEnumLabel(inc.status)}
                      tone={
                        inc.status === 'OPEN'
                          ? 'danger'
                          : inc.status === 'ACKNOWLEDGED'
                            ? 'warning'
                            : 'success'
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Right: Watchlist */}
        <div className="space-y-5">
          <DashboardCard
            eyebrow="Watchlist"
            title="Risky bikes"
            actions={
              <Link
                href="/bikes"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Fleet <ArrowRight size={12} />
              </Link>
            }
          >
            <WatchlistSection
              emptyLabel="No risky bikes this week"
              items={(report?.topRiskyBikes ?? []).slice(0, 5).map((bike) => ({
                id: bike.bikeId,
                title: bike.label,
                subtitle: `${bike.tripCount} trips · ${bike.eventCount} events`,
                score: bike.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />
          </DashboardCard>

          <DashboardCard
            eyebrow="Watchlist"
            title="Risky riders"
            actions={
              <Link
                href="/riders"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Riders <ArrowRight size={12} />
              </Link>
            }
          >
            <WatchlistSection
              emptyLabel="No risky riders this week"
              items={(report?.topRiskyRiders ?? []).slice(0, 5).map((rider) => ({
                id: rider.riderId,
                title: rider.fullName ?? `Rider ${rider.riderId.slice(0, 8)}`,
                subtitle: `${rider.tripCount} trips`,
                score: rider.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />
          </DashboardCard>

          {/* Quick actions */}
          <DashboardCard eyebrow="Quick actions" title="Shortcuts">
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/live" icon={<Gauge size={16} />} label="Live Map" />
              <QuickAction href="/incidents" icon={<Siren size={16} />} label="Incidents" />
              <QuickAction href="/bikes" icon={<Bike size={16} />} label="Fleet" />
              <QuickAction href="/reports" icon={<Activity size={16} />} label="Reports" />
            </div>
          </DashboardCard>
        </div>
      </section>
    </div>
  );
}

function FleetStatCard({
  label,
  value,
  icon,
  loading,
  urgent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  loading: boolean;
  urgent?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all',
        urgent
          ? 'border-danger-ink/20 bg-danger-soft/30'
          : 'border-line bg-surface-muted hover:bg-surface-hover',
      )}
    >
      <span
        className={cx(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          urgent ? 'bg-danger-soft text-danger-ink' : 'bg-surface-muted text-ink-muted',
        )}
      >
        {icon}
      </span>
      <div>
        {loading ? (
          <Skeleton className="h-6 w-12 rounded" />
        ) : (
          <p className="font-display text-2xl font-bold text-ink tabular-nums">{value}</p>
        )}
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-medium text-ink transition-all hover:bg-surface-hover hover:border-line-strong"
    >
      <span className="text-accent">{icon}</span>
      {label}
    </Link>
  );
}

function WatchlistSection({
  emptyLabel,
  items,
  loading,
}: {
  emptyLabel: string;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    score: number;
  }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyLabel}
        description="Rankings populate once the weekly report has enough data."
      />
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 transition-colors hover:bg-surface-hover"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-muted text-[10px] font-bold text-ink-muted">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
              <p className="text-xs text-ink-muted">{item.subtitle}</p>
            </div>
          </div>
          <ScorePill score={item.score} />
        </li>
      ))}
    </ul>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 85 ? 'success' : score >= 70 ? 'warning' : 'danger';
  return (
    <span
      className={cx(
        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums',
        tone === 'success'
          ? 'bg-success-soft text-success-ink'
          : tone === 'warning'
            ? 'bg-warning-soft text-warning-ink'
            : 'bg-danger-soft text-danger-ink',
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}

