'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Building2 } from 'lucide-react';

const fleetsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    plan: z.string(),
    subscriptionStatus: z.string(),
    createdAt: z.string(),
    _count: z.object({
      users: z.number(),
      bikes: z.number(),
    }),
  })
);

export default function HqFleetsPage() {
  const { data: fleets, isLoading } = useQuery({
    queryKey: ['hq', 'fleets'],
    queryFn: () => apiFetch('/hq/fleets', {}, { schema: fleetsSchema }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Registered Fleets</h1>
        <p className="mt-1 text-sm text-zinc-400">Master list of all fleets on the platform.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#18181b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium">Fleet Name</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Users</th>
                <th className="px-6 py-4 font-medium">Bikes</th>
                <th className="px-6 py-4 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    Loading fleets...
                  </td>
                </tr>
              ) : fleets?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No fleets found.
                  </td>
                </tr>
              ) : (
                fleets?.map((fleet) => (
                  <tr key={fleet.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                      <Building2 size={16} className="text-zinc-500" />
                      {fleet.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                        {fleet.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${fleet.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {fleet.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">{fleet._count.users}</td>
                    <td className="px-6 py-4 text-zinc-300">{fleet._count.bikes}</td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(fleet.createdAt).toLocaleDateString()}
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
