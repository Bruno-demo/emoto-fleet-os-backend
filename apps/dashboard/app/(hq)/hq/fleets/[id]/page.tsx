'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { useParams, useRouter } from 'next/navigation';
import { Building2, ArrowLeft, Bike, User, Shield, Zap, Calendar, MapPin, Activity, TrendingUp, Users, Trash2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

const fleetDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  plan: z.string(),
  subscriptionStatus: z.string(),
  createdAt: z.string(),
  users: z.array(z.object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    role: z.string(),
    status: z.string(),
  })),
  bikes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    plate: z.string().nullable(),
    status: z.string(),
  })),
  _count: z.object({
    users: z.number(),
    bikes: z.number(),
    events: z.number(),
    trips: z.number(),
    devices: z.number().optional(),
    incidents: z.number().optional(),
  }),
});

export default function FleetDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: fleet, isLoading } = useQuery({
    queryKey: ['hq', 'fleet', id],
    queryFn: () => apiFetch(`/hq/fleets/${id}`, {}, { schema: fleetDetailSchema }),
    enabled: !!id,
  });

  const queryClient = useQueryClient();

  const planMutation = useMutation({
    mutationFn: (plan: string) =>
      apiFetch(`/hq/fleets/${id}/plan`, { method: 'PUT', body: JSON.stringify({ plan }), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] }),
  });

  const subMutation = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/hq/fleets/${id}/subscription`, { method: 'PUT', body: JSON.stringify({ status }), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] }),
  });

  const bikeStatusMutation = useMutation({
    mutationFn: ({ bikeId, status }: { bikeId: string; status: string }) =>
      apiFetch(`/hq/bikes/${bikeId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hq', 'fleet', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/hq/fleets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq'] });
      router.push('/hq/fleets');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-4 w-96 rounded-lg bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!fleet) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">Fleet Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  const activeUsersCount = fleet.users.filter(u => u.status === 'ACTIVE').length;
  const activeBikesCount = fleet.bikes.filter(b => b.status === 'ACTIVE').length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">{fleet.name}</h1>
          <p className="mt-1 text-zinc-400">Detailed analytics and configuration for {fleet.type} fleet</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active Users</p>
              <p className="mt-2 text-3xl font-bold text-white">{activeUsersCount}</p>
              <p className="mt-1 text-xs text-zinc-600">of {fleet._count.users} total</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active Bikes</p>
              <p className="mt-2 text-3xl font-bold text-white">{activeBikesCount}</p>
              <p className="mt-1 text-xs text-zinc-600">of {fleet._count.bikes} total</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Bike size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Plan</p>
              <p className="mt-2 text-2xl font-bold text-white">{fleet.plan}</p>
              <p className="mt-1 text-xs text-zinc-600">Subscription {fleet.subscriptionStatus}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface-strong p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Recorded Events</p>
              <p className="mt-2 text-3xl font-bold text-white">{fleet._count.events.toLocaleString()}</p>
              <p className="mt-1 text-xs text-zinc-600">{fleet._count.trips} trips</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Activity size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Management Actions */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-6">
          <Shield size={18} className="text-zinc-400" />
          Fleet Management
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Plan Change */}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Service Plan</p>
            <div className="flex gap-2">
              <button
                onClick={() => planMutation.mutate('DEMO')}
                disabled={planMutation.isPending || fleet.plan === 'DEMO'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.plan === 'DEMO' ? 'bg-accent text-white' : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                DEMO
              </button>
              <button
                onClick={() => planMutation.mutate('PREMIUM')}
                disabled={planMutation.isPending || fleet.plan === 'PREMIUM'}
                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                  fleet.plan === 'PREMIUM' ? 'bg-accent text-white' : 'border border-line bg-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                PREMIUM
              </button>
            </div>
          </div>

          {/* Subscription Status */}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Subscription</p>
            <select
              value={fleet.subscriptionStatus}
              onChange={(e) => subMutation.mutate(e.target.value)}
              disabled={subMutation.isPending}
              className="w-full rounded-xl border border-line bg-surface-strong px-3 py-2.5 text-xs font-bold text-ink-soft focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAST_DUE">PAST_DUE</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-3">Danger Zone</p>
            <button
              onClick={() => {
                if (confirm(`Disable fleet "${fleet.name}"? All users will be set to DISABLED and bikes to RETIRED. This is a soft-delete.`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/25 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleteMutation.isPending ? 'Disabling…' : 'Disable Fleet'}
            </button>
          </div>
        </div>
      </div>

      {/* Users Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Users size={18} className="text-zinc-400" />
            Fleet Operators ({fleet.users.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Name</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Role</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Contact</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleet.users.map(user => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{user.email || user.phone || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {user.email && <div>{user.email}</div>}
                    {user.phone && <div>{user.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.status === 'ACTIVE' 
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bikes Section */}
      <div className="rounded-3xl border border-line bg-surface-strong p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Bike size={18} className="text-zinc-400" />
            Fleet Nodes ({fleet.bikes.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Label</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Plate</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleet.bikes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No bikes assigned to this fleet
                  </td>
                </tr>
              ) : (
                fleet.bikes.map(bike => (
                  <tr key={bike.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{bike.label}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{bike.plate || '-'}</td>
                    <td className="px-4 py-3 text-xs">
                      <select
                        value={bike.status}
                        onChange={(e) => bikeStatusMutation.mutate({ bikeId: bike.id, status: e.target.value })}
                        disabled={bikeStatusMutation.isPending}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold focus:outline-none cursor-pointer transition-all disabled:opacity-50 ${
                          bike.status === 'ACTIVE'
                            ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
                            : bike.status === 'MAINTENANCE'
                            ? 'border-amber-500/30 text-amber-300 bg-amber-500/5'
                            : 'border-zinc-500/30 text-zinc-400 bg-zinc-500/5'
                        }`}
                      >
                        <option value="ACTIVE" className="bg-zinc-950 text-white">ACTIVE</option>
                        <option value="MAINTENANCE" className="bg-zinc-950 text-white">MAINTENANCE</option>
                        <option value="RETIRED" className="bg-zinc-950 text-white">RETIRED</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-line px-4 py-3">
        <Calendar size={14} className="text-zinc-500" />
        <span className="text-xs text-zinc-400">
          Fleet created on {new Date(fleet.createdAt).toLocaleDateString()} at {new Date(fleet.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
