'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Check, X, AlertCircle, Phone, Mail, Clock, ShieldCheck, MapPin } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';

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

export default function PendingSetupsPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['hq', 'pending-users'],
    queryFn: () => apiFetch('/hq/users/pending', {}, { schema: pendingUserSchema }),
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/hq/users/${userId}/activate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'stats'] });
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Hardware Activation</h1>
          <p className="mt-1 text-zinc-400">Verify installations and provision command access for new fleets.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400">
            <Clock size={14} />
            {users?.length ?? 0} Pending Setups
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/5 bg-[#121214] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet identity</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Contact endpoints</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Service Tier</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Queue time</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-8">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : users?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400">
                      <ShieldCheck size={32} />
                    </div>
                    <p className="mt-6 text-base font-bold text-white">All Hardware Verified</p>
                    <p className="mt-2 text-sm text-zinc-500">Every fleet is currently active and commissioned.</p>
                  </td>
                </tr>
              ) : (
                users?.map((user) => (
                  <tr key={user.id} className="group transition-colors hover:bg-white/[0.01]">
                    <td className="px-8 py-7">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{user.fleet.name}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">Pending hardware sync</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="space-y-1.5">
                        {user.email && (
                          <div className="flex items-center gap-2 text-zinc-300">
                            <Mail size={12} className="text-zinc-600" />
                            <span className="text-xs font-medium">{user.email}</span>
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center gap-2 text-zinc-300">
                            <Phone size={12} className="text-zinc-600" />
                            <span className="text-xs font-medium">{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        {user.fleet.plan}
                      </span>
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Clock size={14} />
                        <span className="text-xs font-medium">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-7 text-right">
                      <button
                        onClick={() => activateMutation.mutate(user.id)}
                        disabled={activateMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
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
    </div>
  );
}
