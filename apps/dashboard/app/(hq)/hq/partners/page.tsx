'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Globe, Shield, Plus, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">External Partners</h1>
          <p className="mt-1 text-zinc-400">Strategic API integrations and global webhook destinations.</p>
        </div>
        
        <button className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          <Plus size={16} strokeWidth={3} />
          Onboard Partner
        </button>
      </div>

      <div className="rounded-[32px] border border-white/5 bg-[#121214] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400">
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
                          <span className="text-xs font-bold text-zinc-300">{partner._count.clients}</span>
                          <span className="text-[10px] text-zinc-500">API Keys</span>
                        </div>
                        <div className="flex flex-col border-l border-white/5 pl-4">
                          <span className="text-xs font-bold text-zinc-300">{partner._count.webhooks}</span>
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
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all"
                          title="Partner Settings"
                        >
                          <Settings size={16} />
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
    </div>
  );
}
