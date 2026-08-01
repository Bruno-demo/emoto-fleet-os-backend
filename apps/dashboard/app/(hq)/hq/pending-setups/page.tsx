'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Check, X, AlertCircle, Phone, Mail, Clock, ShieldCheck, MapPin, Bike, Cpu, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

type Tab = 'operators' | 'bikes';

const pendingUserSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    createdAt: z.string(),
    fleet: z.object({
      name: z.string(),
      plan: z.string(),
    }),
  })
);

const pendingBikeSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string().nullable(),
    plate: z.string().nullable(),
    serial: z.string().nullable(),
    model: z.string().nullable(),
    status: z.string(),
    createdAt: z.string(),
    fleet: z.object({
      name: z.string(),
      plan: z.string(),
    }),
  })
);

export default function PendingSetupsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('operators');
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['hq', 'pending-users'],
    queryFn: () => apiFetch('/hq/users/pending', {}, { schema: pendingUserSchema }),
  });

  const { data: bikes, isLoading: bikesLoading } = useQuery({
    queryKey: ['hq', 'pending-bikes'],
    queryFn: () => apiFetch('/hq/bikes/pending', {}, { schema: pendingBikeSchema }),
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/hq/users/${userId}/activate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'pending-count'] });
    },
  });

  const totalPending = (users?.length ?? 0) + (bikes?.length ?? 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Hardware Activation</h1>
          <p className="mt-1 text-zinc-400">Verify installations and provision command access for new fleets.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400">
            <Clock size={14} />
            {totalPending} Pending Setups
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('operators')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'operators'
              ? 'bg-white/10 text-white shadow-sm border border-white/10'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/5'
          }`}
        >
          <UserPlus size={14} />
          Pending Operators
          {(users?.length ?? 0) > 0 && (
            <span className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
              activeTab === 'operators' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500'
            }`}>
              {users?.length ?? 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bikes')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'bikes'
              ? 'bg-white/10 text-white shadow-sm border border-white/10'
              : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-white/5'
          }`}
        >
          <Bike size={14} />
          Unassigned Bikes
          {(bikes?.length ?? 0) > 0 && (
            <span className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
              activeTab === 'bikes' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500'
            }`}>
              {bikes?.length ?? 0}
            </span>
          )}
        </button>
      </div>

      {/* Operators Tab */}
      {activeTab === 'operators' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Fleet Identity</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Contact Endpoints</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Service Tier</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Queue Time</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-6">
                        <div className="h-5 w-full rounded-lg bg-white/5" />
                      </td>
                    </tr>
                  ))
                ) : users?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                        <ShieldCheck size={32} />
                      </div>
                      <p className="mt-5 text-base font-bold text-white">All Operators Verified</p>
                      <p className="mt-1 text-sm text-slate-400">Every fleet operator is currently active and commissioned.</p>
                    </td>
                  </tr>
                ) : (
                  users?.map((user) => (
                    <tr key={user.id} className="group transition-colors hover:bg-blue-500/[0.04]">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-inner">
                            <MapPin size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white leading-tight group-hover:text-blue-300 transition-colors">{user.fleet.name}</p>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">
                              {user.fleet.plan === 'INSURANCE' ? 'Pending payment' : 'Pending hardware sync'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          {user.email && (
                            <div className="flex items-center gap-2 text-slate-300">
                              <Mail size={13} className="text-slate-400" />
                              <span className="text-xs font-semibold">{user.email}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Phone size={13} className="text-slate-500" />
                              <span className="text-xs font-medium">{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-300 uppercase tracking-wider shadow-sm">
                          {user.fleet.plan === 'PREMIUM' ? 'Operations Plus' : user.fleet.plan === 'DEMO' ? 'Safety Core' : user.fleet.plan === 'INSURANCE' ? 'Insurance' : user.fleet.plan}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock size={14} className="text-slate-500" />
                          <span className="text-xs font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => activateMutation.mutate(user.id)}
                          disabled={activateMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-4 py-2 text-xs font-bold text-slate-950 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-md shadow-emerald-500/20 cursor-pointer"
                        >
                          <Check size={14} strokeWidth={3} />
                          Activate Account
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bikes Tab */}
      {activeTab === 'bikes' && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Bike Info</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Fleet & Plan</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Plate / Serial</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Created</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bikesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-6">
                        <div className="h-5 w-full rounded-lg bg-white/5" />
                      </td>
                    </tr>
                  ))
                ) : bikes?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                        <Cpu size={32} />
                      </div>
                      <p className="mt-5 text-base font-bold text-white">All Bikes Assigned</p>
                      <p className="mt-1 text-sm text-slate-400">Every bike has a tracking device installed.</p>
                    </td>
                  </tr>
                ) : (
                  bikes?.map((bike) => (
                    <tr key={bike.id} className="group transition-colors hover:bg-blue-500/[0.04]">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-inner">
                            <Bike size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white leading-tight group-hover:text-amber-300 transition-colors">{bike.label || 'Unnamed'}</p>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">{bike.model || 'No model'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-200">{bike.fleet.name}</span>
                        </div>
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                          {bike.fleet.plan === 'PREMIUM' ? 'Operations Plus' : bike.fleet.plan === 'DEMO' ? 'Safety Core' : bike.fleet.plan}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          {bike.plate ? (
                            <span className="inline-block font-mono font-bold text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md tracking-wider">
                              {bike.plate}
                            </span>
                          ) : null}
                          {bike.serial ? (
                            <p className="text-[11px] text-slate-400 font-mono">{bike.serial}</p>
                          ) : null}
                          {!bike.plate && !bike.serial && (
                            <p className="text-[11px] text-slate-500 italic">Not specified</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                          bike.status === 'ACTIVE'
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10'
                            : bike.status === 'MAINTENANCE'
                            ? 'border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-sm shadow-amber-500/10'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            bike.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : bike.status === 'MAINTENANCE' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
                          }`} />
                          {bike.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock size={14} className="text-slate-500" />
                          <span className="text-xs font-medium">{new Date(bike.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => router.push('/hq/devices')}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 cursor-pointer"
                        >
                          <Cpu size={14} />
                          Assign Device
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
