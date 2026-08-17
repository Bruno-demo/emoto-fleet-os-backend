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
  Phone,
  Info,
  RefreshCw,
  Edit2,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { useState, useMemo } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { cx, formatEnumLabel } from '@/lib/ui';

// ── Helper Utilities ─────────────────────────────────────────────

const getFleetDailyRate = (type?: string | null, emotoPaygRatePerActiveDay?: number | null) => {
  if (type === 'DELIVERY') {
    return (!emotoPaygRatePerActiveDay || emotoPaygRatePerActiveDay === 350) ? 500 : emotoPaygRatePerActiveDay;
  }
  return emotoPaygRatePerActiveDay ?? 350;
};

// ── Zod Schemas ──────────────────────────────────────────────────

const billingFleetSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string().nullable().optional(),
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
    emotoPaygRatePerActiveDay: z.number().nullable().optional(),
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
  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'active-revenue' | 'revenue-risk' | 'pricing' | 'discounts' | 'settings' | 'trials' | 'momo'>('ledger');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING_UPGRADE' | 'UNPAID_SETUP' | 'PAID_SETUP' | 'ENTERPRISE' | 'PAYG' | 'INSURANCE' | 'SUB_ACTIVE' | 'SUB_UNPAID'>('ALL');
  const [selectedFleet, setSelectedFleet] = useState<BillingFleet | null>(null);

  // Modals / Drawer Form States
  const [showCreateDiscount, setShowCreateDiscount] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<BillingCycle | null>(null);
  const [breakdownCycleId, setBreakdownCycleId] = useState<string | null>(null);

  // Query all weekly billing cycles for HQ settlement
  const { data: allHqBillingCycles = [], isLoading: allCyclesLoading } = useQuery({
    queryKey: ['hq', 'all-billing-cycles'],
    queryFn: () => apiFetch<Array<{
      id: string;
      fleetId: string;
      fleetName: string;
      cycleNumber: number;
      periodStart: string;
      periodEnd: string;
      dueDate: string;
      bikeCount: number;
      ratePerBike: number;
      subtotal: number;
      totalDue: number;
      totalPaid: number;
      status: 'DRAFT' | 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELED' | 'VOID';
      isTrial: boolean;
      payments: Array<{
        id: string;
        amount: number;
        method: string;
        reference: string | null;
        notes: string | null;
        paidAt: string;
      }>;
    }>>('/hq/billing/cycles'),
  });

  // Week Selection & Invoice Filtering States
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | 'ALL'>(0);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL');
  const [groupByFleet, setGroupByFleet] = useState<boolean>(false);
  const [expandedFleetIds, setExpandedFleetIds] = useState<Record<string, boolean>>({});

  const toggleFleetExpanded = (fleetId: string) => {
    setExpandedFleetIds(prev => ({ ...prev, [fleetId]: !prev[fleetId] }));
  };

  const weekOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentMon = new Date(now);
    const day = currentMon.getDay();
    const diffToMon = currentMon.getDate() - day + (day === 0 ? -6 : 1);
    currentMon.setDate(diffToMon);
    currentMon.setHours(0, 0, 0, 0);

    for (let i = 0; i < 8; i++) {
      const start = new Date(currentMon);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const label = i === 0 ? 'Current Week' : i === 1 ? 'Last Week' : `${i} Weeks Ago`;
      const dateStr = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      options.push({
        index: i,
        label: `${label} (${dateStr})`,
        start,
        end,
      });
    }
    return options;
  }, []);

  const filteredWeeklyInvoices = useMemo(() => {
    return allHqBillingCycles.filter((cycle) => {
      // 0. Exclude Insurers completely from Weekly Software Invoices
      if ((cycle as any).fleetPlan === 'INSURANCE') return false;

      // 1. Week Filter
      if (selectedWeekIndex !== 'ALL') {
        const week = weekOptions[selectedWeekIndex];
        if (week) {
          const cStart = new Date(cycle.periodStart).getTime();
          const wStart = week.start.getTime();
          const wEnd = week.end.getTime();
          if (cStart < wStart || cStart > wEnd) {
            return false;
          }
        }
      }

      // 2. Status Filter
      if (invoiceStatusFilter !== 'ALL') {
        if (invoiceStatusFilter === 'PENDING' && cycle.status !== 'PENDING' && cycle.status !== 'DRAFT') return false;
        if (invoiceStatusFilter === 'PAID' && cycle.status !== 'PAID') return false;
        if (invoiceStatusFilter === 'OVERDUE' && cycle.status !== 'OVERDUE') return false;
      }

      // 3. Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = cycle.fleetName.toLowerCase().includes(q);
        const matchesCycle = `#${cycle.cycleNumber}`.includes(q);
        if (!matchesName && !matchesCycle) return false;
      }

      return true;
    });
  }, [allHqBillingCycles, selectedWeekIndex, invoiceStatusFilter, search, weekOptions]);

  const groupedFleetInvoices = useMemo(() => {
    const map = new Map<string, {
      fleetId: string;
      fleetName: string;
      fleetPlan: string;
      isTrial: boolean;
      totalDue: number;
      totalPaid: number;
      pendingCount: number;
      overdueCount: number;
      latestBikeCount: number;
      cycles: typeof filteredWeeklyInvoices;
    }>();

    for (const cycle of filteredWeeklyInvoices) {
      const existing = map.get(cycle.fleetId);
      if (existing) {
        existing.totalDue += cycle.totalDue;
        existing.totalPaid += cycle.totalPaid;
        if (cycle.status === 'PENDING' || cycle.status === 'DRAFT') existing.pendingCount++;
        if (cycle.status === 'OVERDUE') existing.overdueCount++;
        existing.cycles.push(cycle);
      } else {
        map.set(cycle.fleetId, {
          fleetId: cycle.fleetId,
          fleetName: cycle.fleetName,
          fleetPlan: (cycle as any).fleetPlan ?? 'PAYG',
          isTrial: cycle.isTrial,
          totalDue: cycle.totalDue,
          totalPaid: cycle.totalPaid,
          pendingCount: (cycle.status === 'PENDING' || cycle.status === 'DRAFT') ? 1 : 0,
          overdueCount: cycle.status === 'OVERDUE' ? 1 : 0,
          latestBikeCount: cycle.bikeCount,
          cycles: [cycle],
        });
      }
    }

    return Array.from(map.values());
  }, [filteredWeeklyInvoices]);

  const weeklyMetrics = useMemo(() => {
    const totalDue = filteredWeeklyInvoices.reduce((sum, c) => sum + c.totalDue, 0);
    const totalPaid = filteredWeeklyInvoices.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalOutstanding = Math.max(0, totalDue - totalPaid);
    const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 100;
    const pendingCount = filteredWeeklyInvoices.filter(c => c.status === 'PENDING' || c.status === 'DRAFT' || c.status === 'OVERDUE').length;

    return {
      totalInvoices: filteredWeeklyInvoices.length,
      totalDue,
      totalPaid,
      totalOutstanding,
      collectionRate,
      pendingCount,
    };
  }, [filteredWeeklyInvoices]);

  const { data: cycleBreakdownData, isLoading: breakdownLoading } = useQuery({
    queryKey: ['hq', 'cycle-breakdown', breakdownCycleId],
    queryFn: () => apiFetch<{
      cycle: BillingCycle;
      audit: {
        totalActiveBikeDays: number;
        totalExemptBikeDays: number;
        totalPaygSubtotalRwf: number;
        perBikeSummary: Array<{
          bikeId: string;
          bikeLabel: string;
          bikePlate: string | null;
          activeDays: number;
          paygChargesRwf: number;
          totalDistanceKm: number;
        }>;
      };
      notes: string;
    }>(`/billing/cycles/${breakdownCycleId}/breakdown`),
    enabled: !!breakdownCycleId,
  });

  // Queries
  const { data: activeRevenueData, isLoading: activeRevenueLoading } = useQuery({
    queryKey: ['hq', 'billing-active-revenue'],
    queryFn: () => apiFetch<{
      summary: {
        totalActiveDevices: number;
        totalDailyRevenueRwf: number;
        totalMtdRevenueRwf: number;
        estMonthlyMrrRwf: number;
        activeFleetsCount: number;
      };
      devices: Array<{
        id: string;
        deviceUid: string;
        status: string;
        lastSeenAt: string | null;
        dailyRate: number;
        uniqueActiveDaysMtd: number;
        mtdRevenueRwf: number;
        fleet: {
          id: string;
          name: string;
          type: string;
          adminEmail: string | null;
          adminPhone: string | null;
        } | null;
        bike: {
          id: string;
          label: string;
          plate: string | null;
          model: string | null;
          riderName: string | null;
          riderPhone: string | null;
          tripsCountMtd: number;
        } | null;
      }>;
    }>('/billing/active-revenue'),
  });

  const { data: inactiveDevicesData, isLoading: inactiveDevicesLoading } = useQuery({
    queryKey: ['hq', 'billing-inactive-devices'],
    queryFn: () => apiFetch<{
      summary: {
        totalInactiveDevices: number;
        totalRevenueLostRwf: number;
        impactedFleetsCount: number;
      };
      devices: Array<{
        id: string;
        deviceUid: string;
        status: string;
        lastSeenAt: string | null;
        inactiveHours: number;
        inactiveDays: number;
        dailyRate: number;
        estimatedLossRwf: number;
        fleet: {
          id: string;
          name: string;
          type: string;
          adminEmail: string | null;
          adminPhone: string | null;
        } | null;
        bike: {
          id: string;
          label: string;
          plate: string | null;
          riderName: string | null;
          riderPhone: string | null;
        } | null;
      }>;
    }>('/billing/inactive-devices'),
  });

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

  const updateFleetTypeMutation = useMutation({
    mutationFn: ({ fleetId, type }: { fleetId: string; type: 'COOP' | 'DELIVERY' | 'PERSONAL' }) =>
      apiFetch(`/hq/fleets/${fleetId}/type`, {
        method: 'PUT',
        body: JSON.stringify({ type }),
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
      apiFetch(`/hq/billing/cycles/${cycleId}/approve-payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, method, reference, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'fleet-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'all-billing-cycles'] });
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
  const paygCount = fleets?.filter(f => f.plan === 'PAYG').length ?? 0;
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
        {(['ledger', 'invoices', 'active-revenue', 'revenue-risk', 'pricing', 'discounts', 'settings', 'trials'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cx(
              "px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer flex items-center gap-2",
              activeTab === tab 
                ? 'border-accent text-accent' 
                : 'border-transparent text-zinc-400 hover:text-white'
            )}
          >
            {tab === 'invoices' ? (
              <>
                <span>Weekly Invoices</span>
                {allHqBillingCycles.filter(c => c.status === 'PENDING' || c.status === 'OVERDUE' || c.status === 'DRAFT').length > 0 ? (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                    {allHqBillingCycles.filter(c => c.status === 'PENDING' || c.status === 'OVERDUE' || c.status === 'DRAFT').length}
                  </span>
                ) : null}
              </>
            ) : tab === 'active-revenue' ? (
              <>
                <span>Active Revenue</span>
                {activeRevenueData?.summary.totalActiveDevices ? (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                    {activeRevenueData.summary.totalActiveDevices}
                  </span>
                ) : null}
              </>
            ) : tab === 'revenue-risk' ? (
              <>
                <span>Revenue Risk</span>
                {inactiveDevicesData?.summary.totalInactiveDevices ? (
                  <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-extrabold">
                    {inactiveDevicesData.summary.totalInactiveDevices}
                  </span>
                ) : null}
              </>
            ) : (
              tab.charAt(0).toUpperCase() + tab.slice(1)
            )}
          </button>
        ))}
      </div>

      {/* TAB: WEEKLY INVOICES & SETTLEMENTS */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Header & Top Week Filter Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                <FileText size={20} className="text-accent" />
                Weekly Invoices & Manual Settlements
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Filter invoices by billing week, inspect active bike metrics, and approve received manual settlements.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Week Time Selector */}
              <div className="relative flex items-center">
                <Calendar size={15} className="absolute left-3 text-accent pointer-events-none" />
                <select
                  value={selectedWeekIndex}
                  onChange={(e) => setSelectedWeekIndex(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                  className="h-10 rounded-xl border border-accent/40 bg-accent/10 pl-9 pr-8 text-xs font-bold text-white outline-none focus:border-accent cursor-pointer hover:bg-accent/20 transition-all appearance-none"
                >
                  <option value="ALL" className="bg-zinc-900 text-white font-medium">All Time Weeks (Historical)</option>
                  {weekOptions.map((w) => (
                    <option key={w.index} value={w.index} className="bg-zinc-900 text-white font-medium">
                      {w.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 pointer-events-none text-zinc-400 text-[10px]">▼</div>
              </div>

              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['hq', 'all-billing-cycles'] })}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-muted px-3.5 text-xs font-semibold text-zinc-300 hover:bg-surface-hover hover:text-white transition cursor-pointer"
              >
                <RefreshCw size={14} className={allCyclesLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Synchronized Financial KPI Summary Bar */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-3xl border border-line bg-surface p-5 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent border border-accent/20">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Weekly Invoices</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    {weeklyMetrics.totalInvoices} <span className="text-xs text-zinc-400 font-normal">invoices</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Banknote size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Total Collected (Paid)</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">
                    {weeklyMetrics.totalPaid.toLocaleString()} <span className="text-xs text-emerald-400/80 font-normal">RWF</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.03] p-5 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Outstanding Balance</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-0.5">
                    {weeklyMetrics.totalOutstanding.toLocaleString()} <span className="text-xs text-amber-400/80 font-normal">RWF</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/[0.03] p-5 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">Collection Rate</p>
                  <p className="text-2xl font-extrabold text-white mt-0.5">
                    {weeklyMetrics.collectionRate}% <span className="text-xs text-zinc-400 font-normal">settled</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills, Search & Group Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setInvoiceStatusFilter(st)}
                  className={cx(
                    'px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer border',
                    invoiceStatusFilter === st
                      ? st === 'PAID' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : st === 'OVERDUE' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : st === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-accent/20 text-accent border-accent/40'
                      : 'bg-surface-muted text-zinc-400 border-line hover:text-white'
                  )}
                >
                  {st === 'ALL' ? 'All Statuses' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Group by Fleet Toggle */}
              {selectedWeekIndex === 'ALL' && (
                <button
                  type="button"
                  onClick={() => setGroupByFleet(!groupByFleet)}
                  className={cx(
                    "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap",
                    groupByFleet
                      ? "border-accent bg-accent/15 text-accent shadow-sm"
                      : "border-line bg-surface-muted text-zinc-400 hover:text-white hover:bg-surface-hover"
                  )}
                >
                  <Layers size={14} />
                  {groupByFleet ? "Grouped by Fleet" : "Group by Fleet"}
                </button>
              )}

              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search fleet or invoice #"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-xl border border-line bg-surface-strong pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Synchronized Table (Grouped vs Chronological) */}
          <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-sm">
            {allCyclesLoading ? (
              <div className="p-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-accent" />
                <span>Loading weekly billing cycles...</span>
              </div>
            ) : filteredWeeklyInvoices.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <FileText size={36} className="mx-auto text-zinc-600" />
                <p className="text-sm font-bold text-zinc-300">No Weekly Invoices Matching Selection</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">Try switching the week selector or status filter above.</p>
              </div>
            ) : (selectedWeekIndex === 'ALL' && groupByFleet) ? (
              /* GROUPED BY FLEET ACCORDION TABLE */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-muted/60 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    <tr>
                      <th className="px-5 py-3.5">Fleet Organization</th>
                      <th className="px-5 py-3.5">Weekly Cycles</th>
                      <th className="px-5 py-3.5">Bikes</th>
                      <th className="px-5 py-3.5">Total Amount Due</th>
                      <th className="px-5 py-3.5">Total Paid</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions / Expand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {groupedFleetInvoices.map((group) => {
                      const isExpanded = !!expandedFleetIds[group.fleetId];
                      const isSettled = group.pendingCount === 0 && group.overdueCount === 0;
                      const hasOverdue = group.overdueCount > 0;

                      return (
                        <>
                          <tr key={group.fleetId} className="hover:bg-surface-muted/40 transition-colors bg-surface-muted/10">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => toggleFleetExpanded(group.fleetId)}
                                  className="p-1 text-zinc-400 hover:text-white transition cursor-pointer"
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold text-xs shrink-0 border border-accent/20">
                                  {group.fleetName.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-extrabold text-white text-sm block">{group.fleetName}</span>
                                  <span className="text-[10px] text-zinc-400 font-medium">PAYG Fleet</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 font-bold text-zinc-300">
                              <span className="rounded-lg bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 text-xs">
                                {group.cycles.length} Weekly Cycles
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-white">
                              {group.latestBikeCount} bikes
                            </td>
                            <td className="px-5 py-4 font-extrabold text-white text-sm">
                              {group.totalDue.toLocaleString()} RWF
                            </td>
                            <td className="px-5 py-4 font-bold text-emerald-400 text-sm">
                              {group.totalPaid.toLocaleString()} RWF
                            </td>
                            <td className="px-5 py-4">
                              <span className={cx(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border',
                                isSettled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                hasOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              )}>
                                {isSettled ? <Check size={12} /> : hasOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
                                {isSettled ? 'ALL SETTLED' : hasOverdue ? `${group.overdueCount} OVERDUE` : `${group.pendingCount} PENDING`}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => toggleFleetExpanded(group.fleetId)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-muted px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-surface-hover hover:text-white transition cursor-pointer"
                              >
                                {isExpanded ? 'Hide Cycles' : `View Cycles (${group.cycles.length})`}
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Nested Sub-Table */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0 bg-black/30 border-y border-accent/20">
                                <div className="p-4 pl-12">
                                  <table className="w-full text-left text-xs bg-surface-strong/60 rounded-2xl overflow-hidden border border-line">
                                    <thead className="bg-surface-muted/80 text-[10px] uppercase font-bold text-zinc-400 border-b border-line">
                                      <tr>
                                        <th className="px-4 py-2.5">Cycle #</th>
                                        <th className="px-4 py-2.5">Billing Period</th>
                                        <th className="px-4 py-2.5">Active Bikes</th>
                                        <th className="px-4 py-2.5">Total Due</th>
                                        <th className="px-4 py-2.5">Paid</th>
                                        <th className="px-4 py-2.5">Status</th>
                                        <th className="px-4 py-2.5 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line/40">
                                      {group.cycles.map((subCycle) => {
                                        const isPaid = subCycle.status === 'PAID';
                                        const isOverdue = subCycle.status === 'OVERDUE';
                                        return (
                                          <tr key={subCycle.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-bold text-white">Cycle #{subCycle.cycleNumber}</td>
                                            <td className="px-4 py-3 text-zinc-300">
                                              {new Date(subCycle.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(subCycle.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-zinc-300">{subCycle.bikeCount} bikes</td>
                                            <td className="px-4 py-3 font-bold text-white">{subCycle.totalDue.toLocaleString()} RWF</td>
                                            <td className="px-4 py-3 font-bold text-emerald-400">{subCycle.totalPaid.toLocaleString()} RWF</td>
                                            <td className="px-4 py-3">
                                              <span className={cx(
                                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold border',
                                                isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                              )}>
                                                {subCycle.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                              {!isPaid ? (
                                                <button
                                                  onClick={() => setShowRecordPayment({
                                                    ...subCycle,
                                                    fleet: { name: subCycle.fleetName, plan: 'PAYG' }
                                                  } as any)}
                                                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-bold text-white hover:bg-accent-strong transition cursor-pointer"
                                                >
                                                  <Banknote size={12} />
                                                  Approve
                                                </button>
                                              ) : (
                                                <span className="text-[10px] text-emerald-400 font-semibold italic">Settled</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* CHRONOLOGICAL LIST TABLE (SINGLE WEEK OR UNGROUPED) */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface-muted/60 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    <tr>
                      <th className="px-5 py-3.5">Fleet Name</th>
                      <th className="px-5 py-3.5">Cycle #</th>
                      <th className="px-5 py-3.5">Billing Window</th>
                      <th className="px-5 py-3.5">Active Bikes</th>
                      <th className="px-5 py-3.5">Total Amount Due</th>
                      <th className="px-5 py-3.5">Total Paid</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {filteredWeeklyInvoices.map((cycle) => {
                      const isPaid = cycle.status === 'PAID';
                      const isOverdue = cycle.status === 'OVERDUE';
                      const isPartial = cycle.status === 'PARTIAL';

                      return (
                        <tr key={cycle.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent font-bold text-xs shrink-0">
                                {cycle.fleetName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-extrabold text-white text-sm block">{cycle.fleetName}</span>
                                {cycle.isTrial ? (
                                  <span className="inline-flex items-center rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 border border-purple-500/20">
                                    Free Trial
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-zinc-400 font-medium">PAYG Billing</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-bold text-zinc-300">
                            <span className="rounded-lg bg-surface-muted px-2 py-1 text-xs border border-line">
                              Cycle #{cycle.cycleNumber}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-zinc-200 block">
                              {new Date(cycle.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(cycle.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Due: {new Date(cycle.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-medium text-zinc-300">
                            <span className="inline-flex items-center gap-1 font-bold text-white">
                              {cycle.bikeCount} <span className="text-zinc-500 font-normal">bikes</span>
                            </span>
                          </td>
                          <td className="px-5 py-4 font-extrabold text-white text-sm">
                            {cycle.totalDue.toLocaleString()} RWF
                          </td>
                          <td className="px-5 py-4 font-bold text-emerald-400 text-sm">
                            {cycle.totalPaid.toLocaleString()} RWF
                          </td>
                          <td className="px-5 py-4">
                            <span className={cx(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border',
                              isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              isPartial ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              isOverdue ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            )}>
                              {isPaid ? <Check size={12} /> : isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
                              {cycle.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!isPaid ? (
                              <button
                                onClick={() => setShowRecordPayment({
                                  ...cycle,
                                  fleet: { name: cycle.fleetName, plan: 'PAYG' }
                                } as any)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-accent-strong transition cursor-pointer active:scale-95"
                              >
                                <Banknote size={14} />
                                Approve Payment
                              </button>
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                  <Check size={12} /> Settled
                                </span>
                                <span className="text-[10px] text-zinc-500">
                                  {cycle.payments[0]?.method?.replace('_', ' ') || 'Manual Settlement'}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1.5: ACTIVE REVENUE (WORKING DEVICES & EARNINGS) */}
      {activeTab === 'active-revenue' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Active Working Trackers</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {activeRevenueData?.summary.totalActiveDevices ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Banknote size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Daily Revenue Earned</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                    {(activeRevenueData?.summary.totalDailyRevenueRwf ?? 0).toLocaleString()} RWF <span className="text-[10px] text-zinc-400 font-normal">/day</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/[0.04] p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">Est. Monthly MRR</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {(activeRevenueData?.summary.estMonthlyMrrRwf ?? 0).toLocaleString()} RWF
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-purple-500/20 bg-purple-500/[0.04] p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/80">Earning Fleets</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {activeRevenueData?.summary.activeFleetsCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Revenue Audit Table */}
          <DashboardCard
            eyebrow="Revenue Generation"
            title="Active Trackers & Daily Earnings Audit"
            description="Trackers actively reporting telemetry on working motorcycles generating daily active revenue."
          >
            {activeRevenueLoading ? (
              <p className="text-zinc-500 py-8 text-center">Loading active working devices...</p>
            ) : activeRevenueData?.devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Info size={28} className="text-zinc-500" />
                <p className="mt-3 text-sm font-bold text-white">No Active Devices Reporting</p>
                <p className="mt-1 text-xs text-zinc-400">Devices will appear here as soon as telemetry heartbeats and active trips are verified.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-zinc-400 font-bold uppercase tracking-wider bg-white/[0.02]">
                      <th className="py-3 px-4">Device / UID</th>
                      <th className="py-3 px-4">Fleet & Type</th>
                      <th className="py-3 px-4">Assigned Moto & Rider</th>
                      <th className="py-3 px-4 text-center">Active Days MTD</th>
                      <th className="py-3 px-4 text-right">Daily Active Rate</th>
                      <th className="py-3 px-4 text-right">MTD Revenue Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeRevenueData?.devices.map((device) => (
                      <tr key={device.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{device.deviceUid}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-extrabold font-sans">
                              ✓ Verified Active (Trips + Station Stops)
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white">{device.fleet?.name || 'HQ Managed'}</p>
                          <span className={cx(
                            "inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border",
                            device.fleet?.type === 'DELIVERY'
                              ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                              : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          )}>
                            {device.fleet?.type === 'DELIVERY' ? 'Delivery (500 RWF/d)' : 'Coop (350 RWF/d)'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {device.bike ? (
                            <div>
                              <p className="font-bold text-emerald-300">{device.bike.plate || device.bike.label}</p>
                              {device.bike.riderName ? (
                                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                                  Motari: {device.bike.riderName} ({device.bike.riderPhone || 'No Phone'})
                                </p>
                              ) : (
                                <p className="text-[10px] text-zinc-600 mt-0.5">Unassigned Motari</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">Unassigned Bike</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-extrabold">
                            {device.uniqueActiveDaysMtd} active days
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                          +{device.dailyRate} RWF <span className="text-[9px] text-zinc-500 font-normal">/day</span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-300">
                          +{device.mtdRevenueRwf.toLocaleString()} RWF
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

      {/* TAB 2: REVENUE RISK (INACTIVE DEVICES) */}
      {activeTab === 'revenue-risk' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/[0.04] p-6 relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/80">Non-Working Trackers</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {inactiveDevicesData?.summary.totalInactiveDevices ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Banknote size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Accumulated Lost Revenue</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">
                    {(inactiveDevicesData?.summary.totalRevenueLostRwf ?? 0).toLocaleString()} RWF
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-500/20 bg-blue-500/[0.04] p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">Impacted Fleets</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {inactiveDevicesData?.summary.impactedFleetsCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Table & Action Center */}
          <DashboardCard
            eyebrow="Revenue Risk"
            title="Non-Working Trackers Audit & Action Center"
            description="Trackers offline or with zero verified active days generate 0 RWF revenue. Contact fleet admins immediately to replace or reassign them."
          >
            {inactiveDevicesLoading ? (
              <p className="text-zinc-500 py-8 text-center">Loading non-working devices...</p>
            ) : inactiveDevicesData?.devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Check size={28} className="text-emerald-400" />
                <p className="mt-3 text-sm font-bold text-white">All Trackers Active!</p>
                <p className="mt-1 text-xs text-zinc-400">All registered IoT devices are reporting telemetry and generating daily revenue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-zinc-400 font-bold uppercase tracking-wider bg-white/[0.02]">
                      <th className="py-3 px-4">Device / UID</th>
                      <th className="py-3 px-4">Fleet & Admin Contact</th>
                      <th className="py-3 px-4">Assigned Moto & Rider</th>
                      <th className="py-3 px-4">Idle Duration</th>
                      <th className="py-3 px-4 text-right">Daily Rate Lost</th>
                      <th className="py-3 px-4 text-right">Total Est. Loss</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {inactiveDevicesData?.devices.map((device) => (
                      <tr key={device.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                            <span>{device.deviceUid}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-sans mt-0.5">ID: {device.id.slice(0, 8)}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white">{device.fleet?.name || 'Unassigned Fleet'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {device.fleet?.adminPhone ? (
                              <a
                                href={`tel:${device.fleet.adminPhone}`}
                                className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                              >
                                <Phone size={10} /> {device.fleet.adminPhone}
                              </a>
                            ) : device.fleet?.adminEmail ? (
                              <span className="text-[10px] text-zinc-400 truncate">{device.fleet.adminEmail}</span>
                            ) : (
                              <span className="text-[10px] text-zinc-600">No Admin Contact</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {device.bike ? (
                            <div>
                              <p className="font-bold text-zinc-200">{device.bike.plate || device.bike.label}</p>
                              {device.bike.riderName ? (
                                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                                  Motari: {device.bike.riderName} ({device.bike.riderPhone || 'No Phone'})
                                </p>
                              ) : (
                                <p className="text-[10px] text-zinc-600 mt-0.5">No Rider Assigned</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">Unassigned Bike</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2.5 py-1 text-[10px] font-extrabold">
                            Offline {device.inactiveDays}d ({device.inactiveHours}h)
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-rose-400">
                          -{device.dailyRate} RWF <span className="text-[9px] text-zinc-500 font-normal">/day</span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-extrabold text-rose-300">
                          -{device.estimatedLossRwf.toLocaleString()} RWF
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {device.fleet?.adminPhone ? (
                              <a
                                href={`tel:${device.fleet.adminPhone}`}
                                className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all flex items-center gap-1"
                              >
                                <Phone size={11} /> Call Admin
                              </a>
                            ) : null}
                            <a
                              href="/hq/devices"
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/10 text-white border border-line hover:bg-white/15 transition-all"
                            >
                              Reassign Device
                            </a>
                          </div>
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">PAYG Fleets</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{paygCount}</p>
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
                  const dailyRate = getFleetDailyRate(fleet.type, fleet.emotoPaygRatePerActiveDay);
                  const estimatedMonthly = fleet._count.bikes * dailyRate * 30;
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
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={cx(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                fleet.plan === 'ENTERPRISE'
                                  ? 'bg-purple-500/15 text-purple-400'
                                  : fleet.plan === 'INSURANCE'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              )}>
                                {fleet.plan === 'ENTERPRISE'
                                  ? 'Enterprise'
                                  : fleet.plan === 'INSURANCE'
                                  ? 'Insurance Partner'
                                  : 'Pay-As-You-Go'}
                              </span>
                              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/5 text-zinc-400 border border-line">
                                {fleet.type === 'DELIVERY' ? 'Delivery (500 RWF/d)' : 'Coop/Indiv (350 RWF/d)'}
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
                          <p className="text-[9px] font-bold text-zinc-500 uppercase">Rate Model</p>
                          <p className="text-xs font-extrabold text-white mt-1">
                            {fleet.plan === 'INSURANCE'
                              ? 'Custom Quote'
                              : fleet.plan === 'ENTERPRISE'
                              ? 'Volume Discount'
                              : `${dailyRate} RWF / active day`}
                          </p>
                        </div>
                        <div className="rounded-xl border border-line bg-background/50 p-2.5">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase">Est. Monthly</p>
                          <p className="text-xs font-extrabold text-white mt-1">
                            {fleet.plan === 'INSURANCE'
                              ? 'Contact Sales'
                              : `${(estimatedMonthly).toLocaleString()} RWF`}
                          </p>
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
                  activeFleetDetails.plan === 'ENTERPRISE' 
                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-400' 
                    : activeFleetDetails.plan === 'INSURANCE'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                )}>
                  {activeFleetDetails.plan === 'ENTERPRISE' ? 'Enterprise Operations' : activeFleetDetails.plan === 'INSURANCE' ? 'Insurance Partner' : 'Pay-As-You-Go'}
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

              {activeFleetDetails.plan === 'PAYG' && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-[11px] text-emerald-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles size={13} /> Weekly Active-Days Billing ({getFleetDailyRate(activeFleetDetails.type, activeFleetDetails.emotoPaygRatePerActiveDay)} RWF/active day - {activeFleetDetails.type || 'COOP'})
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Weekly billing is automatically computed from actual bike GPS movement recorded during the 7-day cycle ({activeFleetDetails.type === 'DELIVERY' ? '500 RWF for Delivery' : '350 RWF for Coop/Individual'}). Parked/idle days are 0 RWF.
                  </p>
                </div>
              )}

              {cyclesLoading ? (
                <p className="text-xs text-zinc-550">Loading invoices...</p>
              ) : fleetCycles?.data.length === 0 ? (
                <p className="text-xs text-zinc-550">No invoices have been generated for this fleet.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {fleetCycles?.data.map((cycle) => (
                    <div key={cycle.id} className="rounded-xl border border-line bg-background/50 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
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
                        <div className="text-right">
                          <p className="font-bold text-white">{cycle.totalDue.toLocaleString()} RWF</p>
                          {cycle.totalPaid > 0 && <p className="text-[9px] text-emerald-400 font-semibold">Paid: {cycle.totalPaid.toLocaleString()}</p>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-line/40">
                        <button
                          onClick={() => setBreakdownCycleId(cycle.id)}
                          className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded font-bold text-[10px] text-white flex items-center gap-1 cursor-pointer transition-all"
                          title="View active-days breakdown & PDF statement"
                        >
                          <FileText size={10} /> Active-Days PDF Statement
                        </button>
                        {cycle.status !== 'PAID' && cycle.status !== 'VOID' && (cycle.totalDue - cycle.totalPaid) > 0 && (
                          <button
                            onClick={() => setShowRecordPayment(cycle)}
                            className="bg-accent px-2 py-1 rounded font-bold text-[10px] text-white cursor-pointer"
                          >
                            Pay Invoice
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fleet Operating Category Selection */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Fleet Operating Category</p>
                {updateFleetTypeMutation.isPending && <span className="text-[10px] text-accent font-bold animate-pulse">Updating...</span>}
              </div>
              <select
                value={activeFleetDetails.type || 'COOP'}
                onChange={(e) => {
                  updateFleetTypeMutation.mutate({
                    fleetId: activeFleetDetails.id,
                    type: e.target.value as 'COOP' | 'DELIVERY' | 'PERSONAL',
                  });
                }}
                className="h-9 w-full rounded-xl border border-line bg-background px-3 text-xs text-white cursor-pointer"
              >
                <option value="COOP">Cooperative Fleet (350 RWF / active day default)</option>
                <option value="PERSONAL">Individual Fleet (350 RWF / active day default)</option>
                <option value="DELIVERY">Delivery & Logistics Fleet (500 RWF / active day default)</option>
              </select>
            </div>

            {/* Edit Active Daily Rate Per Bike */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Edit Active Daily Rate Per Bike (RWF)</p>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {getFleetDailyRate(activeFleetDetails.type, activeFleetDetails.emotoPaygRatePerActiveDay)} RWF/day ({activeFleetDetails.type === 'DELIVERY' ? 'Delivery' : 'Coop/Individual'})
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Active daily collection rate charged per bike on days with GPS movement. Parked/idle days are 0 RWF.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  defaultValue={getFleetDailyRate(activeFleetDetails.type, activeFleetDetails.emotoPaygRatePerActiveDay)}
                  key={activeFleetDetails.id}
                  id={`rate-input-${activeFleetDetails.id}`}
                  placeholder={`Daily rate e.g. ${getFleetDailyRate(activeFleetDetails.type, activeFleetDetails.emotoPaygRatePerActiveDay)} RWF...`}
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
                  Save Active Rate
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
                    Approve Enterprise Upgrade
                  </button>
                )}

                {activeFleetDetails.plan !== 'INSURANCE' && (
                  <button
                    onClick={() => toggleInstallationPaidMutation.mutate(activeFleetDetails.id)}
                    className="w-full py-2.5 bg-white/5 border border-line text-zinc-400 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2"
                  >
                    <Check size={14} className={activeFleetDetails.installationPaid ? "text-emerald-400" : "text-zinc-500"} />
                    {activeFleetDetails.installationPaid
                      ? 'Setup Fee Paid (0 RWF Free Setup)'
                      : 'Mark Setup Fee Paid (0 RWF Hardware Setup)'}
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

      {/* INVOICE PDF & ACTIVE-DAYS BREAKDOWN MODAL */}
      {breakdownCycleId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface-strong border border-line rounded-3xl p-6 space-y-6 animate-scale-in">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Invoice Active-Days Breakdown Statement</h3>
                  <p className="text-xs text-zinc-400">e-Moto Fleet OS · Official Payment & Usage Statement</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl border border-line bg-white/10 text-xs font-bold text-white hover:bg-white/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} /> Print / Save PDF
                </button>
                <button onClick={() => setBreakdownCycleId(null)} aria-label="Close statement modal" className="p-1.5 text-zinc-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>

            {breakdownLoading ? (
              <p className="text-xs text-zinc-400 py-8 text-center">Loading active-day invoice breakdown...</p>
            ) : cycleBreakdownData ? (
              <div className="space-y-5 text-xs">
                {/* Notice Banner */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Sparkles size={16} /> Weekly Active-Days Billing ({cycleBreakdownData.cycle.ratePerBike} RWF/active day)
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Weekly billing is calculated strictly from actual bike GPS movement recorded during the 7-day cycle. Parked/idle days are 0 RWF.
                  </p>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-line bg-background p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Billing Period</p>
                    <p className="font-extrabold text-white mt-1">
                      {new Date(cycleBreakdownData.cycle.periodStart).toLocaleDateString()} - {new Date(cycleBreakdownData.cycle.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-background p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Active Bike-Days</p>
                    <p className="font-extrabold text-emerald-400 text-base mt-1">
                      {cycleBreakdownData.audit.totalActiveBikeDays} days
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-background p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total Invoice Due</p>
                    <p className="font-extrabold text-white text-base mt-1">
                      {cycleBreakdownData.cycle.totalDue.toLocaleString()} RWF
                    </p>
                  </div>
                </div>

                {/* Per-Bike Breakdown Table */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Per-Bike Active Days Audit Table</p>
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/5 text-zinc-400 font-bold border-b border-line">
                          <th className="py-2.5 px-3">Bike Label</th>
                          <th className="py-2.5 px-3">Plate</th>
                          <th className="py-2.5 px-3">Active Days</th>
                          <th className="py-2.5 px-3">Distance (km)</th>
                          <th className="py-2.5 px-3 text-right">Subtotal ({cycleBreakdownData.cycle.ratePerBike} RWF/day)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-zinc-300">
                        {cycleBreakdownData.audit.perBikeSummary.map((bike) => (
                          <tr key={bike.bikeId} className="hover:bg-white/[0.02]">
                            <td className="py-2 px-3 font-bold text-white">{bike.bikeLabel}</td>
                            <td className="py-2 px-3 text-zinc-400">{bike.bikePlate || 'Unregistered'}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-emerald-400">{bike.activeDays} days</span>
                            </td>
                            <td className="py-2 px-3 text-zinc-400">{bike.totalDistanceKm.toFixed(1)} km</td>
                            <td className="py-2 px-3 text-right font-bold text-white">
                              {bike.paygChargesRwf.toLocaleString()} RWF
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {cycleBreakdownData.notes && (
                  <p className="text-[11px] text-zinc-400 italic border-t border-line/50 pt-2">
                    Statement Note: {cycleBreakdownData.notes}
                  </p>
                )}
              </div>
            ) : null}
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
  "350 RWF / day per active bike. Pay only for bikes active on the road each day with full telemetry, remote lock/unlock, rider scoring, and financial management.",
  "Dedicated Insurer Portal, FNOL crash & theft evidence packs, automated risk analytics, and underwriter compliance monitoring.",
  "Tailored multi-fleet HQ command center, custom IoT integrations, dedicated account manager, and SLA guarantees.",
];

function PricingTierCard({ tier }: PricingTierCardProps) {
  const queryClient = useQueryClient();
  const [paygSubTier, setPaygSubTier] = useState<'COOP' | 'DELIVERY'>('COOP');

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

  const displayRate = tier.planCode === 'PAYG'
    ? (paygSubTier === 'DELIVERY' ? 500 : 350)
    : tier.monthlyRatePerBike;

  return (
    <div className="rounded-3xl border border-line bg-surface-strong/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{tier.name}</h3>
        <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-zinc-400">{tier.planCode}</span>
      </div>
      
      <p className="text-xs text-zinc-400 min-h-[40px]">{tier.description}</p>
      
      <div className="h-px bg-line w-full" />
      
      {tier.planCode === 'PAYG' && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-3 text-xs text-emerald-400">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> Active Daily Sub-Tier Rates</span>
          </div>

          {/* Sub-Tier Selector Buttons */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-background/80 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setPaygSubTier('COOP')}
              className={cx(
                "py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all",
                paygSubTier === 'COOP'
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Coop & Individual
            </button>
            <button
              type="button"
              onClick={() => setPaygSubTier('DELIVERY')}
              className={cx(
                "py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all",
                paygSubTier === 'DELIVERY'
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Delivery & Logistics
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={cx("p-2 rounded-xl border transition-all", paygSubTier === 'COOP' ? "bg-emerald-500/10 border-emerald-500/40" : "bg-background/60 border-line")}>
              <p className="text-zinc-400 font-bold">Coop & Individual</p>
              <p className="text-white font-extrabold text-sm mt-0.5">350 RWF <span className="text-[10px] text-zinc-400 font-normal">/ active day</span></p>
            </div>
            <div className={cx("p-2 rounded-xl border transition-all", paygSubTier === 'DELIVERY' ? "bg-emerald-500/10 border-emerald-500/40" : "bg-background/60 border-line")}>
              <p className="text-zinc-400 font-bold">Delivery & Logistics</p>
              <p className="text-white font-extrabold text-sm mt-0.5">500 RWF <span className="text-[10px] text-zinc-400 font-normal">/ active day</span></p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {tier.planCode === 'PAYG' ? "Daily Rate Per Active Bike (RWF)" : "Monthly Rate Per Bike (RWF)"}
          </label>
          <input
            type="number"
            id={`price-rate-${tier.planCode}`}
            key={`${tier.planCode}-${paygSubTier}`}
            defaultValue={displayRate}
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
            <option value="350 RWF / day per active bike (Coop/Indiv). Pay only for bikes active on the road each day with full telemetry, remote lock/unlock, rider scoring, and financial management.">Pay-As-You-Go Coop & Individual (350 RWF/day)</option>
            <option value="500 RWF / day per active bike (Delivery & Logistics). Pay only for bikes active on the road each day with full telemetry, remote lock/unlock, rider scoring, and financial management.">Pay-As-You-Go Delivery & Logistics (500 RWF/day)</option>
            <option value="Dedicated Insurer Portal, FNOL crash & theft evidence packs, automated risk analytics, and underwriter compliance monitoring.">Insurance description</option>
            <option value="Tailored multi-fleet HQ command center, custom IoT integrations, dedicated account manager, and SLA guarantees.">Enterprise description</option>
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
