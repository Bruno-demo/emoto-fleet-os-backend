'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bike,
  CheckCircle2,
  Circle,
  Coins,
  CreditCard,
  DollarSign,
  Gauge,
  Lock,
  MapPin,
  Palette,
  PieChart,
  Receipt,
  Settings,
  ShieldAlert,
  Siren,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { canUseFeature } from '@/lib/subscription';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import type { Incident, PaginatedResponse, WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo, getLocalDateString } from '@/lib/ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';

interface FinancialSummaryResponse {
  totalEarnedAllTime: number;
  totalEarnedRange: number;
  totalLeaseArrears: number;
  overdueCount: number;
  unpaidCount: number;
  methodBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  dailyEarnings: Array<{ date: string; amount: number }>;
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

export default function OverviewPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState(getDefaultRange);
  const { data: user } = useCurrentUser();
  const canUseReports = canUseFeature(user, 'reports');
  const canUseIncidents = canUseFeature(user, 'incidents');
  const canUseFinancials = canUseFeature(user, 'financial');

  const weeklyReportQuery = useQuery({
    queryKey: ['reports', 'weekly', dateRange.from, dateRange.to],
    queryFn: () =>
      apiFetch<WeeklyReport>(`/reports/weekly?from=${dateRange.from}&to=${dateRange.to}`),
    enabled: canUseReports,
  });

  const financialsQuery = useQuery({
    queryKey: ['financials', 'summary', dateRange.from, dateRange.to],
    queryFn: () =>
      apiFetch<FinancialSummaryResponse>(
        `/financials/summary?startDate=${dateRange.from}&endDate=${dateRange.to}`,
      ),
    enabled: canUseFinancials && !!user && user.role !== 'INSURER',
  });

  const incidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-open'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?status=OPEN&page=1&pageSize=5'),
    enabled: canUseIncidents,
  });

  const recentIncidentsQuery = useQuery({
    queryKey: ['incidents', 'overview-recent'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Incident>>('/incidents?page=1&pageSize=8'),
    enabled: canUseIncidents,
  });

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'overview-count'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string }>>('/bikes?page=1&pageSize=1'),
  });

  const ridersQuery = useQuery({
    queryKey: ['riders', 'overview-count'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string }>>('/riders?page=1&pageSize=1'),
    enabled: !!user && user.role !== 'INSURER',
  });

  const zonesQuery = useQuery({
    queryKey: ['zones', 'overview-count'],
    queryFn: () => apiFetch<PaginatedResponse<{ id: string }>>('/zones?page=1&pageSize=1'),
    enabled: !!user && user.role !== 'INSURER',
  });

  const fleetSettingsQuery = useQuery({
    queryKey: ['fleet-settings', 'overview-check'],
    queryFn: () => apiFetch<{ momoPhoneNumber?: string | null }>('/subscription/fleet-settings'),
    enabled: !!user && user.role !== 'INSURER',
  });

  const report = weeklyReportQuery.data;
  const financialSummary = financialsQuery.data;
  const openIncidents = incidentsQuery.data?.total ?? 0;
  const totalBikes = bikesQuery.data?.total ?? 0;
  const totalRiders = ridersQuery.data?.total ?? 0;
  const totalZones = zonesQuery.data?.total ?? 0;
  const momoConfigured = Boolean(fleetSettingsQuery.data?.momoPhoneNumber);
  const recentIncidents = recentIncidentsQuery.data?.data ?? [];

  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('emoto_onboarding_dismissed') === 'true';
    }
    return false;
  });

  const handleDismissOnboarding = () => {
    setIsOnboardingDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('emoto_onboarding_dismissed', 'true');
    }
  };

  const onboardingSteps = [
    {
      id: 'bikes',
      title: t('Register Your First Moto'),
      desc: t('Add your motorcycles to track telemetry, location, and status.'),
      href: '/bikes',
      icon: <Bike size={18} className="text-accent" />,
      isCompleted: totalBikes > 0,
      actionText: t('Add Moto'),
    },
    {
      id: 'riders',
      title: t('Onboard Your First Motari'),
      desc: t('Register riders to manage assignments, daily leases, and safety scores.'),
      href: '/riders',
      icon: <Users size={18} className="text-accent" />,
      isCompleted: totalRiders > 0,
      actionText: t('Onboard Motari'),
    },
    {
      id: 'zones',
      title: t('Create Your First Zone'),
      desc: t('Define operational geofences to monitor fleet boundary movements & security alerts.'),
      href: '/zones',
      icon: <MapPin size={18} className="text-accent" />,
      isCompleted: totalZones > 0,
      actionText: t('Create Zone'),
    },
    {
      id: 'theme',
      title: t('Customize Theme & Appearance'),
      desc: t('Configure your preferred visual theme, language, and workspace layout preferences.'),
      href: '/settings',
      icon: <Palette size={18} className="text-accent" />,
      isCompleted: true,
      actionText: t('Set Up Theme'),
    },
  ];

  const completedCount = onboardingSteps.filter((s) => s.isCompleted).length;
  const progressPercent = Math.round((completedCount / onboardingSteps.length) * 100);

  const totalEvents = report
    ? Object.values(report.eventCounts).reduce((s, v) => s + v, 0)
    : 0;

  // Compute financial metric calculations
  const totalRevenuePeriod = financialSummary?.totalEarnedRange ?? 0;
  const totalArrears = financialSummary?.totalLeaseArrears ?? 0;
  const dailyEarningsList = financialSummary?.dailyEarnings ?? [];
  const daysInPeriod = Math.max(1, dailyEarningsList.length);
  const avgDailyRevenue = Math.round(totalRevenuePeriod / daysInPeriod);

  // Method breakdown totals
  const methodMap = financialSummary?.methodBreakdown ?? {};
  const momoEarned = methodMap['MOMO'] ?? 0;
  const cashEarned = methodMap['CASH'] ?? 0;
  const bankEarned = methodMap['BANK'] ?? 0;
  const methodSum = momoEarned + cashEarned + bankEarned;

  return (
    <div className="space-y-8 pb-12">
      {/* Date Range Picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {t('Fleet Command Overview')}
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {t('Real-time operational, safety risk, and financial collection performance dashboard.')}
          </p>
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
      </div>

      {/* Checklist Widget */}
      {!isOnboardingDismissed && user?.role !== 'INSURER' && completedCount < 4 && (
        <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-surface via-surface to-accent/5 p-6 shadow-sm transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Sparkles size={16} />
                </span>
                <h2 className="text-base font-bold text-ink">
                  {t('Welcome to eMoto Fleet OS!')}
                </h2>
                <Badge tone="info" size="sm" label={`${completedCount} / 4 ${t('Completed')}`} />
              </div>
              <p className="text-xs text-ink-muted">
                {t('Complete these quick setup steps to get your fleet fully operational on the road.')}
              </p>
            </div>
            <button
              onClick={handleDismissOnboarding}
              className="self-start text-xs text-ink-faint hover:text-ink transition-colors flex items-center gap-1 sm:self-auto"
              title={t('Dismiss checklist')}
            >
              <span>{t('Dismiss')}</span>
              <X size={14} />
            </button>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {onboardingSteps.map((step, idx) => (
              <div
                key={step.id}
                className={cx(
                  'flex flex-col justify-between rounded-xl border p-4 transition-all',
                  step.isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-line bg-surface hover:border-accent/40'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        {step.icon}
                      </span>
                      <span className="text-xs font-bold text-ink-muted">
                        0{idx + 1}
                      </span>
                    </div>
                    {step.isCompleted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={14} />
                        {t('Done')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-ink-faint">
                        <Circle size={14} />
                        {t('Pending')}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
                      {step.desc}
                    </p>
                  </div>
                </div>

                {!step.isCompleted && (
                  <Link
                    href={step.href}
                    className="mt-4 flex items-center justify-between rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-all group"
                  >
                    <span>{step.actionText}</span>
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================================================================== */}
      {/* SECTION 1: OPERATIONS & FLEET SAFETY (TOP 50%)                       */}
      {/* ==================================================================== */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-line/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Gauge size={16} />
            </span>
            <h2 className="text-base font-bold text-ink">
              {t('1. Operations & Safety Performance')}
            </h2>
          </div>
          <Badge tone="info" label={t('50% Operational Focus')} />
        </div>

        {/* Operational KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                value={canUseReports ? (report ? String(report.tripCount) : '--') : '🔒'}
                hint={canUseReports ? (user?.role === 'INSURER' ? t('Trips by covered bikes') : t('Trips in current window')) : t('Upgrade fleet plan')}
                icon={<Bike size={18} />}
                tone="info"
              />
              <MetricCard
                title={user?.role === 'INSURER' ? t('Covered Score') : t('Fleet Score')}
                value={canUseReports ? (report ? report.avgScore.toFixed(1) : '--') : '🔒'}
                hint={canUseReports ? t('Avg driving score across completed trips') : t('Upgrade fleet plan')}
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
                title={user?.role === 'INSURER' ? t('Open Incidents') : t('Open Incidents')}
                value={canUseIncidents ? String(openIncidents) : '🔒'}
                hint={canUseIncidents ? t('Awaiting resolution') : t('Upgrade fleet plan')}
                icon={<ShieldAlert size={18} />}
                tone={canUseIncidents && openIncidents > 0 ? 'danger' : 'neutral'}
              />
              <MetricCard
                title={user?.role === 'INSURER' ? t('Risk Events') : t('Total Events')}
                value={canUseReports ? String(totalEvents) : '🔒'}
                hint={canUseReports ? `${report?.eventCounts.CRASH ?? 0} ${t('crashes')} · ${report?.eventCounts.HARSH_BRAKE ?? 0} ${t('brakes')}` : t('Upgrade fleet plan')}
                icon={<Zap size={18} />}
                tone="warning"
              />
            </>
          )}
        </div>

        {/* Operational Stats Sub-bar */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FleetStatCard
            label={user?.role === 'INSURER' ? t('Insured Bikes') : t('Active Bikes')}
            value={totalBikes}
            icon={<Bike size={16} />}
            loading={bikesQuery.isLoading}
          />
          <FleetStatCard
            label={user?.role === 'INSURER' ? t('Covered Risk Events') : t('Risk Events')}
            value={canUseReports ? totalEvents : '🔒'}
            icon={<AlertTriangle size={16} />}
            loading={canUseReports && weeklyReportQuery.isLoading}
          />
          <FleetStatCard
            label={user?.role === 'INSURER' ? t('Covered Incidents') : t('Incidents')}
            value={canUseIncidents ? openIncidents : '🔒'}
            icon={<Siren size={16} />}
            loading={canUseIncidents && incidentsQuery.isLoading}
            urgent={canUseIncidents && openIncidents > 0}
          />
        </div>

        {/* Main Operational Grid */}
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            {report && (
              <TrendChart dailyScores={report.dailyScores} />
            )}

            <DashboardCard
              eyebrow={t('Risk Profile')}
              title={t('Safety Event Histogram & Breakdown')}
              actions={
                user?.role === 'INSURER' || !canUseReports ? null : (
                  <Link
                    href="/events"
                    className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    {t('View all')} <ArrowRight size={12} />
                  </Link>
                )
              }
            >
              {!canUseReports ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent mb-3 animate-pulse">
                    <Lock size={18} />
                  </span>
                  <p className="text-xs font-bold text-ink">{t('Event Breakdown Locked')}</p>
                  <p className="text-[11px] text-ink-muted max-w-[280px] mt-1 mb-4 leading-relaxed">
                    {t('Detailed crash, speeding, and driving safety event breakdowns require an active fleet plan.')}
                  </p>
                  <Link
                    href="/checkout?plan=delivery"
                    className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 shadow-md shadow-accent/20 cursor-pointer"
                  >
                    {t('Upgrade fleet plan')}
                  </Link>
                </div>
              ) : weeklyReportQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : report && totalEvents > 0 ? (
                <div className="space-y-3">
                  {Object.entries(report.eventCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => {
                      const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
                      return (
                        <div key={type} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={cx(
                                  'flex h-6 w-6 items-center justify-center rounded-md text-[10px]',
                                  type === 'CRASH'
                                    ? 'bg-danger-soft text-danger-ink'
                                    : type === 'SPEEDING'
                                      ? 'bg-warning-soft text-warning-ink'
                                      : 'bg-accent/20 text-accent',
                                )}
                              >
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
              ) : (
                <EmptyState
                  icon={<Activity size={18} />}
                  title={t('No events this week')}
                  description={t('Event distribution appears once telemetry generates activity.')}
                />
              )}
            </DashboardCard>
          </div>

          <div className="space-y-5">
            <DashboardCard
              eyebrow={t('Watchlist')}
              title={user?.role === 'INSURER' ? t('Insured Risky Bikes') : t('Risky bikes')}
              actions={
                !canUseReports ? null : (
                  <Link
                    href="/bikes"
                    className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    {user?.role === 'INSURER' ? t('Bikes') : t('Fleet')} <ArrowRight size={12} />
                  </Link>
                )
              }
            >
              {!canUseReports ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent mb-2 animate-pulse">
                    <Lock size={16} />
                  </span>
                  <p className="text-xs font-bold text-ink">{t('Watchlist Locked')}</p>
                </div>
              ) : (
                <WatchlistSection
                  emptyLabel={t('No risky bikes this week')}
                  items={(report?.topRiskyBikes ?? []).slice(0, 4).map((bike) => ({
                    id: bike.bikeId,
                    title: bike.label,
                    subtitle: `${bike.tripCount} ${t('trips')} · ${bike.eventCount} ${t('events')}`,
                    score: bike.avgScore,
                  }))}
                  loading={weeklyReportQuery.isLoading}
                />
              )}
            </DashboardCard>

            <DashboardCard eyebrow={t('Quick actions')} title={t('Shortcuts')}>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction href="/live" icon={<Gauge size={16} />} label={t('Live Map')} />
                <QuickAction href="/incidents" icon={<Siren size={16} />} label={t('Incidents')} />
                <QuickAction href="/bikes" icon={<Bike size={16} />} label={t('Fleet')} />
                <QuickAction href="/financial" icon={<Wallet size={16} />} label={t('Financials')} />
              </div>
            </DashboardCard>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 2: FINANCIAL REVENUE & COLLECTIONS (BOTTOM 50%)              */}
      {/* ==================================================================== */}
      {user?.role !== 'INSURER' && (
        <section className="space-y-5 pt-4">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wallet size={16} />
              </span>
              <h2 className="text-base font-bold text-ink">
                {t('2. Financial Revenue & Rider Collections')}
              </h2>
            </div>
            <Badge tone="success" label={t('50% Financial Focus')} />
          </div>

          {/* Financial KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {financialsQuery.isLoading ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <MetricCard
                  title={t('Total Revenue Collected')}
                  value={`${totalRevenuePeriod.toLocaleString()} RWF`}
                  hint={`${dailyEarningsList.length} ${t('days in selected period')}`}
                  icon={<DollarSign size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t('Daily Average Revenue')}
                  value={`${avgDailyRevenue.toLocaleString()} RWF`}
                  hint={t('Average daily rider lease collections')}
                  icon={<Coins size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t('Total Lease Arrears')}
                  value={`${totalArrears.toLocaleString()} RWF`}
                  hint={t('Outstanding rider debt & overdue fees')}
                  icon={<Receipt size={18} />}
                  tone={totalArrears > 0 ? 'warning' : 'success'}
                />
                <MetricCard
                  title={t('Collection Status')}
                  value={`${financialSummary?.overdueCount ?? 0} ${t('Overdue')}`}
                  hint={`${financialSummary?.unpaidCount ?? 0} ${t('Unpaid payment logs')}`}
                  icon={<CreditCard size={18} />}
                  tone={(financialSummary?.overdueCount ?? 0) > 0 ? 'danger' : 'neutral'}
                />
              </>
            )}
          </div>

          {/* Financial Histograms & Distribution Row */}
          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            {/* Left: Revenue Histogram */}
            <RevenueHistogram
              dailyEarnings={dailyEarningsList}
              loading={financialsQuery.isLoading}
            />

            {/* Right: Payment Channels & Method Distribution */}
            <DashboardCard
              eyebrow={t('Payment Channels')}
              title={t('Revenue Method Breakdown')}
              description={t('Distribution of collections across Mobile Money, Cash, and Bank Transfers.')}
              actions={
                <Link
                  href="/financial"
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {t('Financial ledger')} <ArrowRight size={12} />
                </Link>
              }
            >
              {financialsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : methodSum > 0 ? (
                <div className="space-y-4 pt-1">
                  {/* MoMo */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Mobile Money (MoMo)
                      </span>
                      <span className="font-bold text-ink font-mono">
                        {momoEarned.toLocaleString()} RWF ({Math.round((momoEarned / methodSum) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${(momoEarned / methodSum) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Cash */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-400" />
                        Cash Direct
                      </span>
                      <span className="font-bold text-ink font-mono">
                        {cashEarned.toLocaleString()} RWF ({Math.round((cashEarned / methodSum) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                        style={{ width: `${(cashEarned / methodSum) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Bank */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-violet-400" />
                        Bank Transfer
                      </span>
                      <span className="font-bold text-ink font-mono">
                        {bankEarned.toLocaleString()} RWF ({Math.round((bankEarned / methodSum) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full bg-violet-400 rounded-full transition-all duration-500"
                        style={{ width: `${(bankEarned / methodSum) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-ink-muted">
                    <span>Total Period Collections:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      {methodSum.toLocaleString()} RWF
                    </span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<PieChart size={18} />}
                  title={t('No payments recorded')}
                  description={t('Rider payment methods will display here once recorded.')}
                />
              )}
            </DashboardCard>
          </div>
        </section>
      )}
    </div>
  );
}

function RevenueHistogram({
  dailyEarnings,
  loading,
}: {
  dailyEarnings: Array<{ date: string; amount: number }>;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!dailyEarnings || dailyEarnings.length === 0) {
    return (
      <DashboardCard
        eyebrow={t('Financial Analytics')}
        title={t('Daily Revenue Collection Histogram')}
      >
        <EmptyState
          icon={<DollarSign size={20} />}
          title={t('No financial collection data')}
          description={t('Collections will appear here as daily rider payments are recorded.')}
        />
      </DashboardCard>
    );
  }

  const maxAmount = Math.max(...dailyEarnings.map((d) => d.amount), 1);
  const totalInPeriod = dailyEarnings.reduce((s, d) => s + d.amount, 0);

  return (
    <DashboardCard
      eyebrow={t('Financial Analytics')}
      title={t('Daily Revenue Collection Histogram')}
      description={`${t('Period Revenue:')} ${totalInPeriod.toLocaleString()} RWF · ${dailyEarnings.length} ${t('days recorded')}`}
    >
      <div className="pt-2 pb-1 space-y-4">
        {/* Histogram Bars Container */}
        <div className="relative w-full overflow-x-auto">
          <div className="min-w-[420px] h-[200px] flex items-end justify-between gap-2 pt-6 pb-2 px-1">
            {dailyEarnings.map((item) => {
              const heightPct = Math.max(8, Math.round((item.amount / maxAmount) * 100));
              const formattedAmt = item.amount.toLocaleString();
              return (
                <div key={item.date} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-white/10 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-xl z-20 whitespace-nowrap pointer-events-none">
                    <p className="text-emerald-400 font-semibold">{item.date}</p>
                    <p>{formattedAmt} RWF</p>
                  </div>

                  {/* Bar height & label */}
                  <span className="text-[9px] font-mono font-bold text-ink-muted mb-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    {item.amount > 0 ? (item.amount >= 1000 ? `${Math.round(item.amount / 1000)}k` : item.amount) : '0'}
                  </span>

                  {/* Histogram Bar element */}
                  <div
                    className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-emerald-600/70 to-emerald-400 border-t border-x border-emerald-400/40 transition-all duration-300 group-hover:brightness-125 group-hover:shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                    style={{ height: `${heightPct}%` }}
                  />

                  {/* X Axis Date label */}
                  <span className="text-[10px] font-mono text-ink-muted mt-2 truncate w-full text-center">
                    {item.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardCard>
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
  value: React.ReactNode;
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
      title={t('Fleet Safety Score Timeline')}
      description={t('Daily safety score trend lines for active operating motorcycles.')}
    >
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

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

          {dailyScores.length > 1 && (
            <path d={areaPath} fill="url(#areaGradient)" />
          )}

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
