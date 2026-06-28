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
  Settings,
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
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Incident, PaginatedResponse, WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo } from '@/lib/ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';

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
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const { data: user } = useCurrentUser();

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
              title={user?.role === 'INSURER' ? t('Insured Trips') : t('Weekly Trips')}
              value={report ? String(report.tripCount) : '--'}
              hint={user?.role === 'INSURER' ? t('Trips by covered bikes') : t('Trips in the current 7-day window')}
              icon={<Bike size={18} />}
              tone="info"
            />
            <MetricCard
              title={user?.role === 'INSURER' ? t('Covered Score') : t('Fleet Score')}
              value={report ? report.avgScore.toFixed(1) : '--'}
              hint={user?.role === 'INSURER' ? t('Avg driving score of covered bikes') : t('Avg driving score across completed trips')}
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
              title={user?.role === 'INSURER' ? t('Open Covered Incidents') : t('Open Incidents')}
              value={String(openIncidents)}
              hint={t('Awaiting acknowledgement or resolution')}
              icon={<ShieldAlert size={18} />}
              tone={openIncidents > 0 ? 'danger' : 'neutral'}
            />
            <MetricCard
              title={user?.role === 'INSURER' ? t('Covered Events') : t('Total Events')}
              value={String(totalEvents)}
              hint={`${report?.eventCounts.CRASH ?? 0} ${t('crashes')} · ${report?.eventCounts.HARSH_BRAKE ?? 0} ${t('brakes')}`}
              icon={<Zap size={18} />}
              tone="warning"
            />
          </>
        )}
      </section>

      {/* Fleet health bar */}
      <section className="grid gap-4 sm:grid-cols-3">
        <FleetStatCard
          label={user?.role === 'INSURER' ? t('Insured Bikes') : t('Active Bikes')}
          value={totalBikes}
          icon={<Bike size={16} />}
          loading={bikesQuery.isLoading}
        />
        <FleetStatCard
          label={user?.role === 'INSURER' ? t('Covered Risk Events') : t('Risk Events')}
          value={totalEvents}
          icon={<AlertTriangle size={16} />}
          loading={weeklyReportQuery.isLoading}
        />
        <FleetStatCard
          label={user?.role === 'INSURER' ? t('Covered Incidents') : t('Incidents')}
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
          {user?.role === 'INSURER' && report && (
            <TrendChart dailyScores={report.dailyScores} />
          )}

          <DashboardCard
            eyebrow={t('Risk profile')}
            title={t('Event breakdown')}
            actions={
              user?.role === 'INSURER' ? null : (
                <Link
                  href="/events"
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {t('View all')} <ArrowRight size={12} />
                </Link>
              )
            }
          >
            {weeklyReportQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : report && totalEvents > 0 ? (
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
                                {t(formatEnumLabel(type))}
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
                title={t('No events this week')}
                description={t('Event distribution appears once telemetry generates activity.')}
              />
            )}
          </DashboardCard>

          {/* Recent incidents timeline */}
          <DashboardCard
            eyebrow={t('Activity')}
            title={t('Recent incidents')}
            actions={
              user?.role === 'INSURER' ? null : (
                <Link
                  href="/incidents"
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {t('Incident desk')} <ArrowRight size={12} />
                </Link>
              )
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
                title={t('No recent incidents')}
                description={t('Incidents will appear here as they are created.')}
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
                        {t(formatEnumLabel(inc.status))} {t('Incident')}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {inc.createdAt ? formatTimeAgo(inc.createdAt) : 'Recently'}
                      </p>
                    </div>
                    <Badge
                      label={t(formatEnumLabel(inc.status))}
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
            eyebrow={t('Watchlist')}
            title={user?.role === 'INSURER' ? t('Insured Risky Bikes') : t('Risky bikes')}
            actions={
              <Link
                href="/bikes"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                {user?.role === 'INSURER' ? t('Bikes') : t('Fleet')} <ArrowRight size={12} />
              </Link>
            }
          >
            <WatchlistSection
              emptyLabel={t('No risky bikes this week')}
              items={(report?.topRiskyBikes ?? []).slice(0, 5).map((bike) => ({
                id: bike.bikeId,
                title: bike.label,
                subtitle: `${bike.tripCount} ${t('trips')} · ${bike.eventCount} ${t('events')}`,
                score: bike.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />
          </DashboardCard>

          <DashboardCard
            eyebrow={t('Watchlist')}
            title={user?.role === 'INSURER' ? t('Insured Risky Riders') : t('Risky riders')}
            actions={
              user?.role === 'INSURER' ? null : (
                <Link
                  href="/riders"
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {t('Riders')} <ArrowRight size={12} />
                </Link>
              )
            }
          >
            <WatchlistSection
              emptyLabel={t('No risky riders this week')}
              items={(report?.topRiskyRiders ?? []).slice(0, 5).map((rider) => ({
                id: rider.riderId,
                title: rider.fullName ?? `Rider ${rider.riderId.slice(0, 8)}`,
                subtitle: `${rider.tripCount} ${t('trips')}`,
                score: rider.avgScore,
              }))}
              loading={weeklyReportQuery.isLoading}
            />
          </DashboardCard>

          {/* Quick actions */}
          <DashboardCard eyebrow={t('Quick actions')} title={t('Shortcuts')}>
            <div className="grid grid-cols-2 gap-2">
              {user?.role === 'INSURER' ? (
                <>
                  <QuickAction href="/bikes" icon={<Bike size={16} />} label={t('Bikes')} />
                  <QuickAction href="/reports" icon={<Activity size={16} />} label={t('Reports')} />
                  <QuickAction href="/settings?tab=apiCredentials" icon={<Settings size={16} />} label={t('API Credentials')} />
                </>
              ) : (
                <>
                  <QuickAction href="/live" icon={<Gauge size={16} />} label={t('Live Map')} />
                  <QuickAction href="/incidents" icon={<Siren size={16} />} label={t('Incidents')} />
                  <QuickAction href="/bikes" icon={<Bike size={16} />} label={t('Fleet')} />
                  <QuickAction href="/reports" icon={<Activity size={16} />} label={t('Reports')} />
                </>
              )}
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
        'flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all min-w-0',
        urgent
          ? 'border-danger-ink/20 bg-danger-soft/30'
          : 'border-line bg-surface-muted hover:bg-surface-hover',
      )}
    >
      <span
        className={cx(
          'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
          urgent ? 'bg-danger-soft text-danger-ink' : 'bg-surface-muted text-ink-muted',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {loading ? (
          <Skeleton className="h-6 w-12 rounded" />
        ) : (
          <p className="font-display text-2xl font-bold text-ink tabular-nums">{value}</p>
        )}
        <p className="text-xs text-ink-muted truncate">{label}</p>
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
      className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-medium text-ink transition-all hover:bg-surface-hover hover:border-line-strong min-w-0"
    >
      <span className="text-accent shrink-0">{icon}</span>
      <span className="truncate flex-1 min-w-0">{label}</span>
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
  const { t } = useTranslation();

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
        description={t('Rankings populate once the weekly report has enough data.')}
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


function TrendChart({
  dailyScores,
}: {
  dailyScores: Array<{ date: string; score: number }>;
}) {
  const { t } = useTranslation();

  const width = 500;
  const height = 180;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointsCount = dailyScores.length;
  const svgPoints = dailyScores
    .map((p, index) => {
      const x = paddingLeft + (index / Math.max(1, pointsCount - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (p.score / 100) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const startX = paddingLeft;
  const endX = paddingLeft + chartWidth;
  const bottomY = paddingTop + chartHeight;
  const areaPath = dailyScores.length > 1 ? `M ${startX} ${bottomY} L ${svgPoints} L ${endX} ${bottomY} Z` : '';

  return (
    <DashboardCard
      eyebrow={t('Trend Analysis')}
      title={t('Insured safety score timeline')}
      description={t('Daily safety score trend lines for the active insured pool.')}
    >
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[100, 75, 50, 25].map((lvl) => {
            const y = paddingTop + chartHeight - (lvl / 100) * chartHeight;
            return (
              <g key={lvl} className="opacity-40">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[8px]"
                >
                  {lvl}
                </text>
              </g>
            );
          })}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.1)"
          />

          {/* X Axis Labels */}
          {dailyScores.map((p, index) => {
            const x = paddingLeft + (index / Math.max(1, pointsCount - 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y={height - paddingBottom + 15}
                textAnchor="middle"
                className="fill-zinc-500 font-mono text-[7px]"
              >
                {p.date}
              </text>
            );
          })}

          {/* Area fill */}
          {dailyScores.length > 1 && (
            <path d={areaPath} fill="url(#areaGradient)" />
          )}

          {/* Line */}
          {dailyScores.length > 1 && (
            <polyline
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />
          )}

          {/* Data points */}
          {dailyScores.map((p, i) => {
            const x = paddingLeft + (i / Math.max(1, pointsCount - 1)) * chartWidth;
            const y = paddingTop + chartHeight - (p.score / 100) * chartHeight;
            return (
              <g key={i} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-[#4f46e5] stroke-[#161618] stroke-[1.5] opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <title>{`${p.date}: ${p.score}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </DashboardCard>
  );
}
