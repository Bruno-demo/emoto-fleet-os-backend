'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Building2, Search, Filter, MoreHorizontal, User, Bike, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [search, setSearch] = useState('');
  const router = useRouter();
  
  const { data: fleets, isLoading } = useQuery({
    queryKey: ['hq', 'fleets'],
    queryFn: () => apiFetch('/hq/fleets', {}, { schema: fleetsSchema }),
  });

  const filteredFleets = fleets?.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.plan.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Fleet Registry</h1>
          <p className="mt-1 text-zinc-400">Manage and monitor every organization on the E-Moto network.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search fleets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/5 bg-[#121214] pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:w-64 transition-all"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-[#121214] text-zinc-400 hover:bg-white/5 hover:text-white transition-all">
            <Filter size={16} />
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/5 bg-[#121214] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet identity</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Service Plan</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Network Status</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Utilization</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Commissioned</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : filteredFleets?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <Search size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-zinc-400">No fleets matching your search</p>
                  </td>
                </tr>
              ) : (
                filteredFleets?.map((fleet) => (
                  <tr key={fleet.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-zinc-400 group-hover:text-white transition-colors">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{fleet.name}</p>
                          <p className="mt-1 text-[10px] text-zinc-500 font-mono tracking-tight">{fleet.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-300">
                        <div className="h-1 w-1 rounded-full bg-accent" />
                        {fleet.plan}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${fleet.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`} />
                        <span className={`text-xs font-bold ${fleet.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fleet.subscriptionStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <User size={14} className="text-zinc-600" />
                          <span className="text-xs font-bold text-zinc-300">{fleet._count.users}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Bike size={14} className="text-zinc-600" />
                          <span className="text-xs font-bold text-zinc-300">{fleet._count.bikes}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Calendar size={14} />
                        <span className="text-xs font-medium">{new Date(fleet.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => router.push(`/hq/fleets/${fleet.id}`)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-white/5 bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white transition-all"
                        title="Manage Fleet"
                      >
                        <MoreHorizontal size={16} />
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
