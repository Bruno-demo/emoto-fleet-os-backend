'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Banknote, 
  Check, 
  X, 
  Search, 
  Building2, 
  Clock, 
  Sparkles, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState, useMemo } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { cx, formatEnumLabel } from '@/lib/ui';

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
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING_UPGRADE' | 'UNPAID_SETUP' | 'PAID_SETUP' | 'PREMIUM' | 'CORE' | 'SUB_ACTIVE' | 'SUB_UNPAID'>('ALL');
  const [selectedFleet, setSelectedFleet] = useState<BillingFleet | null>(null);

  const { data: fleets, isLoading } = useQuery({
    queryKey: ['hq', 'billing-fleets'],
    queryFn: () => apiFetch('/hq/billing', {}, { schema: billingFleetSchema }),
  });

  const activeFleetDetails = useMemo(() => 
    fleets?.find(f => f.id === selectedFleet?.id) ?? selectedFleet,
    [fleets, selectedFleet]
  );

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

  const updateSubscriptionStatusMutation = useMutation({
    mutationFn: ({ fleetId, status }: { fleetId: string; status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' }) => 
      apiFetch(`/hq/fleets/${fleetId}/subscription`, { 
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  // KPI calculations
  const totalCount = fleets?.length ?? 0;
  const outstandingSetupCount = fleets?.filter(f => !f.installationPaid).length ?? 0;
  const pendingUpgradeCount = fleets?.filter(f => f.upgradeRequested).length ?? 0;
  const premiumCount = fleets?.filter(f => f.plan === 'PREMIUM').length ?? 0;
  const activeSubCount = fleets?.filter(f => f.subscriptionStatus === 'ACTIVE').length ?? 0;
  const unpaidSubCount = fleets?.filter(f => f.subscriptionStatus !== 'ACTIVE').length ?? 0;

  // Filter fleets
  const filteredFleets = useMemo(() => {
    return fleets?.filter((fleet) => {
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
        case 'SUB_ACTIVE':
          return fleet.subscriptionStatus === 'ACTIVE';
        case 'SUB_UNPAID':
          return fleet.subscriptionStatus !== 'ACTIVE';
        case 'ALL':
        default:
          return true;
      }
    });
  }, [fleets, search, filterType]);

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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-450 border border-white/[0.08]">
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

      <DashboardCard
        eyebrow="Billing"
        title="Fleet Billing Ledger"
        description="Monitor installation setups, billing tiers, and monthly subscription statuses."
      >
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 pb-4 mb-4 border-b border-line">
          <button
            onClick={() => setFilterType('ALL')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'ALL' 
                ? 'bg-white/10 text-white border-white/15' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            All Profiles ({totalCount})
          </button>
          <button
            onClick={() => setFilterType('PENDING_UPGRADE')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 border",
              filterType === 'PENDING_UPGRADE' 
                ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] border-blue-500/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Upgrade Requests ({pendingUpgradeCount})
            {pendingUpgradeCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
          </button>
          <button
            onClick={() => setFilterType('UNPAID_SETUP')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'UNPAID_SETUP' 
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Setup Unpaid ({outstandingSetupCount})
          </button>
          <button
            onClick={() => setFilterType('PAID_SETUP')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'PAID_SETUP' 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Setup Paid ({totalCount - outstandingSetupCount})
          </button>
          <button
            onClick={() => setFilterType('SUB_ACTIVE')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'SUB_ACTIVE' 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Subscription Active ({activeSubCount})
          </button>
          <button
            onClick={() => setFilterType('SUB_UNPAID')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'SUB_UNPAID' 
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Subscription Unpaid ({unpaidSubCount})
          </button>
        </div>

        {/* Registry Table */}
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface-muted/30">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line bg-white/[0.01]">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Fleet identity</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Service Tier</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Setup Fee (30k RWF)</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Monthly Sub</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Utilization</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 w-full rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              ) : filteredFleets?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
                      <AlertCircle size={24} />
                    </div>
                    <p className="mt-4 text-sm font-bold text-white">No Profiles Found</p>
                    <p className="mt-1 text-xs text-zinc-500">No fleets match your query or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredFleets?.map((fleet) => (
                  <tr key={fleet.id} className="group transition-colors hover:bg-white/[0.01]">
                    {/* Fleet Identity */}
                    <td 
                      className="px-6 py-5 cursor-pointer"
                      onClick={() => setSelectedFleet(fleet)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5 text-zinc-400 group-hover:text-white group-hover:border-white/20 transition-all">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight group-hover:text-accent transition-colors">{fleet.name}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500 font-mono tracking-tight">{fleet.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Service Tier */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className={cx(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          fleet.plan === 'PREMIUM' 
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                            : 'border-line bg-white/5 text-zinc-450'
                        )}>
                          {fleet.plan === 'PREMIUM' ? 'Operations Plus' : 'Safety Core'}
                        </span>
                        
                        {fleet.upgradeRequested && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 animate-pulse">
                            <Clock size={10} />
                            Upgrade Requested
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Setup Fee Status */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2.5">
                        <span className={cx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                          fleet.installationPaid 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        )}>
                          <div className={cx("h-1 w-1 rounded-full", fleet.installationPaid ? 'bg-emerald-400' : 'bg-amber-400')} />
                          {fleet.installationPaid ? 'Paid' : 'Unpaid'}
                        </span>
                        <p className="text-xs font-semibold text-zinc-500">
                          ({(fleet._count.bikes * 30000).toLocaleString()} RWF)
                        </p>
                      </div>
                    </td>

                    {/* Monthly Sub */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2.5">
                        <span className={cx(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                          fleet.subscriptionStatus === 'ACTIVE' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : fleet.subscriptionStatus === 'PAST_DUE'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        )}>
                          <div className={cx("h-1 w-1 rounded-full", 
                            fleet.subscriptionStatus === 'ACTIVE' 
                              ? 'bg-emerald-400' 
                              : fleet.subscriptionStatus === 'PAST_DUE'
                              ? 'bg-rose-400'
                              : 'bg-zinc-400'
                          )} />
                          {fleet.subscriptionStatus === 'ACTIVE' 
                            ? 'Paid' 
                            : fleet.subscriptionStatus === 'PAST_DUE'
                            ? 'Past Due'
                            : 'Canceled'}
                        </span>
                        <p className="text-xs font-semibold text-zinc-500">
                          ({(fleet._count.bikes * (fleet.plan === 'PREMIUM' ? 10000 : 5000)).toLocaleString()} RWF/mo)
                        </p>
                      </div>
                    </td>

                    {/* Utilization */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3 text-xs font-medium text-zinc-550">
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-600">Users:</span>
                          <span className="font-bold text-zinc-300">{fleet._count.users}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-600">Bikes:</span>
                          <span className="font-bold text-zinc-300">{fleet._count.bikes}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5 text-right space-x-1">
                      <button
                        onClick={() => toggleInstallationPaidMutation.mutate(fleet.id)}
                        disabled={toggleInstallationPaidMutation.isPending}
                        className={cx(
                          "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all border cursor-pointer hover:bg-surface-hover active:scale-95 disabled:opacity-50 disabled:scale-100",
                          fleet.installationPaid 
                            ? 'bg-white/5 text-zinc-400 border-line hover:text-white' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        )}
                        title={fleet.installationPaid ? 'Mark Setup Fee Unpaid' : 'Mark Setup Fee Paid'}
                      >
                        <Banknote size={13} />
                        {fleet.installationPaid ? 'Unpay Setup' : 'Pay Setup'}
                      </button>

                      <button
                        onClick={() => updateSubscriptionStatusMutation.mutate({
                          fleetId: fleet.id,
                          status: fleet.subscriptionStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE'
                        })}
                        disabled={updateSubscriptionStatusMutation.isPending}
                        className={cx(
                          "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all border cursor-pointer hover:bg-surface-hover active:scale-95 disabled:opacity-50 disabled:scale-100",
                          fleet.subscriptionStatus === 'ACTIVE'
                            ? 'bg-white/5 text-zinc-400 border-line hover:text-white'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        )}
                        title={fleet.subscriptionStatus === 'ACTIVE' ? 'Mark Overdue' : 'Mark Paid'}
                      >
                        <Clock size={13} />
                        {fleet.subscriptionStatus === 'ACTIVE' ? 'Unpay Sub' : 'Pay Sub'}
                      </button>

                      {fleet.upgradeRequested && (
                        <button
                          onClick={() => approveUpgradeMutation.mutate(fleet.id)}
                          disabled={approveUpgradeMutation.isPending}
                          className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                          style={{ background: '#3B82F6' }}
                        >
                          <Check size={13} />
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {/* Fleet Detail Drawer */}
      <Drawer
        open={!!selectedFleet}
        title={activeFleetDetails?.name ?? 'Fleet Billing Profile'}
        description={activeFleetDetails ? `Organization ID: ${activeFleetDetails.id}` : ''}
        onClose={() => setSelectedFleet(null)}
      >
        {activeFleetDetails && (
          <div className="space-y-6">
            {/* Plan Tier Highlight */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Service Plan</span>
                <span className={cx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border",
                  activeFleetDetails.plan === 'PREMIUM' 
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                    : 'border-line bg-white/5 text-zinc-455'
                )}>
                  {activeFleetDetails.plan === 'PREMIUM' ? 'Operations Plus' : 'Safety Core'}
                </span>
              </div>
              
              <div className="grid gap-3 grid-cols-2">
                <div className="rounded-xl border border-line bg-background p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Users Count</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{activeFleetDetails._count.users}</p>
                </div>
                <div className="rounded-xl border border-line bg-background p-3 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-550">Bikes Count</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{activeFleetDetails._count.bikes}</p>
                </div>
              </div>
            </div>

            {/* Setup Fee Details */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">One-time Setup Fee (30k RWF/bike)</p>
                <span className={cx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                  activeFleetDetails.installationPaid 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                )}>
                  {activeFleetDetails.installationPaid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-3xl font-extrabold text-white">
                  {(activeFleetDetails._count.bikes * 30000).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400 font-semibold">RWF</span>
              </div>
            </div>

            {/* Monthly Subscription Cost */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Monthly Subscription</p>
                <span className={cx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                  activeFleetDetails.subscriptionStatus === 'ACTIVE' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : activeFleetDetails.subscriptionStatus === 'PAST_DUE'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-550'
                )}>
                  {activeFleetDetails.subscriptionStatus === 'ACTIVE' 
                    ? 'Paid' 
                    : activeFleetDetails.subscriptionStatus === 'PAST_DUE'
                    ? 'Past Due'
                    : 'Canceled'}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-1">
                <span className="text-3xl font-extrabold text-white">
                  {(activeFleetDetails._count.bikes * (activeFleetDetails.plan === 'PREMIUM' ? 10000 : 5000)).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400 font-semibold font-mono">RWF / month</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed pt-1 border-t border-white/5">
                Formula: {activeFleetDetails._count.bikes} bikes × {activeFleetDetails.plan === 'PREMIUM' ? '10,000' : '5,000'} RWF/mo
              </p>
            </div>

            {/* Upgrade Requested Notification */}
            {activeFleetDetails.upgradeRequested && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex gap-3 items-start animate-pulse">
                <Clock className="text-blue-400 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-400">Premium Upgrade Pending</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    This fleet requested an upgrade to <strong className="text-white font-semibold">Operations Plus</strong> (10k RWF/bike).
                  </p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-3 pt-4 border-t border-line">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Billing Actions</p>
              
              <div className="flex flex-col gap-2">
                {activeFleetDetails.upgradeRequested && (
                  <button
                    onClick={() => approveUpgradeMutation.mutate(activeFleetDetails.id)}
                    disabled={approveUpgradeMutation.isPending}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                    style={{ background: '#3B82F6' }}
                  >
                    <Check size={14} strokeWidth={2.5} />
                    Approve Premium Upgrade
                  </button>
                )}

                <button
                  onClick={() => toggleInstallationPaidMutation.mutate(activeFleetDetails.id)}
                  disabled={toggleInstallationPaidMutation.isPending}
                  className={cx(
                    "w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-all border cursor-pointer hover:bg-surface-hover active:scale-95 disabled:opacity-50 disabled:scale-100",
                    activeFleetDetails.installationPaid 
                      ? 'bg-white/5 text-zinc-450 border-line hover:text-white' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  )}
                >
                  <Banknote size={14} />
                  {activeFleetDetails.installationPaid ? 'Mark Setup Fee Unpaid' : 'Mark Setup Fee Paid'}
                </button>

                <button
                  onClick={() => updateSubscriptionStatusMutation.mutate({
                    fleetId: activeFleetDetails.id,
                    status: activeFleetDetails.subscriptionStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE'
                  })}
                  disabled={updateSubscriptionStatusMutation.isPending}
                  className={cx(
                    "w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-all border cursor-pointer hover:bg-surface-hover active:scale-95 disabled:opacity-50 disabled:scale-100",
                    activeFleetDetails.subscriptionStatus === 'ACTIVE' 
                      ? 'bg-white/5 text-zinc-450 border-line hover:text-white' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  )}
                >
                  <Clock size={14} />
                  {activeFleetDetails.subscriptionStatus === 'ACTIVE' ? 'Mark Subscription Overdue' : 'Mark Subscription Paid'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
