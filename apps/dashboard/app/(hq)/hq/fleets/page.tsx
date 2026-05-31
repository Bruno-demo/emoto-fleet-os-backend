'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Building2, Search, Funnel, MoreHorizontal, User, Bike, Calendar, X } from 'lucide-react';
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
  const [showFilterControls, setShowFilterControls] = useState(false);
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const router = useRouter();
  
  const { data: fleets, isLoading } = useQuery({
    queryKey: ['hq', 'fleets'],
    queryFn: () => apiFetch('/hq/fleets', {}, { schema: fleetsSchema }),
  });

  const filteredFleets = fleets?.filter((f) => {
    // 1. Plan Filter
    if (planFilter && f.plan !== planFilter) return false;

    // 2. Status Filter
    if (statusFilter && f.subscriptionStatus !== statusFilter) return false;

    // 3. Search Query Filter
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const tokens = query.split(/\s+/).filter(Boolean);
    const planText = f.plan === 'PREMIUM' ? 'operations plus' : f.plan === 'DEMO' ? 'safety core' : f.plan;

    return tokens.every((token) => {
      return [
        f.name,
        f.plan,
        planText,
        f.subscriptionStatus,
        f.id,
      ]
        .filter(Boolean)
        .some((val) => val.toLowerCase().includes(token));
    });
  });

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
              placeholder="Search by name, plan, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-strong pl-10 pr-10 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:w-64 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilterControls((prev) => !prev)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
              showFilterControls || planFilter || statusFilter
                ? 'border-accent bg-accent/15 text-accent shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'border-line bg-surface-strong text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
            title="Filter Fleets"
          >
            <Funnel size={16} />
          </button>
        </div>
      </div>

      {showFilterControls && (
        <div className="flex flex-wrap gap-4 items-center bg-white/[0.02] border border-line rounded-[20px] p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Service Plan</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="">All Service Plans</option>
              <option value="PREMIUM">Operations Plus (Premium)</option>
              <option value="DEMO">Safety Core (Core)</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Network Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface-strong px-3 text-sm text-white focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {(planFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setPlanFilter('');
                setStatusFilter('');
              }}
              className="mt-5 h-10 px-4 rounded-xl border border-line bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer hover:scale-[1.02]"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 group-hover:text-white transition-colors">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{fleet.name}</p>
                          <p className="mt-1 text-[10px] text-zinc-500 font-mono tracking-tight">{fleet.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs font-bold text-ink-soft">
                        <div className="h-1 w-1 rounded-full bg-accent" />
                        {fleet.plan === 'PREMIUM' ? 'Operations Plus' : fleet.plan === 'DEMO' ? 'Safety Core' : fleet.plan}
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
                          <span className="text-xs font-bold text-ink-soft">{fleet._count.users}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Bike size={14} className="text-zinc-600" />
                          <span className="text-xs font-bold text-ink-soft">{fleet._count.bikes}</span>
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
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white transition-all"
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

