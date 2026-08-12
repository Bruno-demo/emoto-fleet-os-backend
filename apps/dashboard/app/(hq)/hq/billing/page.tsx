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
  AlertCircle,
  Settings,
  Tag,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Info,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState, useMemo } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { cx, formatEnumLabel } from '@/lib/ui';

// ── Zod Schemas ──────────────────────────────────────────────────

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
    trialStartedAt: z.string().nullable().optional(),
    trialEndsAt: z.string().nullable().optional(),
    _count: z.object({
      users: z.number(),
      bikes: z.number(),
    }),
  })
);

type BillingFleet = z.infer<typeof billingFleetSchema>[number];

const pricingTierSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    planCode: z.string(),
    monthlyRatePerBike: z.number(),
    setupFeePerBike: z.number(),
    description: z.string().nullable(),
    isActive: z.boolean(),
  })
);

type PricingTier = z.infer<typeof pricingTierSchema>[number];

const discountSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    code: z.string().nullable(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
    value: z.string(),
    appliesTo: z.enum(['SETUP_FEE', 'SUBSCRIPTION', 'BOTH']),
    maxUses: z.number().nullable(),
    usedCount: z.number(),
    validFrom: z.string().nullable(),
    validUntil: z.string().nullable(),
    fleetId: z.string().nullable(),
    isActive: z.boolean(),
    fleet: z.object({ name: z.string() }).nullable().optional(),
  })
);

type Discount = z.infer<typeof discountSchema>[number];

const billingConfigSchema = z.object({
  id: z.string(),
  billingCycleDays: z.number(),
  gracePeriodDays: z.number(),
  trialEnabled: z.boolean(),
  trialDurationDays: z.number(),
  upcomingReminderDays: z.array(z.number()),
  overdueReminderDays: z.array(z.number()),
  currencyCode: z.string(),
});

type BillingConfig = z.infer<typeof billingConfigSchema>;

const billingCycleSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      fleetId: z.string(),
      cycleNumber: z.number(),
      periodStart: z.string(),
      periodEnd: z.string(),
      dueDate: z.string(),
      bikeCount: z.number(),
      ratePerBike: z.number(),
      subtotal: z.number(),
      discountAmount: z.number(),
      totalDue: z.number(),
      totalPaid: z.number(),
      status: z.enum(['DRAFT', 'PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELED', 'VOID']),
      isTrial: z.boolean(),
      notes: z.string().nullable(),
      paidAt: z.string().nullable(),
      createdAt: z.string(),
      fleet: z.object({ name: z.string(), plan: z.string() }),
      discount: z.object({ name: z.string(), code: z.string().nullable() }).nullable().optional(),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

type BillingCycle = z.infer<typeof billingCycleSchema>['data'][number];

// ── Main Component ────────────────────────────────────────────────

export default function HqBillingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ledger' | 'pricing' | 'discounts' | 'settings' | 'trials' | 'momo'>('ledger');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING_UPGRADE' | 'UNPAID_SETUP' | 'PAID_SETUP' | 'ENTERPRISE' | 'PAYG' | 'INSURANCE' | 'SUB_ACTIVE' | 'SUB_UNPAID'>('ALL');
  const [selectedFleet, setSelectedFleet] = useState<BillingFleet | null>(null);

  // Modals / Drawer Form States
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<BillingCycle | null>(null);

  // Queries
  const { data: fleets, isLoading: fleetsLoading } = useQuery({
    queryKey: ['hq', 'billing-fleets'],
    queryFn: () => apiFetch('/hq/billing', {}, { schema: billingFleetSchema }),
  });

  const { data: pricingTiers, isLoading: pricingLoading } = useQuery({
    queryKey: ['hq', 'billing-pricing'],
    queryFn: () => apiFetch('/billing/pricing', {}, { schema: pricingTierSchema }),
    enabled: activeTab === 'pricing' || activeTab === 'ledger',
  });

  const { data: discounts, isLoading: discountsLoading } = useQuery({
    queryKey: ['hq', 'billing-discounts'],
    queryFn: () => apiFetch('/billing/discounts', {}, { schema: discountSchema }),
    enabled: activeTab === 'discounts',
  });

  const { data: billingConfig, isLoading: configLoading } = useQuery({
    queryKey: ['hq', 'billing-config'],
    queryFn: () => apiFetch('/billing/config', {}, { schema: billingConfigSchema }),
    enabled: activeTab === 'settings',
  });

  const { data: momoStats } = useQuery<{ total: number; successful: number; failed: number; pending: number; successRate: number; totalRevenue: number }>({
    queryKey: ['hq', 'momo-stats'],
    queryFn: () => apiFetch('/billing/momo/stats'),
    enabled: activeTab === 'momo',
  });

  const { data: momoTransactions, refetch: refetchMomoTx } = useQuery<{ data: Array<{ id: string; referenceId: string; amount: number; payerPhone: string; status: string; financialTransactionId: string | null; failureReason: string | null; createdAt: string; fleet?: { name: string } }> }>({
    queryKey: ['hq', 'momo-transactions'],
    queryFn: () => apiFetch('/billing/momo/transactions?limit=50'),
    enabled: activeTab === 'momo',
  });

  const activeFleetDetails = useMemo(() => 
    fleets?.find(f => f.id === selectedFleet?.id) ?? selectedFleet,
    [fleets, selectedFleet]
  );

  const { data: fleetCycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ['hq', 'fleet-cycles', activeFleetDetails?.id],
    queryFn: () => apiFetch(`/billing/cycles?fleetId=${activeFleetDetails?.id}&pageSize=50`, {}, { schema: billingCycleSchema }),
    enabled: !!activeFleetDetails?.id,
  });

  // Mutations
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



  const grantTrialMutation = useMutation({
    mutationFn: ({ fleetId, durationDays }: { fleetId: string; durationDays: number }) =>
      apiFetch(`/hq/fleets/${fleetId}/trial`, {
        method: 'PUT',
        body: JSON.stringify({ durationDays }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  const createDiscountMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch('/billing/discounts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-discounts'] });
      setShowCreateDiscount(false);
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/billing/discounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-discounts'] });
    },
  });

  const updateBillingConfigMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch('/billing/config', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-config'] });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ cycleId, amount, method, reference, notes }: { cycleId: string; amount: number; method: string; reference?: string; notes?: string }) =>
      apiFetch(`/billing/cycles/${cycleId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, method, reference, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
      setShowRecordPayment(null);
    },
  });

  const [actionError, setActionError] = useState<string | null>(null);

  const generateCycleMutation = useMutation({
    mutationFn: (fleetId: string) =>
      apiFetch('/billing/cycles/generate', {
        method: 'POST',
        body: JSON.stringify({ fleetId }),
      }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to generate invoice cycle.');
    },
  });

  const voidCycleMutation = useMutation({
    mutationFn: (cycleId: string) =>
      apiFetch(`/billing/cycles/${cycleId}/void`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  // KPI Calculations
  const totalCount = fleets?.length ?? 0;
  const outstandingSetupCount = fleets?.filter(f => f.plan !== 'INSURANCE' && !f.installationPaid).length ?? 0;
  const setupPaidCount = fleets?.filter(f => f.plan !== 'INSURANCE' && f.installationPaid).length ?? 0;
  const pendingUpgradeCount = fleets?.filter(f => f.upgradeRequested).length ?? 0;
  const premiumCount = fleets?.filter(f => f.plan === 'PREMIUM').length ?? 0;
  const trialCount = fleets?.filter(f => f.trialEndsAt && new Date(f.trialEndsAt) > new Date()).length ?? 0;

  // Filters
  const filteredFleets = useMemo(() => {
    return fleets?.filter((fleet) => {
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchName = fleet.name.toLowerCase().includes(query);
        const matchId = fleet.id.toLowerCase().includes(query);
        if (!matchName && !matchId) return false;
      }

      switch (filterType) {
        case 'PENDING_UPGRADE':
          return fleet.upgradeRequested;
        case 'UNPAID_SETUP':
          return fleet.plan !== 'INSURANCE' && !fleet.installationPaid;
        case 'PAID_SETUP':
          return fleet.plan !== 'INSURANCE' && fleet.installationPaid;
        case 'ENTERPRISE':
          return fleet.plan === 'ENTERPRISE';
        case 'PAYG':
          return fleet.plan === 'PAYG';
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

  const trialFleets = useMemo(() => {
    return fleets?.filter(f => f.trialEndsAt && new Date(f.trialEndsAt) > new Date()) ?? [];
  }, [fleets]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">Billing Control Room</h1>
          <p className="mt-1 text-zinc-400">Track and manage client setup fees, pricing configurations, trial periods, and billing cycles.</p>
        </div>

        {activeTab === 'ledger' && (
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
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-1">
        {(['ledger', 'pricing', 'discounts', 'settings', 'trials'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cx(
              "px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer",
              activeTab === tab 
                ? 'border-accent text-accent' 
                : 'border-transparent text-zinc-400 hover:text-white'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* TAB 1: LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
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

            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Banknote size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Unpaid Setup</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{outstandingSetupCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
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

            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
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

            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Clock size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Fleets on Trial</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{trialCount}</p>
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
              {(['ALL', 'PENDING_UPGRADE', 'UNPAID_SETUP', 'PAID_SETUP', 'ENTERPRISE', 'PAYG', 'INSURANCE', 'SUB_ACTIVE', 'SUB_UNPAID'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={cx(
                    "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border",
                    filterType === type 
                      ? 'bg-white/10 text-white border-white/15' 
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
                  )}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Fleet Cards Grid */}
            {fleetsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface-muted/30 p-5" />
                ))}
              </div>
            ) : filteredFleets?.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-muted/30 py-20">
                <AlertCircle size={24} className="text-zinc-500" />
                <p className="mt-4 text-sm font-bold text-white">No Profiles Found</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredFleets?.map((fleet) => {
                  const setupAmount = 0;
                  const rate = fleet.monthlyRatePerBike ?? (fleet.plan === 'ENTERPRISE' ? 15000 : fleet.plan === 'INSURANCE' ? 0 : 10500);
                  const monthlyAmount = fleet._count.bikes * rate;
                  const hasUpgrade = fleet.upgradeRequested;

                  return (
                    <div
                      key={fleet.id}
                      className={cx(
                        "group relative rounded-2xl border p-5 transition-all duration-200 hover:translate-y-[-1px]",
                        hasUpgrade ? "border-blue-500/25 bg-blue-500/[0.03]" : "border-line bg-surface-muted/30 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => setSelectedFleet(fleet)}>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-400">
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate group-hover:text-accent transition-colors">{fleet.name}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={cx(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                fleet.plan === 'PREMIUM' ? 'bg-emerald-500/15 text-emerald-400' : fleet.plan === 'INSURANCE' ? 'bg-purple-500/15 text-purple-400' : 'bg-white/5 text-zinc-500'
                              )}>
                                {fleet.plan === 'PAYG' || !fleet.plan ? 'Pay-As-You-Go' : fleet.plan === 'PREMIUM' ? 'Delivery Fleet' : fleet.plan === 'INSURANCE' ? 'Insurance Partner' : 'Cooperative & Individual'}
                              </span>
                              {fleet.trialEndsAt && new Date(fleet.trialEndsAt) > new Date() && (
                                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                  <Sparkles size={9} className="text-cyan-400" />
                                  TRIAL ({Math.max(1, Math.ceil((new Date(fleet.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}d)
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-600">{fleet._count.users}u · {fleet._count.bikes}b</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {hasUpgrade && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2">
                          <Sparkles size={13} className="text-blue-400" />
                          <span className="text-[11px] font-bold text-blue-400 flex-1">Upgrade requested</span>
                          <button
                            onClick={() => approveUpgradeMutation.mutate(fleet.id)}
                            className="bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white rounded-lg"
                          >
                            Approve
                          </button>
                        </div>
                      )}

                      <div className="grid gap-2 mb-3 grid-cols-2">
                        <div className="rounded-xl border border-line bg-background/50 p-2.5">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase">Setup Fee</p>
                          <p className="text-xs font-extrabold text-white mt-1">{(setupAmount).toLocaleString()} RWF</p>
                        </div>
                        <div className="rounded-xl border border-line bg-background/50 p-2.5">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase">Subscription</p>
                          <p className="text-xs font-extrabold text-white mt-1">{(monthlyAmount).toLocaleString()} RWF/mo</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.04]">
                        {fleet.plan !== 'INSURANCE' && (
                          <button
                            onClick={() => toggleInstallationPaidMutation.mutate(fleet.id)}
                            className="flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg bg-white/5 border border-line text-zinc-400 hover:text-white"
                          >
                            {fleet.installationPaid ? 'Undo Setup' : 'Pay Setup'}
                          </button>
                        )}
                        <button
                          onClick={() => updateSubscriptionStatusMutation.mutate({ fleetId: fleet.id, status: fleet.subscriptionStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE' })}
                          className="flex-1 py-1.5 text-center text-[10px] font-bold rounded-lg bg-white/5 border border-line text-zinc-400 hover:text-white"
                        >
                          {fleet.subscriptionStatus === 'ACTIVE' ? 'Mark Due' : 'Pay Sub'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {/* TAB 2: PRICING CONFIGURATION */}
      {activeTab === 'pricing' && (
        <div className="grid gap-6 md:grid-cols-3">
          {pricingLoading ? (
            <p className="text-zinc-500">Loading pricing plans...</p>
          ) : (
            pricingTiers?.map((tier) => (
              <PricingTierCard
                key={tier.id}
                tier={tier}
              />
            ))
          )}
        </div>
      )}

      {/* TAB 3: DISCOUNTS */}
      {activeTab === 'discounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Discount & Promotion Codes</h2>
            <button
              onClick={() => setShowCreateDiscount(true)}
              className="inline-flex items-center gap-2 bg-accent text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-accent-strong active:scale-95 transition-all"
            >
              <Plus size={14} /> Create Discount
            </button>
          </div>

          <DashboardCard title="Active Promotions" description="Configure percentage discounts or flat promotional rate adjustments.">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Applies To</th>
                    <th className="py-3 px-4">Usage</th>
                    <th className="py-3 px-4">Validity</th>
                    <th className="py-3 px-4">Target Fleet</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {discountsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-zinc-500">Loading discount codes...</td>
                    </tr>
                  ) : discounts?.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-zinc-550">No promotional codes found.</td>
                    </tr>
                  ) : (
                    discounts?.map((discount) => (
                      <tr key={discount.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-bold text-white">{discount.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-accent">{discount.code ?? 'N/A'}</td>
                        <td className="py-3 px-4">{formatEnumLabel(discount.type)}</td>
                        <td className="py-3 px-4 font-bold">
                          {discount.type === 'PERCENTAGE' ? `${discount.value}%` : `${Number(discount.value).toLocaleString()} RWF`}
                        </td>
                        <td className="py-3 px-4">{formatEnumLabel(discount.appliesTo)}</td>
                        <td className="py-3 px-4 text-zinc-400">
                          {discount.usedCount} / {discount.maxUses ?? '∞'}
                        </td>
                        <td className="py-3 px-4 text-zinc-450">
                          {discount.validUntil ? new Date(discount.validUntil).toLocaleDateString() : 'Always Valid'}
                        </td>
                        <td className="py-3 px-4 text-zinc-400">{discount.fleet?.name ?? 'Global (All)'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => deleteDiscountMutation.mutate(discount.id)}
                            className="p-1.5 rounded-lg border border-line text-zinc-550 hover:text-rose-400 hover:border-rose-500/20"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Create Discount Modal */}
          {showCreateDiscount && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
              <div className="w-full max-w-md bg-surface-strong border border-line rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Create Promo Discount</h3>
                  <button onClick={() => setShowCreateDiscount(false)} className="text-zinc-500 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const body = {
                      name: fd.get('name') as string,
                      code: fd.get('code') as string || undefined,
                      type: fd.get('type') as string,
                      value: Number(fd.get('value')),
                      appliesTo: fd.get('appliesTo') as string,
                      maxUses: fd.get('maxUses') ? Number(fd.get('maxUses')) : undefined,
                      validUntil: fd.get('validUntil') ? new Date(fd.get('validUntil') as string).toISOString() : undefined,
                    };
                    createDiscountMutation.mutate(body);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Name</label>
                    <input type="text" name="name" required className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white" />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Promo Code (e.g. EARLY20)</label>
                    <input type="text" name="code" className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white uppercase" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 font-bold block mb-1">Discount Type</label>
                      <select name="type" className="h-9 w-full bg-background border border-line rounded-xl px-2 text-white">
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED_AMOUNT">Fixed Amount (RWF)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-400 font-bold block mb-1">Value</label>
                      <input type="number" name="value" required className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Applies To</label>
                    <select name="appliesTo" className="h-9 w-full bg-background border border-line rounded-xl px-2 text-white">
                      <option value="SUBSCRIPTION">Subscription Fees</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 font-bold block mb-1">Max Usage Limits</label>
                      <input type="number" name="maxUses" placeholder="Unlimited" className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white" />
                    </div>
                    <div>
                      <label className="text-zinc-400 font-bold block mb-1">Expiration Date</label>
                      <input type="date" name="validUntil" className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white" />
                    </div>
                  </div>

                  <div className="pt-3 flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateDiscount(false)}
                      className="px-4 py-2 border border-line rounded-xl text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createDiscountMutation.isPending}
                      className="px-5 py-2 bg-accent text-white font-bold rounded-xl hover:bg-accent-strong disabled:opacity-50"
                    >
                      Save Promo Code
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-xl space-y-6">
          <DashboardCard title="Global Billing Policies" description="These variables control automated billing cycles, overdue triggers, and reminder configurations globally.">
            {configLoading ? (
              <p className="text-zinc-550">Loading settings...</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const body = {
                    billingCycleDays: Number(fd.get('billingCycleDays')),
                    gracePeriodDays: Number(fd.get('gracePeriodDays')),
                    trialEnabled: fd.get('trialEnabled') === 'true',
                    trialDurationDays: Number(fd.get('trialDurationDays')),
                    currencyCode: fd.get('currencyCode') as string,
                  };
                  updateBillingConfigMutation.mutate(body);
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Billing Cycle Duration (Days)</label>
                    <input
                      type="number"
                      name="billingCycleDays"
                      defaultValue={billingConfig?.billingCycleDays}
                      className="h-10 w-full bg-background border border-line rounded-xl px-3 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Overdue Grace Period (Days)</label>
                    <input
                      type="number"
                      name="gracePeriodDays"
                      defaultValue={billingConfig?.gracePeriodDays}
                      className="h-10 w-full bg-background border border-line rounded-xl px-3 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Trial Period Enabled</label>
                    <select
                      name="trialEnabled"
                      defaultValue={billingConfig?.trialEnabled ? 'true' : 'false'}
                      className="h-10 w-full bg-background border border-line rounded-xl px-2 text-white"
                    >
                      <option value="true">Yes, Enable trials</option>
                      <option value="false">No, Direct invoicing</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 font-bold block mb-1">Trial Period Duration (Days)</label>
                    <input
                      type="number"
                      name="trialDurationDays"
                      defaultValue={billingConfig?.trialDurationDays}
                      className="h-10 w-full bg-background border border-line rounded-xl px-3 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 font-bold block mb-1">Platform Currency Code</label>
                  <input
                    type="text"
                    name="currencyCode"
                    defaultValue={billingConfig?.currencyCode}
                    className="h-10 w-full bg-background border border-line rounded-xl px-3 text-sm text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={updateBillingConfigMutation.isPending}
                  className="w-full h-10 rounded-xl bg-accent text-white font-bold hover:bg-accent-strong active:scale-95 transition-all text-xs"
                >
                  Save Global Policies
                </button>
              </form>
            )}
          </DashboardCard>
        </div>
      )}

      {/* TAB 5: TRIALS */}
      {activeTab === 'trials' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Form to Grant Trial */}
            <div className="md:col-span-1 rounded-3xl border border-line bg-surface-strong/50 p-6 space-y-4 h-fit">
              <h3 className="text-lg font-bold text-white">Grant Free Trial</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">Select a fleet and define the trial duration in days.</p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Select Fleet</label>
                  <select
                    id="trial-fleet-select"
                    className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-white"
                  >
                    <option value="">Choose a fleet...</option>
                    {fleets?.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Duration (Days)</label>
                  <input
                    type="number"
                    id="trial-duration-days"
                    defaultValue={14}
                    min={1}
                    className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-sm text-white"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  const fleetSelect = document.getElementById('trial-fleet-select') as HTMLSelectElement;
                  const durationInput = document.getElementById('trial-duration-days') as HTMLInputElement;
                  const fleetId = fleetSelect?.value;
                  const durationDays = Number(durationInput?.value);
                  if (!fleetId) {
                    alert('Please select a fleet first');
                    return;
                  }
                  if (isNaN(durationDays) || durationDays <= 0) {
                    alert('Please enter a valid positive number of days');
                    return;
                  }
                  grantTrialMutation.mutate({ fleetId, durationDays }, {
                    onSuccess: () => {
                      alert('Free trial granted successfully!');
                      if (fleetSelect) fleetSelect.value = '';
                      if (durationInput) durationInput.value = '14';
                    },
                    onError: (err: unknown) => {
                      const msg = err instanceof Error ? err.message : String(err);
                      alert(msg || 'Failed to grant free trial');
                    }
                  });
                }}
                disabled={grantTrialMutation.isPending}
                className="w-full h-10 rounded-xl bg-accent text-white font-bold hover:bg-accent-strong active:scale-95 transition-all text-xs disabled:opacity-50"
              >
                {grantTrialMutation.isPending ? "Granting..." : "Grant Free Trial"}
              </button>
            </div>

            {/* Table of Active Trials */}
            <div className="md:col-span-2">
              <DashboardCard title="Active Free Trials" description="Manage electric motorcycle fleet accounts currently operating on temporary free trial periods.">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Fleet Name</th>
                        <th className="py-3 px-4">Trial Start</th>
                        <th className="py-3 px-4">Trial End</th>
                        <th className="py-3 px-4">Bikes Count</th>
                        <th className="py-3 px-4">Remaining Days</th>
                        <th className="py-3 px-4">Subscription Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-zinc-300">
                      {fleetsLoading ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-500">Loading trials...</td>
                        </tr>
                      ) : trialFleets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-zinc-550">No fleets are currently on trial.</td>
                        </tr>
                      ) : (
                        trialFleets.map((fleet) => {
                          const daysRemaining = Math.max(0, Math.ceil((new Date(fleet.trialEndsAt!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
                          return (
                            <tr key={fleet.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4 font-bold text-white">{fleet.name}</td>
                              <td className="py-3 px-4 text-zinc-450">{fleet.trialStartedAt ? new Date(fleet.trialStartedAt).toLocaleDateString() : 'N/A'}</td>
                              <td className="py-3 px-4 text-zinc-450">{new Date(fleet.trialEndsAt!).toLocaleDateString()}</td>
                              <td className="py-3 px-4">{fleet._count.bikes} bikes</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">
                                  {daysRemaining} days left
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400">
                                  {fleet.subscriptionStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MOMO GATEWAY */}
      {activeTab === 'momo' && (
        <div className="space-y-6">
          {/* MoMo Gateway Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total MoMo Revenue</p>
              <p className="text-2xl font-extrabold text-emerald-400">{(momoStats?.totalRevenue ?? 0).toLocaleString()} RWF</p>
            </div>
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Success Rate</p>
              <p className="text-2xl font-extrabold text-white">{momoStats?.successRate ?? 0}%</p>
            </div>
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Successful Tx</p>
              <p className="text-2xl font-extrabold text-emerald-400">{momoStats?.successful ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Failed Tx</p>
              <p className="text-2xl font-extrabold text-rose-400">{momoStats?.failed ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-white/[0.06] bg-surface-strong/50 p-5 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Pending Tx</p>
              <p className="text-2xl font-extrabold text-amber-400">{momoStats?.pending ?? 0}</p>
            </div>
          </div>

          {/* MoMo Transactions Global Table */}
          <DashboardCard
            title="Global MoMo Transactions"
            description="Real-time audit log of all MTN Mobile Money payments across all fleets."
          >
            {!momoTransactions?.data || momoTransactions.data.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No MoMo transactions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Fleet</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Payer Phone</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">MTN Tx ID</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-zinc-300">
                    {momoTransactions.data.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-bold text-white">{tx.fleet?.name || '-'}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">{tx.referenceId.slice(0, 8)}...</td>
                        <td className="py-3 px-4 font-mono">{tx.payerPhone}</td>
                        <td className="py-3 px-4 font-bold text-white">{tx.amount.toLocaleString()} RWF</td>
                        <td className="py-3 px-4">
                          <span className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            tx.status === 'SUCCESSFUL'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : tx.status === 'FAILED'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">{tx.financialTransactionId || '-'}</td>
                        <td className="py-3 px-4 text-[11px] text-zinc-400 max-w-xs truncate">{tx.failureReason || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {tx.status === 'FAILED' && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiFetch(`/billing/momo/retry/${tx.id}`, { method: 'POST' });
                                  refetchMomoTx();
                                } catch (err: unknown) {
                                  alert(err instanceof Error ? err.message : 'Retry failed');
                                }
                              }}
                              className="rounded-lg border border-accent bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/20 transition cursor-pointer"
                            >
                              Retry Tx
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </div>
      )}

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
                    : activeFleetDetails.plan === 'INSURANCE'
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                    : 'border-line bg-white/5 text-zinc-500'
                )}>
                  {activeFleetDetails.plan === 'PREMIUM' ? 'Delivery Fleet' : activeFleetDetails.plan === 'INSURANCE' ? 'Insurance Partner' : 'Cooperative & Individual'}
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

            {actionError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center justify-between">
                <span>{actionError}</span>
                <button onClick={() => setActionError(null)} className="text-red-400 font-bold hover:text-white ml-2">✕</button>
              </div>
            )}

            {/* Invoices List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Invoice Billing Cycles</p>
                <button
                  onClick={() => generateCycleMutation.mutate(activeFleetDetails.id)}
                  disabled={generateCycleMutation.isPending}
                  className="inline-flex items-center gap-1 bg-white/5 border border-line text-zinc-400 hover:text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                >
                  <Plus size={10} /> Generate Invoice
                </button>
              </div>

              {cyclesLoading ? (
                <p className="text-xs text-zinc-550">Loading invoices...</p>
              ) : fleetCycles?.data.length === 0 ? (
                <p className="text-xs text-zinc-550">No invoices have been generated for this fleet.</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {fleetCycles?.data.map((cycle) => (
                    <div key={cycle.id} className="rounded-xl border border-line bg-background/50 p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-white">Invoice #{cycle.cycleNumber}</p>
                          <span className={cx(
                            "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                            cycle.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : cycle.status === 'OVERDUE' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                          )}>
                            {cycle.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {new Date(cycle.periodStart).toLocaleDateString()} - {new Date(cycle.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="font-bold text-white">{cycle.totalDue.toLocaleString()} RWF</p>
                          {cycle.totalPaid > 0 && <p className="text-[9px] text-emerald-400 font-semibold">Paid: {cycle.totalPaid.toLocaleString()}</p>}
                        </div>
                        {cycle.status !== 'PAID' && cycle.status !== 'VOID' && (cycle.totalDue - cycle.totalPaid) > 0 && (
                          <button
                            onClick={() => setShowRecordPayment(cycle)}
                            className="bg-accent px-2 py-1 rounded font-bold text-[10px] text-white"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Monthly Rate Per Bike */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Edit Monthly Rate Per Bike (RWF)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  defaultValue={activeFleetDetails.monthlyRatePerBike ?? (activeFleetDetails.plan === 'PREMIUM' ? 15000 : activeFleetDetails.plan === 'INSURANCE' ? 0 : 10000)}
                  key={activeFleetDetails.id}
                  id={`rate-input-${activeFleetDetails.id}`}
                  placeholder="Rate in RWF..."
                  className="h-9 w-full rounded-xl border border-line bg-background px-3 text-xs text-white"
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
                  className="shrink-0 h-9 px-4 rounded-xl text-xs font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-4 border-t border-line">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Billing Lifecycle Status</p>
              <div className="flex flex-col gap-2">
                {activeFleetDetails.upgradeRequested && (
                  <button
                    onClick={() => approveUpgradeMutation.mutate(activeFleetDetails.id)}
                    disabled={approveUpgradeMutation.isPending}
                    className="w-full py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl"
                  >
                    Approve Premium Upgrade
                  </button>
                )}

                {activeFleetDetails.plan !== 'INSURANCE' && (
                  <button
                    onClick={() => toggleInstallationPaidMutation.mutate(activeFleetDetails.id)}
                    className="w-full py-2.5 bg-white/5 border border-line text-zinc-400 hover:text-white font-bold text-xs rounded-xl"
                  >
                    {activeFleetDetails.installationPaid ? 'Mark Setup Fee Unpaid' : 'Mark Setup Fee Paid'}
                  </button>
                )}

                <button
                  onClick={() => updateSubscriptionStatusMutation.mutate({ fleetId: activeFleetDetails.id, status: activeFleetDetails.subscriptionStatus === 'ACTIVE' ? 'PAST_DUE' : 'ACTIVE' })}
                  className="w-full py-2.5 bg-white/5 border border-line text-zinc-400 hover:text-white font-bold text-xs rounded-xl"
                >
                  {activeFleetDetails.subscriptionStatus === 'ACTIVE' ? 'Mark Subscription Overdue' : 'Mark Subscription Active'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Record Payment Dialog */}
      {showRecordPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md bg-surface-strong border border-line rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Record Invoice Payment</h3>
              <button onClick={() => setShowRecordPayment(null)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Recording payment for invoice #{showRecordPayment.cycleNumber} of {showRecordPayment.fleet.name}. Total due is {showRecordPayment.totalDue.toLocaleString()} RWF.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const amount = Number(fd.get('amount'));
                if (amount < 1) return;
                recordPaymentMutation.mutate({
                  cycleId: showRecordPayment.id,
                  amount,
                  method: fd.get('method') as string,
                  reference: fd.get('reference') as string || undefined,
                  notes: fd.get('notes') as string || undefined,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="text-zinc-400 font-bold block mb-1">Payment Amount (RWF)</label>
                <input
                  type="number"
                  name="amount"
                  min={1}
                  defaultValue={Math.max(1, showRecordPayment.totalDue - showRecordPayment.totalPaid)}
                  max={showRecordPayment.totalDue - showRecordPayment.totalPaid}
                  required
                  className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Payment Method</label>
                <select name="method" className="h-9 w-full bg-background border border-line rounded-xl px-2 text-white">
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Transaction Reference (e.g. TxID)</label>
                <input type="text" name="reference" className="h-9 w-full bg-background border border-line rounded-xl px-3 text-white" />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">Notes / Description</label>
                <textarea name="notes" className="w-full bg-background border border-line rounded-xl p-3 text-white" rows={2} />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(null)}
                  className="px-4 py-2 border border-line rounded-xl text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 bg-accent text-white font-bold rounded-xl hover:bg-accent-strong disabled:opacity-50"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface PricingTierCardProps {
  tier: {
    id: string;
    planCode: string;
    name: string;
    monthlyRatePerBike: number;
    setupFeePerBike: number;
    description: string | null;
  };
}

const PREDEFINED_DESCRIPTIONS = [
  "10,000 RWF / month per bike. Full access to live map, remote control, rider scoring, financial management & reports. 0 RWF Device Setup Fee.",
  "15,000 RWF / month per bike. High-volume delivery fleet tracking, incident workflows, priority support & analytics. 0 RWF Device Setup Fee.",
  "Telemetry access, crash evidence packs, claims verification & partner API.",
];

function PricingTierCard({ tier }: PricingTierCardProps) {
  const queryClient = useQueryClient();

  const updatePricingTierMutation = useMutation({
    mutationFn: ({ planCode, name, monthlyRatePerBike, setupFeePerBike, description }: { planCode: string; name: string; monthlyRatePerBike: number; setupFeePerBike: number; description: string }) =>
      apiFetch(`/billing/pricing/${planCode}`, {
        method: 'PUT',
        body: JSON.stringify({ name, monthlyRatePerBike, setupFeePerBike, description }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'billing-fleets'] });
    },
  });

  const isPredefined = tier.description && PREDEFINED_DESCRIPTIONS.includes(tier.description);
  const initialSelectVal = isPredefined ? tier.description : "Other";
  
  const [selectVal, setSelectVal] = useState(initialSelectVal);
  const [customDesc, setCustomDesc] = useState(tier.description ?? "");

  return (
    <div className="rounded-3xl border border-line bg-surface-strong/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{tier.name}</h3>
        <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-zinc-400">{tier.planCode}</span>
      </div>
      
      <p className="text-xs text-zinc-400 min-h-[40px]">{tier.description}</p>
      
      <div className="h-px bg-line w-full" />
      
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Monthly Rate Per Bike (RWF)</label>
          <input
            type="number"
            id={`price-rate-${tier.planCode}`}
            defaultValue={tier.monthlyRatePerBike}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Setup Fee Per Bike (RWF)</label>
          <input
            type="number"
            id={`price-setup-${tier.planCode}`}
            defaultValue={tier.setupFeePerBike}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Description template</label>
          <select
            value={selectVal || ""}
            onChange={(e) => {
              setSelectVal(e.target.value);
              if (e.target.value !== "Other") {
                setCustomDesc(e.target.value);
              }
            }}
            className="mt-1 h-10 w-full rounded-xl border border-line bg-background px-3 text-xs text-white"
          >
            <option value="10,000 RWF / month per bike. Full access to live map, remote control, rider scoring, financial management & reports. 0 RWF Device Setup Fee.">Cooperative & Individual description</option>
            <option value="15,000 RWF / month per bike. High-volume delivery fleet tracking, incident workflows, priority support & analytics. 0 RWF Device Setup Fee.">Delivery Fleet description</option>
            <option value="Telemetry access, crash evidence packs, claims verification & partner API.">Insurance description</option>
            <option value="Other">Other (custom description)</option>
          </select>
        </div>

        {selectVal === "Other" ? (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Custom Description</label>
            <textarea
              id={`price-desc-${tier.planCode}`}
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-background p-3 text-xs text-white animate-fade-in"
              rows={3}
              placeholder="Enter custom plan description..."
            />
          </div>
        ) : (
          <textarea
            id={`price-desc-${tier.planCode}`}
            value={selectVal || ""}
            readOnly
            className="hidden"
          />
        )}
      </div>

      <button
        onClick={() => {
          const rate = Number((document.getElementById(`price-rate-${tier.planCode}`) as HTMLInputElement).value);
          const setup = Number((document.getElementById(`price-setup-${tier.planCode}`) as HTMLInputElement).value);
          const desc = selectVal === "Other" ? customDesc : (selectVal || "");
          updatePricingTierMutation.mutate({
            planCode: tier.planCode,
            name: tier.name,
            monthlyRatePerBike: rate,
            setupFeePerBike: setup,
            description: desc,
          });
        }}
        disabled={updatePricingTierMutation.isPending}
        className="w-full h-10 rounded-xl bg-accent text-white font-bold hover:bg-accent-strong active:scale-95 transition-all text-xs disabled:opacity-50"
      >
        {updatePricingTierMutation.isPending ? "Saving..." : "Save Tier Config"}
      </button>
    </div>
  );
}
