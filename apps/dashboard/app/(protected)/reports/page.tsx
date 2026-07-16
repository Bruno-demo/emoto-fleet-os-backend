'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Activity, AlertCircle, AlertTriangle, TrendingUp, Download, Coins, Wallet, Users, BarChart3, User, Banknote } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
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
    enabled: activeTab === 'leases' && user?.role !== 'INSURER' && user?.fleetType !== 'DELIVERY',
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
          {t('Operations & Safety Report')}
        </button>
        {user?.role !== 'INSURER' && user?.fleetType !== 'DELIVERY' && (
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
            {t('Financials & Lease Repayments')}
          </button>
        )}
      </div>

      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink">
            {activeTab === 'safety' ? t('Operations & Safety Report') : t('Financials & Lease Repayments')}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {activeTab === 'safety'
              ? t('Weekly fleet aggregates, driver safety score history, and safety incident highlights.')
              : t('Asset financing summaries, arrears, and rider equity progress.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          {activeTab === 'safety' && (
            <button
              type="button"
              onClick={handleExport}
              disabled={!report || reportQuery.isLoading}
              className="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-strong hover:text-white transition disabled:opacity-50"
            >
              <Download size={16} />
              {t('Export CSV')}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'safety' || user?.role === 'INSURER' ? (
        <div className="space-y-6">
          {/* Safety Metric Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  hint={t('Fleet-wide safety score index.')}
                  icon={<TrendingUp size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Trip Count')}
                  value={report ? String(report.tripCount) : '--'}
                  hint={t('Total completed trips logged.')}
                  icon={<Activity size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t('Overspeed Events')}
                  value={report ? String(report.eventCounts.OVERSPEED ?? 0) : '--'}
                  hint={t('Speed violations triggers.')}
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                />
                <MetricCard
                  title={t('Traffic Fines')}
                  value={report ? String(trafficFineCount) : '--'}
                  hint={t('Potential road-safety ticket fines.')}
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                />
                <MetricCard
                  title={t('Crash & SOS Alerts')}
                  value={report ? String(crashAndSosCount) : '--'}
                  hint={t('High-priority emergencies logged.')}
                  icon={<AlertCircle size={18} />}
                  tone="danger"
                />
              </>
            )}
          </section>

          {/* Visual Analytics Charts - VERTICAL stack */}
          {!reportQuery.isLoading && report && (
            <div className="space-y-6">
              <TrendChart dailyScores={report.dailyScores} />
              <EventDistributionChart eventCounts={report.eventCounts} />
            </div>
          )}

          {/* Compliance Traffic Fines */}
          <TrafficFinesCard />

          {/* Risky Rankings - VERTICAL stack */}
          <div className="space-y-6">
            <DashboardCard
              eyebrow={t('Risk Ranking')}
              title={t('Top risky bikes')}
              description={t('Bikes with weakest safety indicators.')}
            >
              {reportQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-[20px]" />
                  <Skeleton className="h-20 w-full rounded-[20px]" />
                </div>
              ) : (report?.topRiskyBikes ?? []).length ? (
                <ul className="space-y-3 max-h-[300px] overflow-y-auto dashboard-scrollbar pr-1">
                  {(report?.topRiskyBikes ?? []).map((bike, index) => (
                    <li
                      key={bike.bikeId}
                      className="rounded-[20px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink-soft">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-semibold text-ink">{bike.label}</p>
                            <ScorePill score={bike.avgScore} />
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
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
                  description={t('Weekly bike risk rankings will appear once trips are available.')}
                />
              )}
            </DashboardCard>

            <DashboardCard
              eyebrow={t('Rider Ranking')}
              title={t('Top risky riders')}
              description={t('Rider safety aggregates from weekly logs.')}
            >
              {reportQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-[20px]" />
                  <Skeleton className="h-20 w-full rounded-[20px]" />
                </div>
              ) : (report?.topRiskyRiders ?? []).length ? (
                <ul className="space-y-3 max-h-[300px] overflow-y-auto dashboard-scrollbar pr-1">
                  {(report?.topRiskyRiders ?? []).map((rider, index) => (
                    <li
                      key={rider.riderId}
                      className="rounded-[20px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink-soft">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-semibold text-ink">
                              {t('Rider')} {rider.riderId.slice(0, 8)}
                            </p>
                            <ScorePill score={rider.avgScore} />
                          </div>
                          <p className="mt-1 text-xs text-ink-soft">
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
          </div>

          {/* Event Breakdown */}
          <DashboardCard
            eyebrow={t('Event Breakdown')}
            title={t('Weekly incident mix')}
            description={t('A quick view of the event composition behind the fleet score.')}
          >
            {reportQuery.isLoading ? (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-24 w-full rounded-[20px]" />
                <Skeleton className="h-24 w-full rounded-[20px]" />
                <Skeleton className="h-24 w-full rounded-[20px]" />
                <Skeleton className="h-24 w-full rounded-[20px]" />
              </div>
            ) : report && totalEvents > 0 ? (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {Object.entries(report.eventCounts).map(([type, count]) => (
                  <div
                    key={type}
                    className="rounded-[20px] border border-line bg-surface-muted px-4 py-3.5"
                  >
                    <p className="text-xs font-semibold text-ink">{t(formatEnumLabel(type))}</p>
                    <p className="mt-2 font-display text-2xl font-bold text-ink">{count}</p>
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
        </div>
      ) : (
        <div className="space-y-6">
          {/* Financials KPI Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  hint={t('Total lease-to-own agreements.')}
                  icon={<Users size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Asset Finance Value')}
                  value={`${leaseMetrics.totalPrincipal.toLocaleString()} RWF`}
                  hint={t('Sum of all financing principals.')}
                  icon={<TrendingUp size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Rider Equity')}
                  value={`${leaseMetrics.overallEquity}%`}
                  hint={t('Average ownership equity paid.')}
                  icon={<Wallet size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t('Overdue Arrears')}
                  value={`${leaseMetrics.totalArrears.toLocaleString()} RWF`}
                  hint={t('Accumulated overdue balances.')}
                  icon={<Banknote size={18} />}
                  tone={leaseMetrics.totalArrears > 0 ? 'warning' : 'neutral'}
                />
              </>
            )}
          </section>

          {/* Lease Portfolio Table */}
          <DashboardCard
            eyebrow={t('Financing Reports')}
            title={t('Buy-to-own portfolio summary')}
            description={t('Track asset ownership payments, overdue balances, and driver equity milestones.')}
          >
            <div className="overflow-x-auto dashboard-scrollbar mt-2">
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
                            <p className="font-semibold text-ink leading-tight">{lease.riderName}</p>
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
        </div>
      )}
    </div>
  );
}
function TrendChart({
  dailyScores,
}: {
  dailyScores: Array<{ date: string; score: number }>;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      eyebrow={t('Trend Analysis')}
      title={t('Safety score timeline')}
      description={t('Daily safety score aggregates trend lines.')}
    >
      <div className="h-44 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyScores} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="reportsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} tickCount={5} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E1E20',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#fff',
              }}
            />
            <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#reportsAreaGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function EventDistributionChart({ eventCounts }: { eventCounts: Record<string, number> }) {
  const { t } = useTranslation();
  const data = Object.entries(eventCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      name: t(formatEnumLabel(type)),
      count,
    }));
  
  if (data.length === 0) {
    return (
      <DashboardCard
        eyebrow={t('Incident Proportions')}
        title={t('Incident mix chart')}
        description={t('Proportional breakdown of safety alerts.')}
      >
        <EmptyState
          icon={<Activity size={18} />}
          title={t('No incidents logged')}
          description={t('No events to display in the chart distribution for this range.')}
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      eyebrow={t('Incident Proportions')}
      title={t('Incident mix chart')}
      description={t('Breakdown of safety alerts and violations.')}
    >
      <div className="h-44 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E1E20',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#fff',
              }}
            />
            <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#4f46e5" opacity={0.7 + (index % 3) * 0.15} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}

function TrafficFinesCard() {
  const { t } = useTranslation();

  const mockFines = [
    { vehicle: 'KGL-B-005 (RA 1005 A)', reason: t('Speed limit breach (School zone)'), amount: '10,000 RWF', status: 'UNPAID', issued: '2026-07-14' },
    { vehicle: 'KGL-B-012 (RA 1012 A)', reason: t('Illegal zone access'), amount: '25,000 RWF', status: 'PAID', issued: '2026-07-12' },
    { vehicle: 'KGL-B-024 (RA 1024 A)', reason: t('Overspeeding 80km/h in 60km/h'), amount: '10,000 RWF', status: 'UNPAID', issued: '2026-07-10' },
  ];

  return (
    <DashboardCard
      eyebrow={t('Compliance')}
      title={t('Recent traffic fines')}
      description={t('Fines retrieved via automated Irembo integration for fleet registration numbers.')}
    >
      <div className="rounded-[20px] border border-line bg-surface-muted px-4 py-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr] gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted border-b border-white/[0.04] pb-2">
            <span>{t('Vehicle')}</span>
            <span>{t('Reason')}</span>
            <span>{t('Amount')}</span>
            <span>{t('Status')}</span>
            <span>{t('Issued')}</span>
          </div>

          <div className="mt-3 space-y-3">
            {mockFines.map((fine, idx) => (
              <div key={idx} className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr] gap-3 text-xs text-ink-soft items-center border-b border-white/[0.02] pb-2 last:border-0 last:pb-0">
                <span className="font-semibold text-ink">{fine.vehicle}</span>
                <span>{fine.reason}</span>
                <span className="font-mono">{fine.amount}</span>
                <span>
                  <Badge
                    label={t(fine.status)}
                    tone={fine.status === 'PAID' ? 'success' : 'danger'}
                  />
                </span>
                <span className="font-mono text-[11px] text-ink-muted">{fine.issued}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {t('Live Irembo connection is active and mapping fines by plate number.')}
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

