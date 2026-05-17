'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { ClipboardList, Filter, Calendar } from 'lucide-react';
import { useState } from 'react';

const auditResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      actionType: z.string(),
      targetType: z.string(),
      targetId: z.string().nullable(),
      metaJson: z.any(),
      createdAt: z.string(),
      fleet: z.object({ id: z.string(), name: z.string() }),
      actorUser: z.object({ id: z.string(), email: z.string().nullable(), phone: z.string().nullable() }).nullable(),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const ACTION_TYPES = [
  'DEVICE_SECRET_ROTATED', 'ZONE_CREATED', 'ZONE_UPDATED', 'ZONE_DELETED',
  'LOCK_ACTION_REQUESTED', 'DEVICE_COMMAND_REQUESTED', 'DEVICE_COMMAND_STATUS_CHANGED',
  'PARTNER_TOKEN_ISSUED', 'PARTNER_API_ACCESS', 'PARTNER_WEBHOOK_REGISTERED',
  'PARTNER_WEBHOOK_DELIVERY', 'RIDER_CREATED', 'BIKE_ASSIGNMENT_CHANGED',
  'SOS_TRIGGERED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCOUNT_LOCKED',
];

function actionIcon(type: string) {
  if (type.includes('LOGIN')) return '🔐';
  if (type.includes('DEVICE')) return '📡';
  if (type.includes('ZONE')) return '🗺️';
  if (type.includes('PARTNER')) return '🤝';
  if (type.includes('RIDER')) return '🏍️';
  if (type.includes('SOS')) return '🆘';
  if (type.includes('BIKE')) return '🔗';
  if (type.includes('LOCK')) return '🔒';
  return '📋';
}

function actionColor(type: string) {
  if (type.includes('FAILED') || type.includes('LOCKED')) return 'text-rose-400';
  if (type.includes('SOS') || type.includes('DELETE')) return 'text-amber-400';
  if (type.includes('CREATED') || type.includes('SUCCESS')) return 'text-emerald-400';
  return 'text-sky-400';
}

export default function HqAuditPage() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '30');
  if (filterAction) queryParams.set('actionType', filterAction);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'audit', page, filterAction],
    queryFn: () => apiFetch(`/hq/audit?${queryParams.toString()}`, {}, { schema: auditResponseSchema }),
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Audit Log</h1>
          <p className="mt-1 text-zinc-400">Cross-fleet trail of every admin action on the platform.</p>
        </div>
        <div className="text-sm font-bold text-zinc-500">
          {data ? `${data.total.toLocaleString()} entries` : '…'}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All actions</option>
          {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
        </select>
      </div>

      {/* Timeline */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 w-12"></th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Timestamp</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Actor</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Action</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Target</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-5">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <ClipboardList size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No audit entries found</p>
                  </td>
                </tr>
              ) : (
                data?.data.map((entry) => (
                  <tr key={entry.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-4 text-center">
                      <span className="text-base">{actionIcon(entry.actionType)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Calendar size={12} />
                        <span className="text-xs font-mono">
                          {new Date(entry.createdAt).toLocaleString([], {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-ink-soft">
                        {entry.actorUser?.email ?? entry.actorUser?.phone ?? 'System'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${actionColor(entry.actionType)}`}>
                        {entry.actionType.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-zinc-400">
                        <span className="font-medium text-ink-soft">{entry.targetType}</span>
                        {entry.targetId && (
                          <span className="ml-1.5 font-mono text-zinc-600">{entry.targetId.slice(0, 8)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-zinc-400">{entry.fleet.name}</span>
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
            className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">Page {data.page} of {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

