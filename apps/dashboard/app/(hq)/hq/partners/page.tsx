'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Globe, Shield, Plus, Settings, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const partnersSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
    _count: z.object({
      clients: z.number(),
      webhooks: z.number(),
    }),
  })
);

export default function HqPartnersPage() {
  const router = useRouter();
  const { data: partners, isLoading } = useQuery({
    queryKey: ['hq', 'partners'],
    queryFn: () => apiFetch('/hq/partners', {}, { schema: partnersSchema }),
  });

  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (partnerId: string) =>
      apiFetch(`/hq/partners/${partnerId}/permanent`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'partners'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">External Partners</h1>
          <p className="mt-1 text-zinc-400">Strategic API integrations and global webhook destinations.</p>
        </div>
        
        <button 
          onClick={() => router.push('/hq/partners/new')}
          className="flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-accent-strong active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
        >
          <Plus size={16} strokeWidth={3} />
          Onboard Partner
        </button>
      </div>

      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Partner Organization</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Integration Health</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Endpoints</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Established</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-8">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : partners?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-zinc-500">
                      <Globe size={32} />
                    </div>
                    <p className="mt-6 text-base font-bold text-white">No Strategic Partners</p>
                    <p className="mt-2 text-sm text-zinc-500">There are no external organizations integrated with the platform.</p>
                  </td>
                </tr>
              ) : (
                partners?.map((partner) => (
                  <tr key={partner.id} className="group transition-colors hover:bg-white/[0.01]">
                    <td className="px-8 py-7">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400">
                          <Shield size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{partner.name}</p>
                          <p className="mt-1 text-[10px] text-zinc-500">Global ID: {partner.id.slice(0, 12)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${partner.status === 'ACTIVE' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-rose-400'}`} />
                        <span className={`text-xs font-bold ${partner.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {partner.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-ink-soft">{partner._count.clients}</span>
                          <span className="text-[10px] text-zinc-500">API Keys</span>
                        </div>
                        <div className="flex flex-col border-l border-line pl-4">
                          <span className="text-xs font-bold text-ink-soft">{partner._count.webhooks}</span>
                          <span className="text-[10px] text-zinc-500">Webhooks</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7 text-zinc-500">
                      <span className="text-xs font-medium">{new Date(partner.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td className="px-8 py-7 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => router.push(`/hq/partners/${partner.id}/settings`)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                          title="Partner Settings"
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: partner.id, name: partner.name }); }}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                          title="Delete Partner Permanently"
                        >
                          <Trash2 size={16} />
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
            <h2 className="text-lg font-bold text-white">Delete Partner</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to permanently delete <span className="font-bold text-rose-400">{deleteTarget.name}</span>? This will remove all API credentials, webhooks, and fleet access. This action cannot be undone.
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

