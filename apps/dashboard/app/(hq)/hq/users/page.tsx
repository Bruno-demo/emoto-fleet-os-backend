'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Users, Search, Shield, UserX, Trash2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const usersResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      role: z.string(),
      status: z.string(),
      createdAt: z.string(),
      fleet: z.object({ id: z.string(), name: z.string() }),
      riderProfile: z.object({ fullName: z.string() }).nullable(),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

const ROLES = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECH', 'INSURER', 'RIDER'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING_SETUP', 'INVITED'];

export default function HqUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '25');
  if (search) queryParams.set('search', search);
  if (filterStatus) queryParams.set('status', filterStatus);
  if (filterRole) queryParams.set('role', filterRole);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'users', page, search, filterStatus, filterRole],
    queryFn: () => apiFetch(`/hq/users?${queryParams.toString()}`, {}, { schema: usersResponseSchema }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/hq/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'users'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      apiFetch(`/hq/users/${userId}/status`, { method: 'PUT', body: JSON.stringify({ status }), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/hq/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'users'] }),
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Global Users</h1>
          <p className="mt-1 text-zinc-400">Manage every operator, rider, and admin across all fleets.</p>
        </div>
        <div className="text-sm font-bold text-zinc-500">
          {data ? `${data.total.toLocaleString()} total users` : '…'}
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
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-line bg-surface-strong px-3 text-sm text-ink-soft focus:border-accent focus:outline-none"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">User</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Role</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Status</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Joined</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <Users size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No users found</p>
                  </td>
                </tr>
              ) : (
                data?.data.map((user) => (
                  <tr key={user.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-6 py-5">
                      <div>
                        <p className="text-sm font-bold text-white">{user.riderProfile?.fullName ?? user.email ?? user.phone ?? 'Unknown'}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{user.email ?? user.phone ?? '—'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-medium text-ink-soft">{user.fleet.name}</span>
                    </td>
                    <td className="px-6 py-5">
                      <select
                        value={user.role}
                        onChange={(e) => roleMutation.mutate({ userId: user.id, role: e.target.value })}
                        className="rounded-lg border border-line bg-white/5 px-2 py-1 text-[11px] font-bold text-ink-soft focus:border-accent focus:outline-none cursor-pointer"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${statusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-zinc-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'ACTIVE' ? (
                          <button
                            onClick={() => statusMutation.mutate({ userId: user.id, status: 'SUSPENDED' })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-amber-400 hover:bg-amber-400/10 transition-all"
                            title="Suspend user"
                          >
                            <Shield size={14} />
                          </button>
                        ) : user.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => statusMutation.mutate({ userId: user.id, status: 'ACTIVE' })}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-emerald-400 hover:bg-emerald-400/10 transition-all"
                            title="Reactivate user"
                          >
                            <UserX size={14} />
                          </button>
                        ) : null}
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete this user? This cannot be undone.`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/5 text-rose-400 hover:bg-rose-400/10 transition-all"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
    </div>
  );
}

