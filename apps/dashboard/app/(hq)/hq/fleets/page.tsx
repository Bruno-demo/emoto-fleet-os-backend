'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { Building2, Search, Funnel, MoreHorizontal, User, Bike, Calendar, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const fleetsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    plan: z.string(),
    subscriptionStatus: z.string(),
    createdAt: z.string(),
    trialEndsAt: z.string().nullable().optional(),
    bikeRange: z.string().nullable().optional(),
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
    // Exclude insurance-plan fleets from the fleet registry
    // (insurer accounts are managed separately in /hq/insurers)
    if (f.plan === 'INSURANCE') return false;

    // 1. Plan Filter
    if (planFilter && f.plan !== planFilter) return false;

    // 2. Status Filter
    if (statusFilter && f.subscriptionStatus !== statusFilter) return false;

    // 3. Search Query Filter
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const tokens = query.split(/\s+/).filter(Boolean);
    const planText = f.plan === 'PREMIUM' ? 'delivery fleet' : f.plan === 'DEMO' ? 'cooperative individual' : f.plan;

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
              <option value="PREMIUM">Delivery Fleet (15,000 RWF)</option>
              <option value="DEMO">Cooperative & Individual (10,000 RWF)</option>
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

      {/* Fleets Table */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full rounded-2xl bg-surface-strong border border-line animate-pulse" />
          ))}
        </div>
      ) : !filteredFleets || filteredFleets.length === 0 ? (
        <div className="rounded-[24px] border border-line bg-surface-strong p-12 text-center">
          <Building2 className="mx-auto text-zinc-600 mb-4" size={48} />
          <h3 className="font-display text-lg font-bold text-white mb-1">No Fleets Found</h3>
          <p className="text-sm text-zinc-400">No organizations match your current search or filter criteria.</p>
        </div>
      ) : (
        <div className="rounded-[24px] border border-line bg-surface-strong overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-white/[0.01] text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  <th className="px-8 py-5">Fleet Organization</th>
                  <th className="px-8 py-5">Fleet Type</th>
                  <th className="px-8 py-5">Service Plan</th>
                  <th className="px-8 py-5">Subscription</th>
                  <th className="px-8 py-5">Metrics (Users / Bikes)</th>
                  <th className="px-8 py-5">Created Date</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-zinc-300">
                {filteredFleets.map((fleet) => (
                  <tr 
                    key={fleet.id} 
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5 text-accent font-bold">
                          {fleet.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white leading-tight">{fleet.name}</p>
                            {fleet.bikeRange && (
                              <span className="inline-flex items-center rounded-md bg-accent/10 border border-accent/25 px-1.5 py-0.5 text-[9px] font-bold text-accent leading-none uppercase tracking-wide">
                                Size: {fleet.bikeRange}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] text-zinc-500 font-mono tracking-tight">{fleet.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs font-bold text-ink-soft">
                        <div className={`h-1 w-1 rounded-full ${fleet.type === 'DELIVERY' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                        {fleet.type}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/5 px-2.5 py-1 text-xs font-bold text-ink-soft">
                        <div className="h-1 w-1 rounded-full bg-accent" />
                        {fleet.plan === 'PREMIUM' ? 'Delivery Fleet' : fleet.plan === 'DEMO' ? 'Cooperative & Individual' : fleet.plan}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${fleet.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`} />
                        <span className={`text-xs font-bold ${fleet.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fleet.subscriptionStatus}
                        </span>
                        {fleet.trialEndsAt && new Date(fleet.trialEndsAt) > new Date() && (
                          <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1 shadow-sm">
                            <Sparkles size={10} className="text-cyan-400" />
                            TRIAL
                          </span>
                        )}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

