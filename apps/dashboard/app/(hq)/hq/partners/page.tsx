'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Globe } from 'lucide-react';

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
  const { data: partners, isLoading } = useQuery({
    queryKey: ['hq', 'partners'],
    queryFn: () => apiFetch('/hq/partners', {}, { schema: partnersSchema }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">API Partners</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage external integrations and webhook destinations.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#18181b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium">Partner Name</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">API Clients</th>
                <th className="px-6 py-4 font-medium">Webhooks</th>
                <th className="px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Loading partners...
                  </td>
                </tr>
              ) : partners?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No API partners registered.
                  </td>
                </tr>
              ) : (
                partners?.map((partner) => (
                  <tr key={partner.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                      <Globe size={16} className="text-zinc-500" />
                      {partner.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${partner.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {partner.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">{partner._count.clients}</td>
                    <td className="px-6 py-4 text-zinc-300">{partner._count.webhooks}</td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(partner.createdAt).toLocaleDateString()}
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
