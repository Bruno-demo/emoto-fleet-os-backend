'use client';

import Link from 'next/link';
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
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { TextField } from '@/components/ui/form-controls';
import { apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { FleetTrip, PaginatedResponse } from '@/lib/types/dashboard';
import { formatEnumLabel, formatTimestamp } from '@/lib/ui';

const PAGE_SIZE = 20;

export default function TripsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [minScore, setMinScore] = useState('');

  // Fetch all trips in the fleet scope using selected filters
  const tripsQuery = useQuery({
    queryKey: ['trips', page, from, to, minScore],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetTrip>>(
        `/trips${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          from: toIsoUtcOrUndefined(from),
          to: toIsoUtcOrUndefined(to),
          minScore: minScore ? Number(minScore) : undefined,
        })}`,
      ),
  });

  const trips = useMemo(() => tripsQuery.data?.data ?? [], [tripsQuery.data?.data]);

  // Clientside filtering for searchable fields (bike label, rider name, trip ID)
  const filteredTrips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return trips;

    const tokens = query.split(/\s+/).filter(Boolean);
    return trips.filter((trip) => {
      return tokens.every((token) => {
        return [
          trip.id,
          trip.bikeLabel,
          trip.riderName,
        ]
          .filter((val): val is string => !!val)
          .some((val) => val.toLowerCase().includes(token));
      });
    });
  }, [trips, searchQuery]);

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) ?? null,
    [trips, selectedTripId],
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
        header: 'Trip & Actor',
        render: (trip) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Bike size={13} />
              </span>
              <span className="font-semibold text-ink">{trip.bikeLabel ?? 'Unknown Bike'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-soft">
              <User size={11} className="text-ink-muted" />
              <span>{trip.riderName ?? 'Unassigned Rider'}</span>
            </div>
          </div>
        ),
      },
      {
        header: 'Start Date & Time',
        render: (trip) => (
          <div>
            <p className="font-medium text-ink">{formatTimestamp(trip.startTs)}</p>
            <p className="mt-1 text-[11px] text-ink-muted">ID: {trip.id.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        header: 'Telematics',
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
        header: 'Battery & Power Usage',
        render: (trip) => {
          const powerUsed = trip.powerUsedPct;
          const startPct = trip.startBatteryPct;
          const endPct = trip.endBatteryPct;

          if (startPct === null || endPct === null) {
            return (
              <span className="text-xs text-ink-muted italic">No telemetry</span>
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
                  {powerUsed > 0 ? `-${powerUsed.toFixed(1)}%` : `+${Math.abs(powerUsed).toFixed(1)}%`} used
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: 'Safety Score',
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
        header: 'Action',
        className: 'text-right',
        cellClassName: 'text-right',
        render: (trip) => (
          <button
            type="button"
            className="rounded-xl border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-surface-muted hover:border-accent/30"
            onClick={() => setSelectedTripId(trip.id)}
          >
            View detail
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Metrics Section */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Journeys"
          value={String(metrics.total)}
          hint="Total journeys recorded inside fleet database scope."
          icon={<Route size={18} />}
          tone="info"
        />
        <MetricCard
          title="Active Page Dist."
          value={`${metrics.totalDistanceKm.toFixed(1)} km`}
          hint="Aggregated distance calculated from currently loaded page."
          icon={<Milestone size={18} />}
          tone="success"
        />
        <MetricCard
          title="Avg Safety Score"
          value={`${metrics.avgScore} / 100`}
          hint="Historical driver safety evaluation aggregate."
          icon={<ShieldCheck size={18} />}
          tone={metrics.avgScore >= 80 ? 'success' : metrics.avgScore >= 60 ? 'warning' : 'danger'}
        />
        <MetricCard
          title="Avg Battery Cost"
          value={metrics.avgBatteryDrop !== null ? `-${metrics.avgBatteryDrop}% / trip` : 'N/A'}
          hint="Average battery capacity cost consumed per completed trip."
          icon={<Battery size={18} />}
          tone={metrics.avgBatteryDrop !== null && metrics.avgBatteryDrop > 25 ? 'warning' : 'info'}
        />
      </section>

      {/* Filter and Table Section */}
      <DashboardCard
        eyebrow="Fleet Telemetry"
        title="Trips History"
        description="Inspect telemetry records, battery drops, and driving profiles across your vehicle fleet."
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
              Reset filters
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Search Input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">Search Context</label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Search bike label, rider name, or ID..."
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
              <label className="text-sm font-medium text-ink">Min Safety Score</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 70"
                value={minScore}
                onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
                className="w-full rounded-[var(--radius-control)] border border-line bg-surface-hover py-3 px-4 text-sm text-ink outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {/* Start date from */}
            <TextField
              label="Start Date From"
              type="datetime-local"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            />

            {/* Start date to */}
            <TextField
              label="Start Date To"
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
                title="No journeys found"
                description="No historical journeys recorded match the current filters."
              />
            }
          />
        </div>

        {/* Pagination controls */}
        <PaginationControls
          page={tripsQuery.data?.page ?? page}
          totalPages={tripsQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>

      {/* Slide-out details drawer */}
      <Drawer
        open={!!selectedTripId}
        title={selectedTrip ? `Trip detail: ${selectedTrip.bikeLabel ?? 'Bike'}` : 'Trip detail'}
        description="Comprehensive vehicle metrics, battery power consumption, and safety violations recorded."
        onClose={() => setSelectedTripId(null)}
      >
        {selectedTrip && (
          <div className="space-y-6">
            {/* Quick Summary Section */}
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Linked Asset</span>
                <p className="mt-1 font-display text-base font-bold text-ink">{selectedTrip.bikeLabel ?? 'Unknown'}</p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/bikes?bikeId=${selectedTrip.bikeId}`}
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Bike size={11} />
                    Open asset
                  </Link>
                  <Link
                    href={`/live?bikeId=${selectedTrip.bikeId}`}
                    className="inline-flex items-center gap-1 text-xs text-ink hover:underline"
                  >
                    <Map size={11} />
                    View Live
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Rider / Operator</span>
                <p className="mt-1 font-display text-base font-bold text-ink">{selectedTrip.riderName ?? 'Unassigned'}</p>
                <span className="mt-2 block text-xs text-ink-muted">
                  ID: {selectedTrip.riderId ? selectedTrip.riderId.slice(0, 12) : 'N/A'}
                </span>
              </div>
            </section>

            {/* Battery Power Profiler */}
            <DashboardCard
              eyebrow="Energy Analysis"
              title="Power & Battery Profile"
              description="Battery capacity telemetry recorded during this trip lifecycle."
            >
              {selectedTrip.startBatteryPct !== null && selectedTrip.endBatteryPct !== null ? (
                <div className="space-y-4">
                  {/* Energy Drop Indicator bar */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-ink mb-1.5">
                      <span className="flex items-center gap-1">
                        <Battery size={13} className="text-emerald-400 fill-current" />
                        Start: {selectedTrip.startBatteryPct}%
                      </span>
                      <span className="flex items-center gap-1">
                        <BatteryCharging size={13} className="text-blue-400" />
                        End: {selectedTrip.endBatteryPct}%
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
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Energy Cost</p>
                      <p className="mt-1 text-lg font-bold text-rose-400">
                        {selectedTrip.powerUsedPct !== null
                          ? `${selectedTrip.powerUsedPct.toFixed(1)}% drop`
                          : `${(selectedTrip.startBatteryPct - selectedTrip.endBatteryPct).toFixed(1)}% drop`}
                      </p>
                    </div>

                    <div className="rounded-xl bg-surface-hover px-3 py-2 border border-line">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Average Rate</p>
                      <p className="mt-1 text-lg font-bold text-ink">
                        {selectedTrip.distanceKm > 0 && selectedTrip.powerUsedPct !== null
                          ? `${(selectedTrip.powerUsedPct / selectedTrip.distanceKm).toFixed(2)}% / km`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <BatteryCharging size={24} className="text-ink-muted animate-pulse" />
                  <p className="mt-2 text-xs text-ink-soft">Telemetry missing battery logs for this period.</p>
                </div>
              )}
            </DashboardCard>

            {/* Journey Stats */}
            <DashboardCard
              eyebrow="Telematics Details"
              title="Journey Analytics"
              description="Basic speed, distance, and duration telemetry statistics."
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Distance</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">{selectedTrip.distanceKm.toFixed(2)} km</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Duration</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">{formatDuration(selectedTrip.durationSec)}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-center">
                  <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Avg Speed</span>
                  <p className="mt-1 font-display text-lg font-bold text-ink">
                    {selectedTrip.durationSec > 0
                      ? `${((selectedTrip.distanceKm / (selectedTrip.durationSec / 3600))).toFixed(1)} km/h`
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </DashboardCard>

            {/* Safety Score / Incidents */}
            <DashboardCard
              eyebrow="Safety Monitor"
              title="Driving Profile"
              description="Safety score and driving anomalies logged by stream processors."
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-surface-hover p-4 border border-line">
                  <div className="space-y-1">
                    <span className="text-xs text-ink-soft">Driver Safety Index</span>
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
                    {selectedTrip.score >= 90 ? 'Excellent' : selectedTrip.score >= 70 ? 'Satisfactory' : 'Needs Review'}
                  </span>
                </div>

                {/* Event breakdowns */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">Safety Events Breakdown</h4>
                  {(() => {
                    const nonZeroEvents = Object.entries(selectedTrip.eventCounts || {}).filter(
                      ([_, count]) => (count as number) > 0,
                    );
                    if (nonZeroEvents.length === 0) {
                      return (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-400/5 px-4 py-3 text-xs text-emerald-400 border border-emerald-400/10">
                          <ShieldCheck size={14} />
                          <span>Perfect journey: Zero harsh actions or speed violations recorded!</span>
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
                              {formatEnumLabel(event)}
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

// Helper to translate browser local datetime string to ISO UTC
function toIsoUtcOrUndefined(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}
