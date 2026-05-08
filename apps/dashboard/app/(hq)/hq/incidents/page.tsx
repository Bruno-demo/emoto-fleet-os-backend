'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const incidentsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      notes: z.string().nullable(),
      fleet: z.object({ id: z.string(), name: z.string() }),
      bike: z.object({ id: z.string(), label: z.string() }).nullable(),
      event: z.object({ type: z.string(), severity: z.string() }),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_ALARM'];

function severityStyle(severity: string) {
  if (severity === 'CRITICAL') return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
  if (severity === 'HIGH') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (severity === 'MEDIUM') return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
  return 'bg-white/5 text-zinc-400 border-white/5';
}

function statusStyle(status: string) {
  if (status === 'OPEN') return 'bg-rose-500/15 text-rose-400';
  if (status === 'ACKNOWLEDGED') return 'bg-amber-500/15 text-amber-400';
  if (status === 'RESOLVED') return 'bg-emerald-500/15 text-emerald-400';
  return 'bg-zinc-500/15 text-zinc-400';
}

function eventIcon(type: string) {
  if (type === 'CRASH') return '💥';
  if (type === 'THEFT_SUSPECTED') return '🔒';
  if (type === 'SOS') return '🆘';
  if (type === 'OVERSPEED') return '⚡';
  if (type.includes('HARSH')) return '🛑';
  return '⚠️';
}

export default function HqIncidentsPage() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (filterStatus) queryParams.set('status', filterStatus);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'incidents', page, filterStatus],
    queryFn: () => apiFetch(`/hq/incidents?${queryParams.toString()}`, {}, { schema: incidentsResponseSchema }),
  });

  const openCount = data?.data.filter(i => i.status === 'OPEN').length ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Global Incidents</h1>
          <p className="mt-1 text-zinc-400">Cross-fleet crash, SOS, and theft incidents from all operations.</p>
        </div>
        <div className="flex items-center gap-3">
          {data && data.total > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-white/5 bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-400">
              <AlertTriangle size={14} />
              {openCount} Open
            </div>
          )}
          <span className="text-sm font-bold text-zinc-500">
            {data ? `${data.total.toLocaleString()} total` : '…'}
          </span>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setFilterStatus(''); setPage(1); }}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${!filterStatus ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
        >
          All
        </button>
        {INCIDENT_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${filterStatus === s ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[32px] border border-white/5 bg-[#121214] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 w-12"></th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">ID</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Event</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Severity</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Bike</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-5">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400">
                      <ShieldCheck size={32} />
                    </div>
                    <p className="mt-6 text-base font-bold text-white">All Clear</p>
                    <p className="mt-2 text-sm text-zinc-500">No incidents match the selected filter.</p>
                  </td>
                </tr>
              ) : (
                data?.data.map((incident) => (
                  <tr key={incident.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-5 text-center">
                      <span className="text-lg">{eventIcon(incident.event.type)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-mono text-[11px] text-zinc-500">{incident.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-bold text-zinc-200">
                        {incident.event.type.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${severityStyle(incident.event.severity)}`}>
                        {incident.event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-medium text-zinc-300">{incident.fleet.name}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-400">{incident.bike?.label ?? '—'}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle(incident.status)}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-500">
                        {new Date(incident.createdAt).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
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
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-white/5 bg-[#121214] px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">Page {data.page} of {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-xl border border-white/5 bg-[#121214] px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
