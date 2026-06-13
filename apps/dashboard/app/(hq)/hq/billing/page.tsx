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
    insurerName: z.string().nullable().optional(),
    monthlyRatePerBike: z.number().nullable().optional(),
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
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING_UPGRADE' | 'UNPAID_SETUP' | 'PAID_SETUP' | 'PREMIUM' | 'CORE' | 'INSURANCE' | 'SUB_ACTIVE' | 'SUB_UNPAID'>('ALL');
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

  const updateBillingRateMutation = useMutation({
    mutationFn: ({ fleetId, monthlyRatePerBike }: { fleetId: string; monthlyRatePerBike: number }) => 
      apiFetch(`/hq/fleets/${fleetId}/billing-rate`, { 
        method: 'PUT',
        body: JSON.stringify({ monthlyRatePerBike }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  // KPI calculations
  const totalCount = fleets?.length ?? 0;
  const outstandingSetupCount = fleets?.filter(f => f.plan !== 'INSURANCE' && !f.installationPaid).length ?? 0;
  const setupPaidCount = fleets?.filter(f => f.plan !== 'INSURANCE' && f.installationPaid).length ?? 0;
  const pendingUpgradeCount = fleets?.filter(f => f.upgradeRequested).length ?? 0;
  const premiumCount = fleets?.filter(f => f.plan === 'PREMIUM').length ?? 0;
  const insuranceCount = fleets?.filter(f => f.plan === 'INSURANCE').length ?? 0;
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
          return fleet.plan !== 'INSURANCE' && !fleet.installationPaid;
        case 'PAID_SETUP':
          return fleet.plan !== 'INSURANCE' && fleet.installationPaid;
        case 'PREMIUM':
          return fleet.plan === 'PREMIUM';
        case 'CORE':
          return fleet.plan === 'DEMO';
        case 'INSURANCE':
          return fleet.plan === 'INSURANCE';
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
            Setup Paid ({setupPaidCount})
          </button>
          <button
            onClick={() => setFilterType('INSURANCE')}
            className={cx(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
              filterType === 'INSURANCE' 
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            Insurers ({insuranceCount})
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

        {/* Fleet Billing Cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface-muted/30 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-white/5" />
                    <div className="h-3 w-16 rounded bg-white/5" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-12 w-full rounded-xl bg-white/5" />
                  <div className="h-8 w-full rounded-xl bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredFleets?.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-muted/30 py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-500">
              <AlertCircle size={24} />
            </div>
            <p className="mt-4 text-sm font-bold text-white">No Profiles Found</p>
            <p className="mt-1 text-xs text-zinc-500">No fleets match your query or filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredFleets?.map((fleet) => {
              const setupAmount = fleet._count.bikes * 30000;
              const rate = fleet.monthlyRatePerBike ?? (fleet.plan === 'PREMIUM' ? 10000 : fleet.plan === 'INSURANCE' ? 0 : 5000);
              const monthlyAmount = fleet._count.bikes * rate;
              const hasUpgrade = fleet.upgradeRequested;

              return (
                <div
                  key={fleet.id}
                  className={cx(
                    "group relative rounded-2xl border p-5 transition-all duration-200 hover:translate-y-[-1px]",
                    hasUpgrade
                      ? "border-blue-500/25 bg-blue-500/[0.03] shadow-[0_0_25px_rgba(59,130,246,0.06)]"
                      : "border-line bg-surface-muted/30 hover:border-white/10"
                  )}
                >
                  {/* Header: Name + Tier */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => setSelectedFleet(fleet)}
                    >
                      <div className={cx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all",
                        hasUpgrade
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                          : "border-line bg-white/5 text-zinc-400 group-hover:text-white group-hover:border-white/20"
                      )}>
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white leading-tight truncate group-hover:text-accent transition-colors">
                          {fleet.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={cx(
                            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            fleet.plan === 'PREMIUM'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : fleet.plan === 'INSURANCE'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-white/5 text-zinc-500'
                          )}>
                            {fleet.plan === 'PREMIUM' ? 'Plus' : fleet.plan === 'INSURANCE' ? 'Insurance' : 'Core'}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {fleet.insurerName ? `(${fleet.insurerName})` : ''}
                          </span>
                          <span className="text-[10px] text-zinc-650">
                            {fleet._count.users}u · {fleet._count.bikes}b
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Banner */}
                  {hasUpgrade && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2">
                      <Sparkles size={13} className="text-blue-400 shrink-0" />
                      <span className="text-[11px] font-bold text-blue-400 flex-1">Upgrade to Operations Plus requested</span>
                      <button
                        onClick={() => approveUpgradeMutation.mutate(fleet.id)}
                        disabled={approveUpgradeMutation.isPending}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                        style={{ background: '#3B82F6' }}
                      >
                        <Check size={11} strokeWidth={3} />
                        Approve
                      </button>
                    </div>
                  )}

                  {/* Financial Status Row */}
                  <div className={cx("grid gap-2 mb-3", fleet.plan === 'INSURANCE' ? "grid-cols-1" : "grid-cols-2")}>
                    {/* Setup Fee */}
                    {fleet.plan !== 'INSURANCE' && (
                      <div className={cx(
                        "rounded-xl border p-3",
                        fleet.installationPaid
                          ? "border-emerald-500/10 bg-emerald-500/[0.03]"
                          : "border-amber-500/15 bg-amber-500/[0.04]"
                      )}>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Setup Fee</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-extrabold text-white">
                            {setupAmount > 0 ? `${(setupAmount / 1000).toFixed(0)}k` : '0'}
                          </span>
                          <span className={cx(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            fleet.installationPaid
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          )}>
                            <div className={cx("h-1 w-1 rounded-full", fleet.installationPaid ? 'bg-emerald-400' : 'bg-amber-400')} />
                            {fleet.installationPaid ? 'Paid' : 'Due'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Monthly Sub */}
                    <div className={cx(
                      "rounded-xl border p-3",
                      fleet.subscriptionStatus === 'ACTIVE'
                        ? "border-emerald-500/10 bg-emerald-500/[0.03]"
                        : fleet.subscriptionStatus === 'PAST_DUE'
                        ? "border-rose-500/15 bg-rose-500/[0.04]"
                        : "border-line bg-white/[0.02]"
                    )}>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Monthly</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-white">
                          {monthlyAmount > 0 ? `${(monthlyAmount / 1000).toFixed(0)}k` : '0'}
                          <span className="text-[9px] text-zinc-500 font-medium ml-0.5">/mo</span>
                        </span>
                        <span className={cx(
                          "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                          fleet.subscriptionStatus === 'ACTIVE'
                            ? 'text-emerald-400'
                            : fleet.subscriptionStatus === 'PAST_DUE'
                            ? 'text-rose-400'
                            : 'text-zinc-550'
                        )}>
                          <div className={cx("h-1 w-1 rounded-full",
                            fleet.subscriptionStatus === 'ACTIVE'
                              ? 'bg-emerald-400'
                              : fleet.subscriptionStatus === 'PAST_DUE'
                              ? 'bg-rose-400'
                              : 'bg-zinc-500'
                          )} />
                          {fleet.subscriptionStatus === 'ACTIVE'
                            ? 'Active'
                            : fleet.subscriptionStatus === 'PAST_DUE'
                            ? 'Overdue'
                            : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.04]">
                    {fleet.plan !== 'INSURANCE' && (
                      <button
                        onClick={() => toggleInstallationPaidMutation.mutate(fleet.id)}
                        disabled={toggleInstallationPaidMutation.isPending}
                        className={cx(
                          "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all border cursor-pointer active:scale-95 disabled:opacity-50",
                          fleet.installationPaid
                            ? 'bg-white/[0.03] text-zinc-500 border-white/[0.04] hover:text-zinc-300 hover:bg-white/[0.06]'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15'
                        )}
                      >
                        <Banknote size={12} />
                        {fleet.installationPaid ? 'Undo Setup' : 'Pay Setup'}
                      </button>
                    )}

                    <button
                      onClick={() => updateSubscriptionStatusMutation.mutate({
                        fleetId: fleet.id,
                        status: fleet.subscriptionStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE'
                      })}
                      disabled={updateSubscriptionStatusMutation.isPending}
                      className={cx(
                        "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all border cursor-pointer active:scale-95 disabled:opacity-50",
                        fleet.subscriptionStatus === 'ACTIVE'
                          ? 'bg-white/[0.03] text-zinc-500 border-white/[0.04] hover:text-zinc-300 hover:bg-white/[0.06]'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                      )}
                    >
                      <Clock size={12} />
                      {fleet.subscriptionStatus === 'ACTIVE' ? 'Mark Due' : 'Pay Sub'}
                    </button>

                    <button
                      onClick={() => setSelectedFleet(fleet)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.04] bg-white/[0.03] text-zinc-500 transition-all hover:bg-white/[0.06] hover:text-white cursor-pointer active:scale-95"
                      title="View Details"
                    >
                      <Sparkles size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* Fleet Detail Drawer */}
      <Drawer
        open={!!selectedFleet}
        title={activeFleetDetails?.name ?? 'Fleet Billing Profile'}
        description={activeFleetDetails ? `Organization ID: ${activeFleetDetails.id}` : ''}
        onClose={() => setSelectedFleet(null)}
      >
        {activeFleetDetails && (
          <div className="space-y-6">            {/* Plan Tier Highlight */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Service Plan</span>
                <span className={cx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border",
                  activeFleetDetails.plan === 'PREMIUM' 
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                    : activeFleetDetails.plan === 'INSURANCE'
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 font-bold border-purple-500/30'
                    : 'border-line bg-white/5 text-zinc-455'
                )}>
                  {activeFleetDetails.plan === 'PREMIUM' ? 'Operations Plus' : activeFleetDetails.plan === 'INSURANCE' ? 'Insurance' : 'Safety Core'}
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

            {/* Monthly Rate Per Bike Edit */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Edit Monthly Rate Per Bike (RWF)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  defaultValue={activeFleetDetails.monthlyRatePerBike ?? (activeFleetDetails.plan === 'PREMIUM' ? 10000 : activeFleetDetails.plan === 'INSURANCE' ? 0 : 5000)}
                  key={activeFleetDetails.id}
                  id={`rate-input-${activeFleetDetails.id}`}
                  placeholder="Rate in RWF..."
                  className="h-9 w-full rounded-xl border border-line bg-background px-3 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none transition-all"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById(`rate-input-${activeFleetDetails.id}`) as HTMLInputElement;
                    if (el) {
                      updateBillingRateMutation.mutate({
                        fleetId: activeFleetDetails.id,
                        monthlyRatePerBike: Number(el.value),
                      });
                    }
                  }}
                  disabled={updateBillingRateMutation.isPending}
                  className="shrink-0 h-9 px-4 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Setup Fee Details */}
            {activeFleetDetails.plan !== 'INSURANCE' && (
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
            )}

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
                  {(activeFleetDetails._count.bikes * (activeFleetDetails.monthlyRatePerBike ?? (activeFleetDetails.plan === 'PREMIUM' ? 10000 : activeFleetDetails.plan === 'INSURANCE' ? 0 : 5000))).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-400 font-semibold font-mono">RWF / month</span>
              </div>
              <p className="text-[10px] text-zinc-550 leading-relaxed pt-1 border-t border-white/5">
                Formula: {activeFleetDetails._count.bikes} bikes × {(activeFleetDetails.monthlyRatePerBike ?? (activeFleetDetails.plan === 'PREMIUM' ? 10000 : activeFleetDetails.plan === 'INSURANCE' ? 0 : 5000)).toLocaleString()} RWF/mo
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

                {activeFleetDetails.plan !== 'INSURANCE' && (
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
                )}

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
