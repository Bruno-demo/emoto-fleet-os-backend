'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Banknote, 
  Check, 
  X, 
  Search, 
  Building2, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState } from 'react';

const billingFleetSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    plan: z.string(),
    subscriptionStatus: z.string(),
    installationPaid: z.boolean(),
    upgradeRequested: z.boolean(),
    upgradeRequestedAt: z.string().nullable(),
    createdAt: z.string(),
    _count: z.object({
      users: z.number(),
      bikes: z.number(),
    }),
  })
);

type BillingFleet = z.infer<typeof billingFleetSchema>[number];

export default function HqBillingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING_UPGRADE' | 'UNPAID_SETUP' | 'PAID_SETUP' | 'PREMIUM' | 'CORE'>('ALL');
  const [selectedFleet, setSelectedFleet] = useState<BillingFleet | null>(null);

  const { data: fleets, isLoading } = useQuery({
    queryKey: ['hq', 'billing-fleets'],
    queryFn: () => apiFetch('/hq/billing', {}, { schema: billingFleetSchema }),
  });

  const activeFleetDetails = fleets?.find(f => f.id === selectedFleet?.id) ?? selectedFleet;

  const toggleInstallationPaidMutation = useMutation({
    mutationFn: (fleetId: string) => 
      apiFetch(`/hq/fleets/${fleetId}/toggle-installation-payment`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  const approveUpgradeMutation = useMutation({
    mutationFn: (fleetId: string) => 
      apiFetch(`/hq/fleets/${fleetId}/approve-upgrade`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'stats'] });
    },
  });

  // KPI calculations
  const totalCount = fleets?.length ?? 0;
  const outstandingSetupCount = fleets?.filter(f => !f.installationPaid).length ?? 0;
  const pendingUpgradeCount = fleets?.filter(f => f.upgradeRequested).length ?? 0;
  const premiumCount = fleets?.filter(f => f.plan === 'PREMIUM').length ?? 0;

  // Filter fleets
  const filteredFleets = fleets?.filter((fleet) => {
    // Search match
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const matchName = fleet.name.toLowerCase().includes(query);
      const matchId = fleet.id.toLowerCase().includes(query);
      if (!matchName && !matchId) return false;
    }

    // Category filter
    switch (filterType) {
      case 'PENDING_UPGRADE':
        return fleet.upgradeRequested;
      case 'UNPAID_SETUP':
        return !fleet.installationPaid;
      case 'PAID_SETUP':
        return fleet.installationPaid;
      case 'PREMIUM':
        return fleet.plan === 'PREMIUM';
      case 'CORE':
        return fleet.plan === 'DEMO';
      case 'ALL':
      default:
        return true;
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Billing Control Room</h1>
          <p className="mt-1 text-zinc-400">Track and manage client installation setup fees, plan upgrades, and approvals.</p>
        </div>

        <div className="relative group sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-accent transition-colors" size={16} />
          <input 
            type="text"
            placeholder="Search by fleet name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-surface-strong pl-10 pr-10 text-sm text-white placeholder:text-zinc-650 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Registered */}
        <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/[0.07] transition-all" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-400 border border-white/[0.08]">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Fleets</p>
              <p className="text-2xl font-extrabold text-white mt-1">{totalCount}</p>
            </div>
          </div>
        </div>

        {/* Outstanding Setup Fees */}
        <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/[0.08] transition-all" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Banknote size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Unpaid Setup Fees</p>
              <p className="text-2xl font-extrabold text-white mt-1">{outstandingSetupCount}</p>
            </div>
          </div>
        </div>

        {/* Pending Upgrade Approvals */}
        <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/[0.08] transition-all" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Upgrade Requests</p>
              <p className="text-2xl font-extrabold text-white mt-1">{pendingUpgradeCount}</p>
            </div>
          </div>
        </div>

        {/* Operations Plus Fleets */}
        <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/[0.08] transition-all" />
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Premium Fleets</p>
              <p className="text-2xl font-extrabold text-white mt-1">{premiumCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-2">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === 'ALL' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          All Profiles ({totalCount})
        </button>
        <button
          onClick={() => setFilterType('PENDING_UPGRADE')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${filterType === 'PENDING_UPGRADE' ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] border border-blue-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Upgrade Requests ({pendingUpgradeCount})
          {pendingUpgradeCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
        </button>
        <button
          onClick={() => setFilterType('UNPAID_SETUP')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === 'UNPAID_SETUP' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Setup Unpaid ({outstandingSetupCount})
        </button>
        <button
          onClick={() => setFilterType('PAID_SETUP')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === 'PAID_SETUP' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Setup Paid ({totalCount - outstandingSetupCount})
        </button>
        <button
          onClick={() => setFilterType('PREMIUM')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === 'PREMIUM' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Operations Plus ({premiumCount})
        </button>
        <button
          onClick={() => setFilterType('CORE')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${filterType === 'CORE' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
        >
          Safety Core ({totalCount - premiumCount})
        </button>
      </div>

      {/* Registry Table */}
      <div className="rounded-[32px] border border-line bg-surface-strong overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet identity</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Service Tier</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Setup Fee (50k RWF)</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Utilization</th>
                <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
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
              ) : filteredFleets?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 text-zinc-500">
                      <AlertCircle size={32} />
                    </div>
                    <p className="mt-6 text-base font-bold text-white">No Profiles Found</p>
                    <p className="mt-2 text-sm text-zinc-500">No fleets match your query or selected filters.</p>
                  </td>
                </tr>
              ) : (
                filteredFleets?.map((fleet) => (
                  <tr key={fleet.id} className="group transition-colors hover:bg-white/[0.01]">
                    {/* Fleet Identity */}
                    <td 
                      className="px-8 py-6 cursor-pointer"
                      onClick={() => setSelectedFleet(fleet)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-all">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight group-hover:text-accent transition-colors">{fleet.name}</p>
                          <p className="mt-1 text-[10px] text-zinc-500 font-mono tracking-tight">{fleet.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Service Tier & Upgrades */}
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2 items-start">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                          fleet.plan === 'PREMIUM' 
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                            : 'border-line bg-white/5 text-ink-soft'
                        }`}>
                          {fleet.plan === 'PREMIUM' ? 'Operations Plus' : 'Safety Core'}
                        </span>
                        
                        {fleet.upgradeRequested && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 animate-pulse">
                            <Clock size={12} />
                            Upgrade Requested
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Setup Fee Status */}
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          fleet.installationPaid 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <div className={`h-1 w-1 rounded-full ${fleet.installationPaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {fleet.installationPaid ? 'Paid' : 'Unpaid'}
                        </span>
                        
                        <p className="text-xs font-semibold text-zinc-500">
                          ({(fleet._count.bikes * 50000).toLocaleString()} RWF total)
                        </p>
                      </div>
                    </td>

                    {/* Utilization */}
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4 text-xs font-medium text-zinc-450">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600">Users:</span>
                          <span className="font-bold text-white">{fleet._count.users}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-600">Bikes:</span>
                          <span className="font-bold text-white">{fleet._count.bikes}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-8 py-6 text-right space-x-2">
                      {/* Toggle Setup Payment */}
                      <button
                        onClick={() => toggleInstallationPaidMutation.mutate(fleet.id)}
                        disabled={toggleInstallationPaidMutation.isPending}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer ${
                          fleet.installationPaid 
                            ? 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-line' 
                            : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <Banknote size={14} />
                        {fleet.installationPaid ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>

                      {/* Approve Plan Upgrade */}
                      {fleet.upgradeRequested && (
                        <button
                          onClick={() => approveUpgradeMutation.mutate(fleet.id)}
                          disabled={approveUpgradeMutation.isPending}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                          style={{ background: '#3B82F6', color: 'white' }}
                        >
                          <Check size={14} strokeWidth={2.5} />
                          Approve Premium
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Detail Modal */}
      {selectedFleet && activeFleetDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-surface p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-white">
            {/* Top accent glow */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none ${
              activeFleetDetails.plan === 'PREMIUM' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
            }`} />

            {/* Close Button */}
            <button
              onClick={() => setSelectedFleet(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="space-y-2">
              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                activeFleetDetails.plan === 'PREMIUM' 
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                  : 'border-line bg-white/5 text-zinc-400'
              }`}>
                {activeFleetDetails.plan === 'PREMIUM' ? 'Operations Plus' : 'Safety Core'}
              </span>
              <h3 className="text-2xl font-extrabold text-white">{activeFleetDetails.name}</h3>
              <p className="text-xs font-mono text-zinc-500 tracking-tight">{activeFleetDetails.id}</p>
            </div>

            <div className="h-px w-full bg-white/5" />

            {/* Billing Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Stat 1: Bikes Count */}
              <div className="rounded-2xl border border-line bg-white/[0.02] p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Fleet Active Bikes</p>
                <p className="text-2xl font-extrabold text-white">{activeFleetDetails._count.bikes}</p>
                <p className="text-[10px] text-zinc-500">Subject to per-bike plan dues</p>
              </div>

              {/* Stat 2: Monthly Rate */}
              <div className="rounded-2xl border border-line bg-white/[0.02] p-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Monthly Plan Rate</p>
                <p className="text-2xl font-extrabold text-white">
                  {activeFleetDetails.plan === 'PREMIUM' ? '25,000 RWF' : '10,000 RWF'}
                </p>
                <p className="text-[10px] text-zinc-500">per bike per month</p>
              </div>

              {/* Stat 3: Total Sub Cost */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5 space-y-1 sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Subscription Cost</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-emerald-400">
                    {(activeFleetDetails._count.bikes * (activeFleetDetails.plan === 'PREMIUM' ? 25000 : 10000)).toLocaleString()} RWF
                  </span>
                  <span className="text-xs text-zinc-400">/ month</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Formula: {activeFleetDetails._count.bikes} bikes &times; {activeFleetDetails.plan === 'PREMIUM' ? '25,000' : '10,000'} RWF / month
                </p>
              </div>

              {/* Stat 4: Setup Fee Total */}
              <div className="rounded-2xl border border-line bg-white/[0.02] p-4 space-y-1 sm:col-span-2 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">One-time Setup Fee (50k RWF/bike)</p>
                  <p className="text-lg font-extrabold text-white">
                    {(activeFleetDetails._count.bikes * 50000).toLocaleString()} RWF
                  </p>
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    activeFleetDetails.installationPaid 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {activeFleetDetails.installationPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Upgrade pending alerts */}
            {activeFleetDetails.upgradeRequested && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 items-start animate-pulse">
                <Clock className="text-blue-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-400">Premium Upgrade Pending Approval</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    This fleet has requested to upgrade to <strong className="text-white font-semibold">Operations Plus</strong> tier (25k RWF/bike). Awaiting admin confirmation of billing terms.
                  </p>
                </div>
              </div>
            )}

            <div className="h-px w-full bg-white/5" />

            {/* Quick Actions inside Modal */}
            <div className="space-y-3 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Admin Controls</p>
              
              <div className="flex gap-3">
                {/* Approve Upgrade Action */}
                {activeFleetDetails.upgradeRequested && (
                  <button
                    onClick={() => approveUpgradeMutation.mutate(activeFleetDetails.id)}
                    disabled={approveUpgradeMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                    style={{ background: '#3B82F6', color: 'white' }}
                  >
                    <Check size={14} strokeWidth={2.5} />
                    Approve Premium
                  </button>
                )}

                {/* Setup Fee payment status toggle */}
                <button
                  onClick={() => toggleInstallationPaidMutation.mutate(activeFleetDetails.id)}
                  disabled={toggleInstallationPaidMutation.isPending}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer ${
                    activeFleetDetails.installationPaid 
                      ? 'bg-white/5 text-zinc-450 hover:bg-white/10 hover:text-white border border-line' 
                      : 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  <Banknote size={14} />
                  {activeFleetDetails.installationPaid ? 'Mark Setup Unpaid' : 'Mark Setup Paid'}
                </button>
              </div>

              <button
                onClick={() => setSelectedFleet(null)}
                className="w-full text-center rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 py-3 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
