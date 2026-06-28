'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Activity, AlertCircle, AlertTriangle, TrendingUp, Download, Coins, Wallet, Users, BarChart3 } from 'lucide-react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import type { WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel } from '@/lib/ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { useCurrentUser } from '@/lib/auth/use-current-user';

interface LeaseContract {
  id: string;
  riderName: string;
  riderPhone: string;
  bikeLabel: string;
  bikePlate: string;
  totalPrincipal: number;
  totalPaid: number;
  dailyRate: number;
  arrears: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'DELINQUENT';
  lockState: 'LOCKED' | 'UNLOCKED';
  bikeId: string | null;
}

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
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const [activeTab, setActiveTab] = useState<'safety' | 'leases'>('safety');

  const reportQuery = useQuery({
    queryKey: ['reports', 'weekly', dateRange.from, dateRange.to],
    queryFn: () => apiFetch<WeeklyReport>(`/reports/weekly?from=${dateRange.from}&to=${dateRange.to}`),
    enabled: activeTab === 'safety' || user?.role === 'INSURER',
  });

  const report = reportQuery.data;
  const crashAndSosCount = (report?.eventCounts.CRASH ?? 0) + (report?.eventCounts.SOS ?? 0);
  const trafficFineCount =
    (report?.eventCounts.OVERSPEED ?? 0) +
    (report?.eventCounts.SPEED_LIMIT_VIOLATION ?? 0) +
    (report?.eventCounts.SCHOOL_ZONE_SPEED ?? 0) +
    (report?.eventCounts.HOSPITAL_ZONE_SPEED ?? 0) +
    (report?.eventCounts.MARKET_ZONE_SPEED ?? 0);
  const totalEvents = report
    ? Object.values(report.eventCounts).reduce((s, v) => s + v, 0)
    : 0;

  const leasesQuery = useQuery({
    queryKey: ['leases', 'reporting'],
    queryFn: () => apiFetch<LeaseContract[]>('/financials/leases'),
    enabled: activeTab === 'leases' && user?.role !== 'INSURER',
  });
  const leases = useMemo(() => leasesQuery.data ?? [], [leasesQuery.data]);

  const leaseMetrics = useMemo(() => {
    const totalLeases = leases.length;
    const totalPrincipal = leases.reduce((sum, l) => sum + l.totalPrincipal, 0);
    const totalPaid = leases.reduce((sum, l) => sum + l.totalPaid, 0);
    const totalArrears = leases.reduce((sum, l) => sum + l.arrears, 0);
    const overallEquity = totalPrincipal > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalPrincipal) * 100))) : 0;
    return {
      totalLeases,
      totalPrincipal,
      totalPaid,
      totalArrears,
      overallEquity
    };
  }, [leases]);

  const handleExport = () => {
    if (!report) return;
    const headers = ['Date Range', 'Metric', 'Value'];
    const rows = [
      [`${dateRange.from} to ${dateRange.to}`, 'Average Fleet Score', report.avgScore.toFixed(1)],
      ['', 'Total Trips', report.tripCount],
      ['', 'Overspeed Events', report.eventCounts.OVERSPEED ?? 0],
      ['', 'Speed Limit Violations', report.eventCounts.SPEED_LIMIT_VIOLATION ?? 0],
      ['', 'School Zone Breaches', report.eventCounts.SCHOOL_ZONE_SPEED ?? 0],
      ['', 'Hospital Zone Breaches', report.eventCounts.HOSPITAL_ZONE_SPEED ?? 0],
      ['', 'Market Zone Breaches', report.eventCounts.MARKET_ZONE_SPEED ?? 0],
      ['', 'Crash Alerts', report.eventCounts.CRASH ?? 0],
      ['', 'SOS Signals', report.eventCounts.SOS ?? 0],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eMoto_Weekly_Report_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Switcher */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          className={cx(
            "pb-3 text-sm font-bold border-b-2 px-4 transition-all -mb-px focus:outline-none flex items-center gap-2",
            activeTab === 'safety' || user?.role === 'INSURER'
              ? "border-accent text-ink"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          <BarChart3 size={16} />
          {t('Operations & Safety')}
        </button>
        {user?.role !== 'INSURER' && (
          <button
            type="button"
            onClick={() => setActiveTab('leases')}
            className={cx(
              "pb-3 text-sm font-bold border-b-2 px-4 transition-all -mb-px focus:outline-none flex items-center gap-2",
              activeTab === 'leases'
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            <Coins size={16} />
            {t('Lease Repayments')}
          </button>
        )}
      </div>

      {activeTab === 'safety' || user?.role === 'INSURER' ? (
        <>
          {/* Header filter & actions bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onChange={setDateRange}
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={!report || reportQuery.isLoading}
              className="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-strong hover:text-white transition disabled:opacity-50"
            >
              <Download size={16} />
              {t('Export CSV')}
            </button>
          </div>

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
                  title={t('Average Score')}
                  value={report ? report.avgScore.toFixed(1) : '--'}
                  hint={t('Fleet-wide trip score across the current weekly range.')}
                  icon={<TrendingUp size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Trip Count')}
                  value={report ? String(report.tripCount) : '--'}
                  hint={t('Trips included in the current weekly summary window.')}
                  icon={<Activity size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t('Overspeed Events')}
                  value={report ? String(report.eventCounts.OVERSPEED ?? 0) : '--'}
                  hint={t('Overspeed rule hits recorded during the same range.')}
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                />
                <MetricCard
                  title={t('Traffic fines')}
                  value={report ? String(trafficFineCount) : '--'}
                  hint={t('Speed and road-safety violations that can translate into fines.')}
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                />
                <MetricCard
                  title={t('Crash / SOS')}
                  value={report ? String(crashAndSosCount) : '--'}
                  hint={t('High-priority safety incidents requiring rapid dispatcher review.')}
                  icon={<AlertCircle size={18} />}
                  tone="danger"
                />
              </>
            )}
          </section>

          {/* Visual Analytics Charts */}
          {!reportQuery.isLoading && report && (
            <section className="grid gap-4 xl:grid-cols-2">
              <TrendChart dailyScores={report.dailyScores} />
              <EventDistributionChart eventCounts={report.eventCounts} />
            </section>
          )}

          <TrafficFinesCard />

          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardCard
              eyebrow={t('Risk Ranking')}
              title={t('Top risky bikes')}
              description={t('Bikes with the weakest scores and the highest event counts in the current weekly range.')}
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
                            {bike.tripCount} {t('trips')} · {bike.eventCount} {t('events')}
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
                  title={t('No bike risk data yet')}
                  description={t('Weekly bike risk rankings will appear once trips and events are available.')}
                />
              )}
            </DashboardCard>

            <DashboardCard
              eyebrow={t('Rider Ranking')}
              title={t('Top risky riders')}
              description={t('Rider aggregates from the weekly summary, useful for coaching and insurer review.')}
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
                              {t('Rider')} {rider.riderId.slice(0, 8)}
                            </p>
                            <ScorePill score={rider.avgScore} />
                          </div>
                          <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {rider.tripCount} {t('trips')}
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
                  title={t('No rider risk data yet')}
                  description={t('Weekly rider rankings will appear once rider-linked trips are generated.')}
                />
              )}
            </DashboardCard>
          </section>

          <DashboardCard
            eyebrow={t('Event Breakdown')}
            title={t('Weekly incident mix')}
            description={t('A quick view of the event composition behind the fleet score and incident counts.')}
          >
            {reportQuery.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Skeleton className="h-28 w-full rounded-[20px]" />
                <Skeleton className="h-28 w-full rounded-[20px]" />
                <Skeleton className="h-28 w-full rounded-[20px]" />
                <Skeleton className="h-28 w-full rounded-[20px]" />
              </div>
            ) : report && totalEvents > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(report.eventCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="rounded-[20px] border border-line bg-surface-muted px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-ink">{t(formatEnumLabel(type))}</p>
                    <p className="mt-3 font-display text-3xl font-semibold text-ink">{count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<AlertCircle size={18} />}
                title={t('No event counts for this range')}
                description={t('Weekly event totals will appear here once fleet activity is available.')}
              />
            )}
          </DashboardCard>
        </>
      ) : (
        <>
          {/* Lease Repayments Tab */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {leasesQuery.isLoading ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard
                  title={t('Active Contracts')}
                  value={String(leaseMetrics.totalLeases)}
                  hint={t('Total lease-to-own agreements globally in the fleet.')}
                  icon={<Users size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Asset Finance Value')}
                  value={`${leaseMetrics.totalPrincipal.toLocaleString()} RWF`}
                  hint={t('Sum of all principal lease amounts.')}
                  icon={<TrendingUp size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Rider Equity')}
                  value={`${leaseMetrics.overallEquity}%`}
                  hint={t('Average paid ownership equity across portfolio.')}
                  icon={<Wallet size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t('Overdue Arrears')}
                  value={`${leaseMetrics.totalArrears.toLocaleString()} RWF`}
                  hint={t('Accumulated unpaid arrears balance.')}
                  icon={<Coins size={18} />}
                  tone={leaseMetrics.totalArrears > 0 ? 'warning' : 'neutral'}
                />
              </>
            )}
          </section>

          <DashboardCard
            eyebrow={t('Financing Reports')}
            title={t('Buy-to-own portfolio summary')}
            description={t('Track asset ownership payments, overdue balances, and driver equity milestones.')}
          >
            <div className="overflow-x-auto mt-2">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-ink-faint">
                    <th className="py-2.5 font-bold">{t('Rider')}</th>
                    <th className="py-2.5 font-bold">{t('Bike details')}</th>
                    <th className="py-2.5 font-bold">{t('Ownership Equity')}</th>
                    <th className="py-2.5 font-bold">{t('Daily Rate')}</th>
                    <th className="py-2.5 font-bold">{t('Total Arrears')}</th>
                    <th className="py-2.5 font-bold text-right">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leasesQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-muted">
                        {t('Loading leases report...')}
                      </td>
                    </tr>
                  ) : leases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-muted">
                        {t('No lease contracts registered')}
                      </td>
                    </tr>
                  ) : (
                    leases.map((lease: LeaseContract) => {
                      const pct = lease.totalPrincipal > 0 ? Math.min(100, Math.max(0, Math.round((lease.totalPaid / lease.totalPrincipal) * 100))) : 0;
                      return (
                        <tr key={lease.id} className="border-b border-line hover:bg-surface-hover transition-colors">
                          <td className="py-3 font-semibold text-ink">
                            <p className="font-semibold text-ink">{lease.riderName}</p>
                            <p className="text-[10px] text-ink-muted mt-0.5">{lease.riderPhone}</p>
                          </td>
                          <td className="py-3 text-xs text-ink-soft">
                            <p className="font-semibold">{lease.bikeLabel}</p>
                            <p className="text-[10px] text-ink-muted">{lease.bikePlate}</p>
                          </td>
                          <td className="py-3">
                            <div className="min-w-[120px] max-w-[160px] text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-ink-soft">{pct}%</span>
                                <span className="text-[10px] text-ink-muted tabular-nums">
                                  {lease.totalPaid.toLocaleString()} / {lease.totalPrincipal.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden border border-line">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-ink-soft">{lease.dailyRate.toLocaleString()} RWF</td>
                          <td className="py-3">
                            <span className={cx(
                              "font-mono font-bold text-xs px-2 py-0.5 rounded",
                              lease.arrears > 0 ? "text-danger-ink bg-danger-soft/20" : "text-ink-soft"
                            )}>
                              {lease.arrears.toLocaleString()} RWF
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Badge
                              label={t(lease.status === 'PAID_OFF' ? 'Paid Off' : lease.status === 'ACTIVE' ? 'Active' : 'Delinquent')}
                              tone={
                                lease.status === 'PAID_OFF'
                                  ? 'success'
                                  : lease.status === 'ACTIVE'
                                    ? 'info'
                                    : 'danger'
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  );
}

interface TrendPoint {
  date: string;
  score: number;
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
      title={t('Safety score timeline')}
      description={t('Daily fleet-wide safety score trend lines for the selected range.')}
    >
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="reportsAreaGradient" x1="0" y1="0" x2="0" y2="1">
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
            <path d={areaPath} fill="url(#reportsAreaGradient)" />
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

function EventDistributionChart({ eventCounts }: { eventCounts: Record<string, number> }) {
  const { t } = useTranslation();
  const entries = Object.entries(eventCounts).filter(([, count]) => count > 0);
  
  if (entries.length === 0) {
    return (
      <DashboardCard
        eyebrow={t('Incident Proportions')}
        title={t('Incident mix chart')}
        description={t('Proportional breakdown of safety alerts and rule violation counts.')}
      >
        <EmptyState
          icon={<Activity size={18} />}
          title={t('No incidents logged')}
          description={t('No events to display in the chart distribution for this range.')}
        />
      </DashboardCard>
    );
  }

  const width = 500;
  const height = 180;
  const paddingLeft = 100;
  const paddingRight = 25;
  const paddingTop = 10;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...entries.map(([, count]) => count));
  const barHeight = Math.min(18, chartHeight / (entries.length * 1.5));
  const gap = barHeight * 0.5;

  return (
    <DashboardCard
      eyebrow={t('Incident Proportions')}
      title={t('Incident mix chart')}
      description={t('Proportional breakdown of safety alerts and rule violation counts.')}
    >
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[0.25, 0.5, 0.75, 1.0].map((pct) => {
            const x = paddingLeft + pct * chartWidth;
            const label = Math.round(pct * maxVal);
            return (
              <g key={pct} className="opacity-40">
                <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                <text x={x} y={height - paddingBottom + 10} textAnchor="middle" className="fill-zinc-500 font-mono text-[8px]">{label}</text>
              </g>
            );
          })}

          {entries.map(([type, count], i) => {
            const y = paddingTop + i * (barHeight + gap) + gap;
            const barWidth = maxVal > 0 ? (count / maxVal) * chartWidth : 0;
            return (
              <g key={type} className="group cursor-pointer">
                <text
                  x={paddingLeft - 8}
                  y={y + barHeight / 2 + 3}
                  textAnchor="end"
                  className="fill-zinc-400 font-sans text-[8px] font-semibold"
                >
                  {t(formatEnumLabel(type))}
                </text>
                <rect
                  x={paddingLeft}
                  y={y}
                  width={chartWidth}
                  height={barHeight}
                  rx="3"
                  className="fill-white/[0.02]"
                />
                <rect
                  x={paddingLeft}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  className="fill-accent/80 hover:fill-accent transition-all duration-300"
                />
                <text
                  x={paddingLeft + barWidth + 6}
                  y={y + barHeight / 2 + 3}
                  textAnchor="start"
                  className="fill-white font-mono text-[8px] font-bold"
                >
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </DashboardCard>
  );
}
function TrafficFinesCard() {
  const { t } = useTranslation();

  return (
    <DashboardCard
      eyebrow={t('Compliance')}
      title={t('Traffic fines')}
      description={t('Irembo fines will stream here in real time once the integration is enabled.')}
    >
      <div className="rounded-[20px] border border-line bg-surface-muted px-4 py-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr] gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted border-b border-white/[0.04] pb-2">
            <span>{t('Vehicle')}</span>
            <span>{t('Reason')}</span>
            <span>{t('Amount')}</span>
            <span>{t('Status')}</span>
            <span>{t('Issued')}</span>
          </div>

          <div className="mt-3 grid grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr] gap-3 text-sm text-ink-soft">
            <span className="font-semibold text-ink">--</span>
            <span>{t('Awaiting Irembo feed')}</span>
            <span>--</span>
            <span className="inline-flex max-w-max rounded-full bg-white/[0.02] border border-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t('Pending')}
            </span>
            <span>--</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {t('Ready to map Irembo fines by plate or device UID once credentials are provided.')}
      </p>
    </DashboardCard>
  );
}

function ScorePill({ score }: { score: number }) {
  const { t } = useTranslation();
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
      {t('Score')} {score.toFixed(1)}
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

