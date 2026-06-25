'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { ShieldCheck, Search, Plus, ChevronDown, ChevronRight, Bike, X, Trash2 } from 'lucide-react';
import { useState, Fragment } from 'react';

const insurersResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      status: z.string(),
      createdAt: z.string(),
      fleet: z.object({ id: z.string(), name: z.string() }),
      riderProfile: z.object({ fullName: z.string() }).nullable(),
      assignedBikes: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          plate: z.string().nullable(),
          status: z.string(),
        })
      ).optional(),
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



export default function HqInsurersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    phone: '',
    password: '',
    fullName: '',
    fleetId: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (insurerId: string) =>
      apiFetch(`/hq/insurers/${insurerId}/permanent`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'insurers'] });
      setDeleteTarget(null);
    },
  });



  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (search) queryParams.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'insurers', page, search],
    queryFn: () => apiFetch(`/hq/insurers?${queryParams.toString()}`, {}, { schema: insurersResponseSchema }),
  });

  const { data: fleetsList } = useQuery({
    queryKey: ['hq', 'fleets-list'],
    queryFn: () => apiFetch('/hq/fleets?pageSize=200', {}).then((res) => {
      const r = res as { data?: Array<{ id: string; name: string }> };
      return (r.data ?? r) as Array<{ id: string; name: string }>;
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      apiFetch('/hq/insurers', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'insurers'] });
      setShowCreate(false);
      setCreateForm({ email: '', phone: '', password: '', fullName: '', fleetId: '' });
      setCreateError(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setCreateError(error?.message ?? 'Failed to create insurer');
    },
  });

  const statusColor = (s: string) => {
    if (s === 'ACTIVE') return 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20';
    if (s === 'SUSPENDED') return 'bg-amber-400/15 text-amber-400 border-amber-400/20';
    if (s === 'DISABLED') return 'bg-rose-400/15 text-rose-400 border-rose-400/20';
    return 'bg-white/5 text-zinc-400 border-line';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Insurers</h1>
          <p className="mt-1 text-zinc-400">Manage insurance partners and their covered bikes.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zinc-500">
            {data ? `${data.total.toLocaleString()} total` : '…'}
          </span>
          <button
            onClick={() => { setShowCreate(true); setCreateError(null); }}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white transition-all hover:brightness-110"
          >
            <Plus size={14} />
            Create Insurer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative group flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-xl border border-line bg-surface-strong pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 w-8"></th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Name / Email</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Phone</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Covered Bikes</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-6">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr key="empty">
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <ShieldCheck size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No insurers found</p>
                    <p className="mt-1 text-xs text-zinc-600">Create your first insurer to get started.</p>
                  </td>
                </tr>
              ) : (
                data?.data.map((insurer) => {
                  const isExpanded = expandedId === insurer.id;
                  const bikes = insurer.assignedBikes ?? [];
                  return (
                    <Fragment key={insurer.id}>
                      <tr
                        className="group transition-colors hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : insurer.id)}
                      >
                        <td className="px-6 py-5 text-zinc-500">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-6 py-5">
                          <div>
                            <p className="text-sm font-bold text-white">{insurer.riderProfile?.fullName ?? insurer.email ?? 'Unknown'}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">{insurer.email ?? '—'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs text-zinc-400">{insurer.phone ?? '—'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-medium text-ink-soft">{insurer.fleet.name}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-bold text-white">{bikes.length}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusColor(insurer.status)}`}>
                            {insurer.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                id: insurer.id,
                                name: insurer.riderProfile?.fullName ?? insurer.email ?? 'Unknown',
                              });
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                            title="Delete Insurer Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${insurer.id}-detail`}>
                          <td colSpan={7} className="bg-white/[0.01] px-6 py-4">
                            <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
                              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">
                                Covered Bikes ({bikes.length})
                              </p>
                              {bikes.length === 0 ? (
                                <p className="text-xs text-zinc-600">No bikes under coverage for this insurer yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {bikes.map((bike) => (
                                    <div
                                      key={bike.id}
                                      className="flex items-center rounded-xl border border-line bg-white/[0.02] px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Bike size={14} className="text-cyan-400" />
                                        <div>
                                          <p className="text-sm font-medium text-white">{bike.label}</p>
                                          <p className="text-[11px] text-zinc-500">{bike.plate ?? 'No plate'} · {bike.status}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
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
          <span className="text-xs text-zinc-500">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="rounded-xl border border-line bg-surface-strong px-4 py-2 text-xs font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/5 transition-all"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Insurer Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-line bg-[#09090b] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-white">Create Insurer</h2>
            <p className="mt-1 text-sm text-zinc-400">Add a new insurance partner to a fleet.</p>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(createForm);
              }}
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Full Name</label>
                <input
                  type="text"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="insurer@company.com"
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Phone</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+250 7XX XXX XXX"
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Password</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Fleet</label>
                <select
                  value={createForm.fleetId}
                  onChange={(e) => setCreateForm({ ...createForm, fleetId: e.target.value })}
                  className="w-full rounded-xl border border-line bg-surface-strong px-4 py-3 text-sm text-white outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— Select a fleet —</option>
                  {(fleetsList ?? []).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {createError && (
                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !createForm.email || !createForm.fleetId}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Insurer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-2xl border border-rose-500/20 bg-[#09090b] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Delete Insurer</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to permanently delete <span className="font-bold text-rose-400">{deleteTarget.name}</span>? All bike assignments will be unlinked. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-line bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
