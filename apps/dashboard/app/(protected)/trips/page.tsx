'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  Route,
  Bike,
  User,
  Clock,
  Battery,
  BatteryCharging,
  AlertTriangle,
  CalendarDays,
  Gauge,
  Milestone,
  ArrowRight,
  Search,
  X,
  ShieldCheck,
  Map,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';

import { TextField } from '@/components/ui/form-controls';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { FleetTrip, PaginatedResponse } from '@/lib/types/dashboard';
import { formatEnumLabel, formatTimestamp } from '@/lib/ui';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { getSubscriptionEntitlements } from '@/lib/subscription';
import { useTranslation } from '@/components/i18n/LanguageProvider';

function LoadingReplayMap() {
  const { t } = useTranslation();
  return (
    <div className="h-72 w-full flex items-center justify-center rounded-2xl border border-line bg-surface-muted text-sm text-ink-soft animate-pulse">
      {t('Loading route replay map...')}
    </div>
  );
}

const TripReplayMap = dynamic(
  () => import('@/components/trips/trip-replay-map').then((mod) => mod.TripReplayMap),
  {
    ssr: false,
    loading: () => <LoadingReplayMap />,
  },
);

const PAGE_SIZE = 20;

export default function TripsPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const entitlements = useMemo(() => getSubscriptionEntitlements(user), [user]);

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minScore, setMinScore] = useState('');

  // Fetch all trips in the fleet scope using selected filters
  const tripsQuery = useQuery({
    queryKey: ['trips', page, from, to, minScore, searchQuery],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetTrip>>(
        `/trips${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          from: toIsoUtcOrUndefined(from),
          to: toIsoUtcOrUndefined(to),
          minScore: minScore ? Number(minScore) : undefined,
          search: searchQuery.trim() || undefined,
        })}`,
      ),
  });

  // Reset page to 1 when search query changes to prevent blank pages
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const trips = useMemo(() => tripsQuery.data?.data ?? [], [tripsQuery.data?.data]);

  const [accumulatedTrips, setAccumulatedTrips] = useState<FleetTrip[]>([]);

  useEffect(() => {
    if (page === 1) {
      setAccumulatedTrips(trips);
    } else {
      setAccumulatedTrips((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTrips = trips.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTrips];
      });
    }
  }, [trips, page]);

  // Clientside filtering for searchable fields (bike label, rider name, trip ID)
  const filteredTrips = accumulatedTrips;

  const selectedTrip = useMemo(
    () => accumulatedTrips.find((t) => t.id === selectedTripId) ?? null,
    [accumulatedTrips, selectedTripId],
  );

  // Compute metric aggregates for the visible dataset
  const metrics = useMemo(() => {
    const total = tripsQuery.data?.total ?? 0;
    
    let totalDist = 0;
    let totalScore = 0;
    let batteryCount = 0;
    let totalBatteryDrop = 0;

    trips.forEach((trip) => {
      totalDist += trip.distanceKm;
      totalScore += trip.score;
      if (trip.powerUsedPct !== null && trip.powerUsedPct !== undefined) {
        totalBatteryDrop += trip.powerUsedPct;
        batteryCount++;
      }
    });

    const avgScore = trips.length ? Math.round(totalScore / trips.length) : 0;
    const avgBatteryDrop = batteryCount ? Math.round((totalBatteryDrop / batteryCount) * 10) / 10 : null;

    return {
      total,
      totalDistanceKm: totalDist,
      avgScore,
      avgBatteryDrop,
    };
  }, [trips, tripsQuery.data?.total]);

  // Format Duration into minutes/seconds/hours
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m ${s}s`;
  };

  // Define columns for trips list
  const columns = useMemo<Array<DataTableColumn<FleetTrip>>>(
    () => [
      {
        header: t('Trip & Actor'),
        render: (trip) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Bike size={13} />
              </span>
              <span className="font-semibold text-ink">{trip.bikeLabel ?? t('Unknown Bike')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <User size={11} className="text-ink-muted" />
              <span>{trip.riderName ?? t('Unassigned Rider')}</span>
            </div>
          </div>
        ),
      },
      {
        header: t('Start Date & Time'),
        render: (trip) => (
          <div>
            <p className="font-medium text-ink">{formatTimestamp(trip.startTs)}</p>
            <p className="mt-1 text-[11px] text-ink-muted">ID: {trip.id.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        header: t('Telematics'),
        render: (trip) => (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Milestone size={13} className="text-ink-muted" />
              <span>{trip.distanceKm.toFixed(2)} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Clock size={11} className="text-ink-muted" />
              <span>{formatDuration(trip.durationSec)}</span>
            </div>
          </div>
        ),
      },
      {
        header: t('Battery & Power Usage'),
        render: (trip) => {
          const powerUsed = trip.powerUsedPct;
          const startPct = trip.startBatteryPct;
          const endPct = trip.endBatteryPct;

          if (startPct === null || endPct === null) {
            return (
              <span className="text-xs text-ink-muted italic">{t('No telemetry')}</span>
            );
          }

          // Decide color based on severity of consumption
          const colorClass =
            powerUsed !== null && powerUsed > 30
              ? 'text-rose-400 bg-rose-400/10'
              : powerUsed !== null && powerUsed > 15
              ? 'text-amber-400 bg-amber-400/10'
              : 'text-emerald-400 bg-emerald-400/10';

          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs text-ink">
                <span className="font-medium">{startPct}%</span>
                <ArrowRight size={10} className="text-ink-muted" />
                <span className="font-medium">{endPct}%</span>
              </div>
              {powerUsed !== null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClass}`}>
                  <Battery size={10} className="fill-current" />
                  {t('{pct} used').replace('{pct}', powerUsed > 0 ? `-${powerUsed.toFixed(1)}%` : `+${Math.abs(powerUsed).toFixed(1)}%`)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: t('Safety Score'),
        render: (trip) => {
          const score = trip.score;
          const colorClass =
            score >= 90
              ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
              : score >= 70
              ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
              : 'bg-rose-400/10 text-rose-400 border-rose-400/20';

          return (
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${colorClass}`}>
              <ShieldCheck size={12} />
              {score} / 100
            </span>
          );
        },
      },
      {
        header: t('Action'),
        className: 'text-right',
        cellClassName: 'text-right',
        render: (trip) => (
          <button
            type="button"
            className="rounded-xl border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-surface-muted hover:border-accent/30"
            onClick={() => setSelectedTripId(trip.id)}
          >
            {t('View detail')}
          </button>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      {/* Metrics Section */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={t('Total Journeys')}
          value={String(metrics.total)}
          hint={t('Total journeys recorded inside fleet database scope.')}
          icon={<Route size={18} />}
          tone="info"
        />
        <MetricCard
          title={t('Active Page Dist.')}
          value={`${metrics.totalDistanceKm.toFixed(1)} km`}
          hint={t('Aggregated distance calculated from currently loaded page.')}
          icon={<Milestone size={18} />}
          tone="success"
        />
        <MetricCard
          title={t('Avg Safety Score')}
          value={`${metrics.avgScore} / 100`}
          hint={t('Historical driver safety evaluation aggregate.')}
          icon={<ShieldCheck size={18} />}
          tone={metrics.avgScore >= 80 ? 'success' : metrics.avgScore >= 60 ? 'warning' : 'danger'}
        />
        <MetricCard
          title={t('Avg Battery Cost')}
          value={metrics.avgBatteryDrop !== null ? `-${metrics.avgBatteryDrop}% / ${t('trip')}` : 'N/A'}
          hint={t('Average battery capacity cost consumed per completed trip.')}
          icon={<Battery size={18} />}
          tone={metrics.avgBatteryDrop !== null && metrics.avgBatteryDrop > 25 ? 'warning' : 'info'}
        />
      </section>

      {/* Filter and Table Section */}
      <DashboardCard
        eyebrow={t('Fleet Telemetry')}
        title={t('Trips History')}
        description={t('Inspect telemetry records, battery drops, and driving profiles across your vehicle fleet.')}
      >
        <DataTableToolbar
          actions={
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFrom('');
                setTo('');
                setMinScore('');
                setPage(1);
              }}
              className="rounded-xl border border-line bg-surface-hover px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-muted"
            >
              {t('Reset filters')}
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Search Input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t('Search Context')}</label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder={t('Search bike label, rider name, or ID...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[var(--radius-control)] border border-line bg-surface-hover py-3 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Min Safety Score */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t('Min Safety Score')}</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder={t('e.g. 70')}
                value={minScore}
                onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius-control)] border border-line bg-surface-hover py-3 px-4 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Start date from */}
            <TextField
              label={t('Start Date From')}
              type="datetime-local"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            />

            {/* Start date to */}
            <TextField
              label={t('Start Date To')}
              type="datetime-local"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
            />
          </div>
        </DataTableToolbar>

        {/* Trips Table */}
        <div className="mt-6">
          <DataTable
            data={filteredTrips}
            columns={columns}
            keyExtractor={(trip) => trip.id}
            loading={tripsQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Route size={18} />}
                title={t('No journeys found')}
                description={t('No historical journeys recorded match the current filters.')}
              />
            }
          />
        </div>

        {/* Pagination controls */}
        {accumulatedTrips.length < (tripsQuery.data?.total ?? 0) && (
          <div className="flex flex-col items-center justify-center gap-3 mt-6 pt-6 border-t border-line">
            <div className="w-64 bg-line rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (accumulatedTrips.length / (tripsQuery.data?.total ?? 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink-muted">
              {t('Showing {loaded} of {total} journeys')
                .replace('{loaded}', String(accumulatedTrips.length))
                .replace('{total}', String(tripsQuery.data?.total ?? 0))}
            </p>
            <button
              type="button"
              disabled={tripsQuery.isFetching}
              onClick={() => setPage((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {tripsQuery.isFetching ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <ChevronDown size={16} className="animate-bounce" />
              )}
              {tripsQuery.isFetching ? t('Loading...') : t('Load more')}
            </button>
          </div>
        )}
        {accumulatedTrips.length >= (tripsQuery.data?.total ?? 0) && (tripsQuery.data?.total ?? 0) > 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <Check size={14} /> {t('All {total} journeys loaded').replace('{total}', String(tripsQuery.data?.total ?? 0))}
            </p>
          </div>
        )}
      </DashboardCard>

      {/* Slide-out details drawer */}
      <Drawer
        open={!!selectedTripId}
        title={selectedTrip ? t('Trip detail: {bike}').replace('{bike}', selectedTrip.bikeLabel ?? t('Bike')) : t('Trip detail')}
        description={t('Comprehensive vehicle metrics, battery power consumption, and safety violations recorded.')}
        onClose={() => setSelectedTripId(null)}
      >
        {selectedTrip && (
          <div className="space-y-6">
            {/* Quick Summary Section */}
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('Linked Asset')}</span>
                <p className="mt-1 font-display text-base font-bold text-ink">{selectedTrip.bikeLabel ?? t('Unknown')}</p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/bikes?bikeId=${selectedTrip.bikeId}`}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Bike size={11} />
                    {t('Open asset')}
                  </Link>
                  <Link
                    href={`/live?bikeId=${selectedTrip.bikeId}`}
                    className="inline-flex items-center gap-1 text-xs text-ink hover:underline"
                  >
                    <Map size={11} />
                    {t('View Live')}
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('Rider / Operator')}</span>
                <p className="mt-1 font-display text-base font-bold text-ink">{selectedTrip.riderName ?? t('Unassigned')}</p>
                <span className="mt-2 block text-xs text-ink-muted">
                  ID: {selectedTrip.riderId ? selectedTrip.riderId.slice(0, 12) : 'N/A'}
                </span>
              </div>
            </section>

            {/* Route Analysis Map Section */}
            <DashboardCard
              eyebrow={t('Route Analysis')}
              title={t('Interactive Journey Replay')}
              description={t('Play back the historical telemetry path and vehicle status on the map.')}
            >
              {entitlements.isPremium ? (
                <TripRouteReplay tripId={selectedTrip.id} />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center bg-surface-hover/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent mb-3">
                    <Map size={18} />
                  </span>
                  <h4 className="text-sm font-bold text-white mb-1">{t('Route Replay Locked')}</h4>
                  <p className="text-xs text-zinc-400 max-w-xs mb-4">
                    {t('Trip map playback and speed telemetry replays are premium features. Upgrade to Operations Plus to unlock.')}
                  </p>
                  <Link
                    href="/checkout?plan=operations-plus"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent-strong"
                  >
                    {t('Upgrade plan')}
                  </Link>
                </div>
              )}
            </DashboardCard>

            {/* Battery Power Profiler */}
            <DashboardCard
              eyebrow={t('Energy Analysis')}
              title={t('Power & Battery Profile')}
              description={t('Battery capacity telemetry recorded during this trip lifecycle.')}
            >
              {selectedTrip.startBatteryPct !== null && selectedTrip.endBatteryPct !== null ? (
                <div className="space-y-4">
                  {/* Energy Drop Indicator bar */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-ink mb-1.5">
                      <span className="flex items-center gap-1">
                        <Battery size={13} className="text-emerald-400 fill-current" />
                        {t('Start: {pct}%').replace('{pct}', String(selectedTrip.startBatteryPct))}
                      </span>
                      <span className="flex items-center gap-1">
                        <BatteryCharging size={13} className="text-blue-400" />
                        {t('End: {pct}%').replace('{pct}', String(selectedTrip.endBatteryPct))}
                      </span>
                    </div>

                    <div className="relative h-2.5 w-full rounded-full bg-surface-muted overflow-hidden border border-line">
                      {/* Energy used visual bar */}
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${selectedTrip.endBatteryPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-2 text-center mt-2">
                    <div className="rounded-xl bg-surface-hover px-3 py-2 border border-line">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('Energy Cost')}</p>
                      <p className="mt-1 text-lg font-bold text-rose-400">
                        {selectedTrip.powerUsedPct !== null
                          ? t('{pct} drop').replace('{pct}', `${selectedTrip.powerUsedPct.toFixed(1)}%`)
                          : t('{pct} drop').replace('{pct}', `${(selectedTrip.startBatteryPct - selectedTrip.endBatteryPct).toFixed(1)}%`)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-surface-hover px-3 py-2 border border-line">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('Average Rate')}</p>
                      <p className="mt-1 text-lg font-bold text-ink">
                        {selectedTrip.distanceKm > 0 && selectedTrip.powerUsedPct !== null
                          ? t('{rate}% / km').replace('{rate}', (selectedTrip.powerUsedPct / selectedTrip.distanceKm).toFixed(2))
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <BatteryCharging size={24} className="text-ink-muted animate-pulse" />
                  <p className="mt-2 text-xs text-ink-soft">{t('Telemetry missing battery logs for this period.')}</p>
                </div>
              )}
            </DashboardCard>

            {/* Journey Stats */}
            <DashboardCard
              eyebrow={t('Telematics Details')}
              title={t('Journey Analytics')}
              description={t('Basic speed, distance, and duration telemetry statistics.')}
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{t('Distance')}</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">{selectedTrip.distanceKm.toFixed(2)} km</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{t('Duration')}</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">{formatDuration(selectedTrip.durationSec)}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{t('Avg Speed')}</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">
                    {selectedTrip.durationSec > 0
                      ? t('{speed} km/h').replace('{speed}', ((selectedTrip.distanceKm / (selectedTrip.durationSec / 3600))).toFixed(1))
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </DashboardCard>

            {/* Safety Score / Incidents */}
            <DashboardCard
              eyebrow={t('Safety Monitor')}
              title={t('Driving Profile')}
              description={t('Safety score and driving anomalies logged by stream processors.')}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-surface-hover p-4 border border-line">
                  <div className="space-y-1">
                    <span className="text-xs text-ink-soft">{t('Driver Safety Index')}</span>
                    <p className="text-xl font-bold text-ink">{selectedTrip.score} / 100</p>
                  </div>
                  <span
                    className={`inline-flex rounded-xl px-3.5 py-1.5 text-xs font-bold border ${
                      selectedTrip.score >= 90
                        ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                        : selectedTrip.score >= 70
                        ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                        : 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                    }`}
                  >
                    {selectedTrip.score >= 90 ? t('Excellent') : selectedTrip.score >= 70 ? t('Satisfactory') : t('Needs Review')}
                  </span>
                </div>

                {/* Event breakdowns */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">{t('Safety Events Breakdown')}</h4>
                  {(() => {
                    const nonZeroEvents = Object.entries(selectedTrip.eventCounts || {}).filter(
                      ([_, count]) => (count as number) > 0,
                    );
                    if (nonZeroEvents.length === 0) {
                      return (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-400/5 px-4 py-3 text-xs text-emerald-400 border border-emerald-400/10">
                          <ShieldCheck size={14} />
                          <span>{t('Perfect journey: Zero harsh actions or speed violations recorded!')}</span>
                        </div>
                      );
                    }
                    return (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {nonZeroEvents.map(([event, count]) => (
                          <div
                            key={event}
                            className="flex items-center justify-between rounded-xl border border-line bg-surface-hover px-3 py-2 text-xs"
                          >
                            <span className="flex items-center gap-1.5 text-ink-soft">
                              <AlertTriangle size={12} className="text-rose-400" />
                              {t(formatEnumLabel(event))}
                            </span>
                            <span className="font-bold text-ink">{count}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </DashboardCard>
          </div>
        )}
      </Drawer>
    </div>
  );
}

interface TripRoutePoint {
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  batteryPct: number | null;
  ignition: boolean | null;
}

function TripRouteReplay({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const routeQuery = useQuery({
    queryKey: ['trips', tripId, 'route'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiFetch<any>(`/trips/${tripId}/route`),
    enabled: !!tripId,
  });

  if (routeQuery.isLoading) {
    return (
      <div className="h-72 w-full flex items-center justify-center rounded-2xl border border-line bg-surface-muted text-sm text-ink-soft animate-pulse">
        {t('Loading route replay map...')}
      </div>
    );
  }

  if (routeQuery.isError) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-hover text-sm text-ink-soft">
        {t('Error loading route telemetry: {error}').replace('{error}', String(routeQuery.error))}
      </div>
    );
  }

  const rawData = routeQuery.data;
  const route = Array.isArray(rawData) ? rawData : (rawData?.route ?? []);
  const events = Array.isArray(rawData) ? [] : (rawData?.events ?? []);

  return <TripReplayMap route={route} events={events} />;
}

// Helper to translate browser local datetime string to ISO UTC
function toIsoUtcOrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}
