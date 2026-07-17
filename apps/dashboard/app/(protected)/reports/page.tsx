'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Activity, AlertCircle, AlertTriangle, TrendingUp, Download, Coins, Wallet, Users, BarChart3, Banknote } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { downloadFormattedExcel } from '@/lib/export/excel-export';
import type { WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, getLocalDateString } from '@/lib/ui';
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
  pendingFines?: number;
}

function getDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: getLocalDateString(from),
    to: getLocalDateString(to),
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
    const totalFines = leases.reduce((sum, l) => sum + (l.pendingFines || 0), 0);
    const leaseArrears = Math.max(0, totalArrears - totalFines);
    const overallEquity = totalPrincipal > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalPrincipal) * 100))) : 0;
    return {
      totalLeases,
      totalPrincipal,
      totalPaid,
      totalArrears,
      totalFines,
      leaseArrears,
      overallEquity
    };
  }, [leases]);

  const topDelinquentLeases = useMemo(() => {
    return [...leases]
      .filter(l => l.arrears > 0)
      .sort((a, b) => b.arrears - a.arrears)
      .slice(0, 5);
  }, [leases]);

  const equityBreakdownData = useMemo(() => {
    const totalPrincipal = leases.reduce((sum, l) => sum + l.totalPrincipal, 0);
    const totalPaid = leases.reduce((sum, l) => sum + l.totalPaid, 0);
    const remaining = Math.max(0, totalPrincipal - totalPaid);
    
    return [
      { name: t('Paid Principal'), value: totalPaid, color: '#10B981' },
      { name: t('Remaining Balance'), value: remaining, color: '#3B82F6' },
    ];
  }, [leases, t]);

  const handleExportLeasePortfolio = () => {
    if (leases.length === 0) return;
    
    const cols = [
      { header: t('Rider Name'), key: 'riderName', type: 'text' as const },
      { header: t('Phone Number'), key: 'riderPhone', type: 'text' as const },
      { header: t('Bike Label'), key: 'bikeLabel', type: 'text' as const },
      { header: t('Bike Plate'), key: 'bikePlate', type: 'text' as const },
      { header: t('Lease Daily Rate'), key: 'dailyRate', type: 'currency' as const, align: 'right' as const },
      { header: t('Total Principal'), key: 'totalPrincipal', type: 'currency' as const, align: 'right' as const },
      { header: t('Total Paid-to-Date'), key: 'totalPaid', type: 'currency' as const, align: 'right' as const },
      { header: t('Lease Arrears'), key: 'leaseArrears', type: 'currency' as const, align: 'right' as const },
      { header: t('Traffic Fines'), key: 'trafficFines', type: 'currency' as const, align: 'right' as const },
      { header: t('Total Arrears'), key: 'arrears', type: 'currency' as const, align: 'right' as const },
      { header: t('Financing Status'), key: 'status', type: 'status' as const, align: 'center' as const },
    ];

    const rows = leases.map(l => {
      const fines = l.pendingFines || 0;
      const lArrears = Math.max(0, l.arrears - fines);
      return {
        riderName: l.riderName,
        riderPhone: l.riderPhone ?? '',
        bikeLabel: l.bikeLabel ?? '',
        bikePlate: l.bikePlate ?? '',
        dailyRate: l.dailyRate || 0,
        totalPrincipal: l.totalPrincipal || 0,
        totalPaid: l.totalPaid || 0,
        leaseArrears: lArrears,
        trafficFines: fines,
        arrears: l.arrears || 0,
        status: t(l.status === 'PAID_OFF' ? 'Paid Off' : l.status === 'ACTIVE' ? 'Active' : 'Delinquent'),
      };
    });

    downloadFormattedExcel({
      title: t('Buy-to-Own Lease Repayments Ledger'),
      subtitle: t('Overview of active asset financing contracts and equity accrual'),
      kpis: [
        { label: t('Active Contracts'), value: String(leaseMetrics.totalLeases) },
        { label: t('Total Portfolio Value'), value: `${leaseMetrics.totalPrincipal.toLocaleString()} RWF` },
        { label: t('Lease Arrears'), value: `${leaseMetrics.leaseArrears.toLocaleString()} RWF` },
        { label: t('Traffic Fines'), value: `${leaseMetrics.totalFines.toLocaleString()} RWF` },
      ],
      columns: cols,
      rows,
      sheetName: 'Lease Portfolio',
    });
  };

  const handleExport = () => {
    if (!report) return;

    const cols = [
      { header: t('Report Dimension'), key: 'metric', type: 'text' as const, align: 'left' as const },
      { header: t('Description'), key: 'description', type: 'text' as const, align: 'left' as const },
      { header: t('Aggregate Value'), key: 'value', type: 'number' as const, align: 'right' as const },
    ];

    const rows = [
      { metric: t('Average Safety Score'), description: t('Average fleet-wide safety score calculated from telematics data'), value: Number(report.avgScore.toFixed(1)) },
      { metric: t('Total Trips Logged'), description: t('Total number of completed vehicle trips recorded in period'), value: report.tripCount },
      { metric: t('Overspeed Incidents'), description: t('Instances of speed breaching standard road thresholds'), value: report.eventCounts.OVERSPEED ?? 0 },
      { metric: t('Speed Limit Violations'), description: t('Instances of speed breaching local GPS map limits'), value: report.eventCounts.SPEED_LIMIT_VIOLATION ?? 0 },
      { metric: t('School Zone Speeding'), description: t('Speed limit breaches detected in designated school zones'), value: report.eventCounts.SCHOOL_ZONE_SPEED ?? 0 },
      { metric: t('Hospital Zone Speeding'), description: t('Speed limit breaches detected in designated hospital zones'), value: report.eventCounts.HOSPITAL_ZONE_SPEED ?? 0 },
      { metric: t('Market Zone Speeding'), description: t('Speed limit breaches detected in busy market zones'), value: report.eventCounts.MARKET_ZONE_SPEED ?? 0 },
      { metric: t('Crash Alerts'), description: t('High-gravity accelerometer trigger alerts indicating potential crashes'), value: report.eventCounts.CRASH ?? 0 },
      { metric: t('SOS Emergency Requests'), description: t('Manual SOS button activations or emergency alert signals'), value: report.eventCounts.SOS ?? 0 },
      { metric: t('Total Safety Events'), description: t('Sum of all telemetry safety incidents and violations logged'), value: totalEvents },
    ];

    downloadFormattedExcel({
      title: t('Fleet Operations & Safety Audit Report'),
      subtitle: t('Weekly telematics aggregates, speed limit violations, and crash/SOS emergency signals'),
      dateRange: `${dateRange.from} ${t('to')} ${dateRange.to}`,
      kpis: [
        { label: t('Avg Safety Score'), value: report.avgScore.toFixed(1), tone: report.avgScore >= 80 ? 'success' : report.avgScore >= 60 ? 'warning' : 'danger' },
        { label: t('Trips Logged'), value: String(report.tripCount), tone: 'info' },
        { label: t('Critical Crashes/SOS'), value: String(crashAndSosCount), tone: crashAndSosCount > 0 ? 'danger' : 'success' },
        { label: t('Traffic Violations'), value: String(totalEvents), tone: totalEvents > 5 ? 'warning' : 'neutral' },
      ],
      columns: cols,
      rows,
      sheetName: 'Safety aggregates',
    });
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
              {t('Export Spreadsheet')}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'safety' || user?.role === 'INSURER' ? (
        <div className="space-y-6">
          {/* Safety Metric Cards */}
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

          {/* Visual Analytics Charts - Side-by-Side grid */}
          {!reportQuery.isLoading && report && (
            <div className="grid gap-5 md:grid-cols-2">
              <TrendChart dailyScores={report.dailyScores} />
              <EventDistributionChart eventCounts={report.eventCounts} />
            </div>
          )}

          {/* Compliance Traffic Fines */}
          <TrafficFinesCard />

          {/* Risky Rankings - Side-by-Side grid */}
          <div className="grid gap-5 md:grid-cols-2">
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
          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {leasesQuery.isLoading ? (
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
                  title={t('Lease Arrears')}
                  value={`${leaseMetrics.leaseArrears.toLocaleString()} RWF`}
                  hint={t('Accumulated overdue lease payments.')}
                  icon={<Banknote size={18} />}
                  tone={leaseMetrics.leaseArrears > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  title={t('Traffic Fines')}
                  value={`${leaseMetrics.totalFines.toLocaleString()} RWF`}
                  hint={t('Accumulated unpaid traffic fines.')}
                  icon={<AlertTriangle size={18} />}
                  tone={leaseMetrics.totalFines > 0 ? 'warning' : 'neutral'}
                />
              </>
            )}
          </section>

          {/* Summary breakdown row */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Portfolio Equity Pie Chart */}
            <DashboardCard
              eyebrow={t('Financing distribution')}
              title={t('Portfolio principal breakdown')}
              description={t('Total paid equity vs remaining outstanding principal')}
            >
              {leasesQuery.isLoading ? (
                <div className="h-44 w-full bg-surface-muted rounded-[20px] animate-pulse" />
              ) : leases.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                  <div className="relative h-32 w-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={equityBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={34}
                          outerRadius={46}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {equityBreakdownData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider">{t('Equity')}</span>
                      <span className="text-xs font-bold text-ink leading-none text-center">
                        {leaseMetrics.overallEquity}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid gap-2 text-xs">
                     {equityBreakdownData.map(entry => (
                       <div key={entry.name} className="flex items-center gap-2">
                         <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                         <span className="font-semibold text-ink-soft min-w-[110px]">{entry.name}</span>
                         <span className="font-mono text-ink font-bold">{entry.value.toLocaleString()} RWF</span>
                       </div>
                     ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Coins size={18} />}
                  title={t('No equity data')}
                  description={t('Principal equity charts will appear once lease agreements exist.')}
                />
              )}
            </DashboardCard>

            {/* Delinquent Arrears Risk Rankings */}
            <DashboardCard
              eyebrow={t('Financing Risk')}
              title={t('Top delinquent accounts')}
              description={t('Riders with the highest outstanding arrears balances.')}
            >
              {leasesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full animate-pulse rounded-[10px]" />
                  <Skeleton className="h-10 w-full animate-pulse rounded-[10px]" />
                </div>
              ) : topDelinquentLeases.length > 0 ? (
                <ul className="space-y-3 max-h-[160px] overflow-y-auto pr-1 dashboard-scrollbar">
                  {topDelinquentLeases.map((lease, index) => (
                    <li key={lease.id} className="rounded-xl border border-line bg-surface-muted px-4 py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-surface-strong text-[10px] font-bold flex items-center justify-center text-ink-muted">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-ink leading-none">{lease.riderName}</p>
                          <p className="text-[10px] text-ink-muted mt-1">{lease.bikeLabel} &middot; {lease.bikePlate}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-danger-ink bg-danger-soft/20 px-2 py-0.5 rounded">
                        {lease.arrears.toLocaleString()} RWF
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<TrendingUp size={18} />}
                  title={t('No delinquent leases')}
                  description={t('All active lease-to-own agreements have healthy payment records.')}
                />
              )}
            </DashboardCard>
          </div>

          {/* Lease Portfolio Table */}
          <DashboardCard
            eyebrow={t('Financing Reports')}
            title={t('Buy-to-own portfolio summary')}
            description={t('Track asset ownership payments, overdue balances, and driver equity milestones.')}
            actions={
              <button
                type="button"
                disabled={leases.length === 0}
                onClick={handleExportLeasePortfolio}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-muted hover:bg-surface-hover text-ink-soft hover:text-ink transition-all px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <Download size={12} />
                {t('Export Portfolio')}
              </button>
            }
          >
            <div className="overflow-x-auto dashboard-scrollbar mt-2">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-ink-faint">
                    <th className="py-2.5 font-bold">{t('Rider')}</th>
                    <th className="py-2.5 font-bold">{t('Bike details')}</th>
                    <th className="py-2.5 font-bold">{t('Ownership Equity')}</th>
                    <th className="py-2.5 font-bold">{t('Daily Rate')}</th>
                    <th className="py-2.5 font-bold">{t('Lease Arrears')}</th>
                    <th className="py-2.5 font-bold">{t('Traffic Fines')}</th>
                    <th className="py-2.5 font-bold text-right">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leasesQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-muted">
                        {t('Loading leases report...')}
                      </td>
                    </tr>
                  ) : leases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-muted">
                        {t('No lease contracts registered')}
                      </td>
                    </tr>
                  ) : (
                    leases.map((lease: LeaseContract) => {
                      const pct = lease.totalPrincipal > 0 ? Math.min(100, Math.max(0, Math.round((lease.totalPaid / lease.totalPrincipal) * 100))) : 0;
                      const fines = lease.pendingFines || 0;
                      const lArrears = Math.max(0, lease.arrears - fines);
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
                              lArrears > 0 ? "text-danger-ink bg-danger-soft/20" : "text-ink-soft"
                            )}>
                              {lArrears.toLocaleString()} RWF
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={cx(
                              "font-mono font-bold text-xs px-2 py-0.5 rounded",
                              fines > 0 ? "text-danger-ink bg-danger-soft/20" : "text-ink-soft"
                            )}>
                              {fines.toLocaleString()} RWF
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

interface TrafficFineRecord {
  id: string;
  amount: number;
  reason: string;
  ticketNumber: string;
  status: string;
  finedAt: string;
  rider?: {
    id: string;
    phone: string;
    email: string;
    riderProfile?: {
      fullName: string;
    } | null;
    bikeAssignments?: Array<{
      bike?: {
        label: string;
        plate?: string | null;
      };
    }>;
  } | null;
}

function TrafficFinesCard() {
  const { t } = useTranslation();

  const { data: fines = [], isLoading } = useQuery({
    queryKey: ['traffic-fines'],
    queryFn: () => apiFetch<TrafficFineRecord[]>('/traffic-fines'),
  });

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
            {isLoading ? (
              <div className="text-center py-4 text-xs text-ink-muted">
                {t('Loading traffic fines...')}
              </div>
            ) : fines.length === 0 ? (
              <div className="text-center py-4 text-xs text-ink-muted">
                {t('No traffic fines registered')}
              </div>
            ) : (
              fines.map((fine: TrafficFineRecord) => {
                const activeAssignment = fine.rider?.bikeAssignments?.[0];
                const bike = activeAssignment?.bike;
                const vehicleLabel = bike
                  ? `${bike.label} (${bike.plate || 'N/A'})`
                  : `${fine.rider?.riderProfile?.fullName ?? t('Unknown Rider')} (No assigned bike)`;

                return (
                  <div key={fine.id} className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr] gap-3 text-xs text-ink-soft items-center border-b border-white/[0.02] pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold text-ink">{vehicleLabel}</span>
                    <span>{t(fine.reason)}</span>
                    <span className="font-mono">{fine.amount.toLocaleString()} RWF</span>
                    <span>
                      <Badge
                        label={t(fine.status)}
                        tone={fine.status === 'PAID' ? 'success' : 'danger'}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {new Date(fine.finedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
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

