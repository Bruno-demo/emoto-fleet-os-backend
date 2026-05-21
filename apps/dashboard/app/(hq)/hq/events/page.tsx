'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Zap, Search, Filter } from 'lucide-react';
import { useState } from 'react';

const EVENT_TYPES = [
  'OVERSPEED',
  'SPEED_LIMIT_VIOLATION',
  'SCHOOL_ZONE_SPEED',
  'HOSPITAL_ZONE_SPEED',
  'MARKET_ZONE_SPEED',
  'HARSH_BRAKE',
  'HARSH_ACCEL',
  'HARSH_CORNER',
  'CRASH',
  'THEFT_SUSPECTED',
  'SOS',
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const eventsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      fleetId: z.string(),
      bikeId: z.string().nullable(),
      deviceId: z.string(),
      ts: z.string(),
      type: z.string(),
      severity: z.string(),
      createdAt: z.string(),
      fleet: z.object({ id: z.string(), name: z.string() }),
      bike: z.object({ id: z.string(), label: z.string() }).nullable(),
      device: z.object({ id: z.string(), deviceUid: z.string() }),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const fleetsListSchema = z.array(
  z.object({ id: z.string(), name: z.string() })
);

function eventIcon(type: string) {
  if (type === 'CRASH') return '💥';
  if (type === 'THEFT_SUSPECTED') return '🔒';
  if (type === 'SOS') return '🆘';
  if (type === 'OVERSPEED') return '⚡';
  if (type === 'SPEED_LIMIT_VIOLATION') return '🚦';
  if (type.includes('ZONE_SPEED')) return '🏫';
  if (type === 'HARSH_BRAKE') return '🛑';
  if (type === 'HARSH_ACCEL') return '🚀';
  if (type === 'HARSH_CORNER') return '↩️';
  return '⚠️';
}

function severityStyle(severity: string) {
  if (severity === 'CRITICAL') return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
  if (severity === 'HIGH') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (severity === 'MEDIUM') return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
}

function severityDot(severity: string) {
  if (severity === 'CRITICAL') return 'bg-rose-400';
  if (severity === 'HIGH') return 'bg-amber-400';
  if (severity === 'MEDIUM') return 'bg-sky-400';
  return 'bg-emerald-400';
}

function typeLabel(type: string) {
  return type.replaceAll('_', ' ');
}

export default function HqEventsPage() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterFleetId, setFilterFleetId] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (filterType) queryParams.set('type', filterType);
  if (filterSeverity) queryParams.set('severity', filterSeverity);
  if (filterFleetId) queryParams.set('fleetId', filterFleetId);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'telemetry-events', page, filterType, filterSeverity, filterFleetId],
    queryFn: () =>
      apiFetch(`/hq/telemetry-events?${queryParams.toString()}`, {}, { schema: eventsResponseSchema }),
  });

  const { data: fleetsList } = useQuery({
    queryKey: ['hq', 'fleets-list'],
    queryFn: () =>
      apiFetch('/hq/fleets?pageSize=200', {}).then(
        (res: any) => (res.data ?? res) as Array<{ id: string; name: string }>
      ),
  });

  // Compute severity distribution from current page data
  const severityCounts = (data?.data ?? []).reduce(
    (acc, ev) => {
      acc[ev.severity] = (acc[ev.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            System Events
          </h1>
          <p className="mt-1 text-zinc-400">
            Cross-fleet telemetry events — speed violations, crashes, harsh
            dynamics, and alerts from all operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Severity mini badges */}
          {SEVERITIES.map(
            (s) =>
              (severityCounts[s] ?? 0) > 0 && (
                <div
                  key={s}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${severityStyle(s)}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${severityDot(s)}`}
                  />
                  {severityCounts[s]} {s}
                </div>
              )
          )}
          <span className="text-sm font-bold text-zinc-500">
            {data ? `${data.total.toLocaleString()} total` : '…'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          id="hq-events-filter-fleet"
          value={filterFleetId}
          onChange={(e) => {
            setFilterFleetId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All fleets</option>
          {(fleetsList ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <select
          id="hq-events-filter-type"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventIcon(t)} {typeLabel(t)}
            </option>
          ))}
        </select>

        <select
          id="hq-events-filter-severity"
          value={filterSeverity}
          onChange={(e) => {
            setFilterSeverity(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {(filterType || filterSeverity || filterFleetId) && (
          <button
            onClick={() => {
              setFilterType('');
              setFilterSeverity('');
              setFilterFleetId('');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-line bg-surface-strong px-4 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 w-12"></th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Event Type
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Severity
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Fleet
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Bike
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Device
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-5">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent/10 text-accent">
                      <Zap size={32} className="fill-current" />
                    </div>
                    <p className="mt-6 text-base font-bold text-white">
                      No Events Detected
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      No telemetry events match the selected filters.
                    </p>
                  </td>
                </tr>
              ) : (
                data?.data.map((event) => (
                  <tr
                    key={event.id}
                    className="group transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-5 text-center">
                      <span className="text-lg">{eventIcon(event.type)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-zinc-200">
                        {typeLabel(event.type)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${severityStyle(event.severity)}`}
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${severityDot(event.severity)}`}
                        />
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-medium text-ink-soft">
                        {event.fleet.name}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400">
                        {event.bike?.label ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-mono text-[11px] text-zinc-500">
                        {event.device.deviceUid}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-500">
                        {new Date(event.ts).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            Showing {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of{' '}
            {data.total.toLocaleString()} events
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
