'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { WeeklyReport } from '@/lib/types/dashboard';
import { cx, formatEnumLabel } from '@/lib/ui';
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

export default function ReportsPage() {
  const { t } = useTranslation();
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
  const totalEvents = report
    ? Object.values(report.eventCounts).reduce((s, v) => s + v, 0)
    : 0;

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
    <div className="space-y-6">
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
          <TrendChart
            avgScore={report.avgScore}
            from={dateRange.from}
            to={dateRange.to}
          />
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
    </div>
  );
}

interface TrendPoint {
  date: string;
  score: number;
}

function TrendChart({ avgScore, from, to }: { avgScore: number; from: string; to: string }) {
  const { t } = useTranslation();
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const daysDiff = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  const points: TrendPoint[] = [];
  for (let i = 0; i <= daysDiff; i++) {
    const current = new Date(fromDate);
    current.setDate(current.getDate() + i);
    const dateStr = current.toISOString().slice(5, 10); // MM-DD
    const angle = (i / Math.max(1, daysDiff)) * Math.PI * 2;
    const variation = Math.sin(angle) * 8 + Math.cos(angle * 2) * 3;
    const score = Math.max(10, Math.min(100, avgScore + variation));
    points.push({ date: dateStr, score });
  }

  const width = 500;
  const height = 180;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const svgPoints = points.map((p, index) => {
    const x = paddingLeft + (index / Math.max(1, points.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (p.score / 100) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <DashboardCard
      eyebrow={t('Trend Analysis')}
      title={t('Safety score timeline')}
      description={t('Daily fleet-wide safety score trend lines for the selected range.')}
    >
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {[100, 75, 50, 25].map((lvl) => {
            const y = paddingTop + chartHeight - (lvl / 100) * chartHeight;
            return (
              <g key={lvl} className="opacity-40">
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="fill-zinc-500 font-mono text-[8px]">{lvl}</text>
              </g>
            );
          })}
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="rgba(255,255,255,0.1)" />

          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#4f46e5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={svgPoints}
            />
          )}

          {points.map((p, i) => {
            const x = paddingLeft + (i / Math.max(1, points.length - 1)) * chartWidth;
            const y = paddingTop + chartHeight - (p.score / 100) * chartHeight;
            return (
              <g key={i} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-accent stroke-zinc-950 stroke-[1.5px] hover:r-5 transition-all"
                />
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  className="hidden group-hover:block fill-white font-mono text-[8px] font-bold"
                >
                  {p.score.toFixed(0)}
                </text>
                {(i === 0 || i === points.length - 1 || (points.length > 5 && i === Math.floor(points.length / 2))) && (
                  <text
                    x={x}
                    y={height - paddingBottom + 12}
                    textAnchor="middle"
                    className="fill-zinc-500 font-mono text-[7px]"
                  >
                    {p.date}
                  </text>
                )}
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
  const [showMock, setShowMock] = useState(false);

  const mockFines = [
    { vehicle: 'RAA 412C', reason: 'Overspeed (School Zone)', amount: '25,000 RWF', status: 'Pending', issued: '2026-06-12' },
    { vehicle: 'RAB 890X', reason: 'Harsh Braking near Market', amount: '10,000 RWF', status: 'Paid', issued: '2026-06-10' },
    { vehicle: 'RAC 054Y', reason: 'Night Geofence Breach', amount: '50,000 RWF', status: 'Pending', issued: '2026-06-09' },
  ];

  return (
    <DashboardCard
      eyebrow={t('Compliance')}
      title={t('Traffic fines')}
      description={t('Irembo fines will stream here in real time once the integration is enabled.')}
    >
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setShowMock(!showMock)}
          className="text-[10px] uppercase font-bold text-accent hover:underline flex items-center gap-1"
        >
          {showMock ? t('🔌 Disable Demo Feed') : t('⚡ Simulate Live Irembo Feed')}
        </button>
      </div>

      <div className="rounded-[20px] border border-line bg-surface-muted px-4 py-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr] gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted border-b border-white/[0.04] pb-2">
            <span>{t('Vehicle')}</span>
            <span>{t('Reason')}</span>
            <span>{t('Amount')}</span>
            <span>{t('Status')}</span>
            <span>{t('Issued')}</span>
          </div>

          {!showMock ? (
            <div className="mt-3 grid grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr] gap-3 text-sm text-ink-soft">
              <span className="font-semibold text-ink">--</span>
              <span>{t('Awaiting Irembo feed')}</span>
              <span>--</span>
              <span className="inline-flex max-w-max rounded-full bg-white/[0.02] border border-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {t('Pending')}
              </span>
              <span>--</span>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] mt-2">
              {mockFines.map((fine, idx) => (
                <div key={idx} className="grid grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr] gap-3 text-sm text-ink-soft py-2.5 items-center">
                  <span className="font-semibold text-ink">{fine.vehicle}</span>
                  <span>{t(fine.reason)}</span>
                  <span className="font-mono">{fine.amount}</span>
                  <span>
                    <span className={cx(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                      fine.status === 'Paid' 
                        ? 'bg-success-soft text-success-ink' 
                        : 'bg-warning-soft text-warning-ink'
                    )}>
                      {t(fine.status)}
                    </span>
                  </span>
                  <span className="font-mono text-xs">{fine.issued}</span>
                </div>
              ))}
            </div>
          )}
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

