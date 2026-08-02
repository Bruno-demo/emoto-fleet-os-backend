'use client';

import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  Key,
  Lock,
  Moon,
  Shield,
  Siren,
  Sun,
  User,
  UserPlus,
  Users,
  ChevronDown,
  X,
  Banknote,
  Trash,
  Copy,
  Check,
  Clock,
  FileText,
  Printer,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { getSubscriptionEntitlements } from '@/lib/subscription';
import { cx, formatEnumLabel, formatTimestamp } from '@/lib/ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';

interface BillingCycleData {
  id: string;
  cycleNumber: number;
  periodStart: string;
  periodEnd: string;
  totalDue: number;
  totalPaid: number;
  status: string;
  dueDate: string;
  bikeCount?: number;
  ratePerBike?: number;
  isTrial?: boolean;
  notes?: string | null;
}

interface PricingTier {
  id: string;
  name: string;
  planCode: string;
  monthlyRatePerBike: number;
  setupFeePerBike: number;
  description: string | null;
  isActive: boolean;
}

type SettingsTab = 'profile' | 'fleet' | 'team' | 'security' | 'notifications' | 'apiCredentials';

const ALL_TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'fleet', label: 'Fleet', icon: <Building2 size={15} /> },
  { id: 'team', label: 'Team', icon: <Users size={15} />, adminOnly: true },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'apiCredentials', label: 'API Credentials', icon: <Key size={15} />, adminOnly: true },
];

const DEFAULT_NOTIF_PREFS = {
  openIncidents: true,
  sosAlerts: true,
  crashEvents: true,
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const entitlements = getSubscriptionEntitlements(user);

  const { data: pricingTiers } = useQuery<PricingTier[]>({
    queryKey: ['billing', 'pricing-tiers'],
    queryFn: () => apiFetch<PricingTier[]>('/billing/pricing'),
  });

  const demoTier = pricingTiers?.find(t => t.planCode === 'DEMO');
  const premiumTier = pricingTiers?.find(t => t.planCode === 'PREMIUM');

  const coreMonthlyRate = demoTier?.monthlyRatePerBike ?? 10000;
  const coreSetupFee = demoTier?.setupFeePerBike ?? 0;
  const premiumMonthlyRate = premiumTier?.monthlyRatePerBike ?? 15000;
  const premiumSetupFee = premiumTier?.setupFeePerBike ?? 0;
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam && ['profile', 'fleet', 'team', 'security', 'notifications', 'apiCredentials'].includes(tabParam))
    ? (tabParam as SettingsTab)
    : 'profile';

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (tabParam && ['profile', 'fleet', 'team', 'security', 'notifications', 'apiCredentials'].includes(tabParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(tabParam as SettingsTab);
    }
  }, [tabParam]);

  const { setTheme, resolvedTheme } = useTheme();

  const [showContactSales, setShowContactSales] = useState(false);
  const [salesFormSubmitted, setSalesFormSubmitted] = useState(false);
  const [salesSending, setSalesSending] = useState(false);

  // API Credentials states
  const partnerKeysQuery = useQuery({
    queryKey: ['partner-keys'],
    queryFn: () => apiFetch<{ clientId: string; scopes: string[] }>('/auth/partner-keys'),
    enabled: !!user && user.fleetPlan === 'INSURANCE',
  });
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);
  const [rotateKeysError, setRotateKeysError] = useState<string | null>(null);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedClientSecret, setCopiedClientSecret] = useState(false);

  const handleRotateKeys = async () => {
    if (!confirm(t('Are you sure you want to rotate your partner API keys? Any existing integrations using the old secret will break immediately.'))) {
      return;
    }
    setIsRotatingKeys(true);
    setRotateKeysError(null);
    setRotatedSecret(null);
    try {
      const res = await apiFetch<{ clientSecret: string }>('/auth/partner-keys/rotate', {
        method: 'POST',
      });
      setRotatedSecret(res.clientSecret);
      await queryClient.invalidateQueries({ queryKey: ['partner-keys'] });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setRotateKeysError(error.message);
      } else {
        setRotateKeysError(t('Failed to rotate API credentials'));
      }
    } finally {
      setIsRotatingKeys(false);
    }
  };

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'settings-count'],
    queryFn: () => apiFetch<{ total: number }>('/bikes?page=1&pageSize=1'),
  });
  const totalBikes = bikesQuery.data?.total ?? 0;

  const myCyclesQuery = useQuery({
    queryKey: ['billing', 'my-cycles'],
    queryFn: () => apiFetch<{ data: BillingCycleData[] }>('/billing/my-cycles?limit=50'),
    enabled: !!user && user.fleetType === 'COOP',
  });

  // Notification preferences derived from server state
  const notifPrefs = {
    openIncidents: user?.notifOpenIncidents ?? DEFAULT_NOTIF_PREFS.openIncidents,
    sosAlerts: user?.notifSosAlerts ?? DEFAULT_NOTIF_PREFS.sosAlerts,
    crashEvents: user?.notifCrashEvents ?? DEFAULT_NOTIF_PREFS.crashEvents,
  };
  const [savingNotifPref, setSavingNotifPref] = useState(false);

  const [useLocalTimezone, setUseLocalTimezone] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const tz = localStorage.getItem('emoto-use-local-tz');
      return tz === null ? true : tz === 'true';
    } catch {
      return true;
    }
  });

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<BillingCycleData | null>(null);

  // MoMo & Subscription state declarations
  const { data: currentSubscription, refetch: refetchSub } = useQuery<{
    subscription: {
      id: string;
      fleetId: string;
      planId: string;
      startDate: string;
      endDate: string;
      autoRenew: boolean;
      momoPhoneNumber: string | null;
      isActive: boolean;
      plan: { label: string; discountPercent: number };
    } | null;
  }>({
    queryKey: ['billing', 'my-subscription'],
    queryFn: () => apiFetch('/billing/my-subscription'),
    enabled: !!user,
  });

  const { data: momoTransactions, refetch: refetchMomoTx } = useQuery<{
    data: Array<{
      id: string;
      referenceId: string;
      amount: number;
      currency: string;
      payerPhone: string;
      status: string;
      financialTransactionId: string | null;
      failureReason: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ['billing', 'my-transactions'],
    queryFn: () => apiFetch('/billing/my-transactions'),
    enabled: !!user,
  });

  const [selectedPlanDuration, setSelectedPlanDuration] = useState<string>('ANNUAL');
  const [momoPhoneInput, setMomoPhoneInput] = useState<string>('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState<string | null>(null);

  // Pay Now Modal state
  const [payNowCycle, setPayNowCycle] = useState<BillingCycleData | null>(null);
  const [payNowPhone, setPayNowPhone] = useState<string>('');
  const [payingNow, setPayingNow] = useState(false);
  const [payNowSuccessMsg, setPayNowSuccessMsg] = useState<string | null>(null);
  const [payNowErrorMsg, setPayNowErrorMsg] = useState<string | null>(null);

  const updateNotifPref = async (key: keyof typeof notifPrefs) => {
    if (savingNotifPref) return;
    setSavingNotifPref(true);
    try {
      const next = { ...notifPrefs, [key]: !notifPrefs[key] };
      await apiFetch('/me/notifications', {
        method: 'PUT',
        body: JSON.stringify(next),
        headers: { 'Content-Type': 'application/json' },
      });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    } catch {
      // Silently handle – the toggle will revert on next re-render from server state
    } finally {
      setSavingNotifPref(false);
    }
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex overflow-x-auto dashboard-scrollbar gap-1 rounded-2xl border border-line bg-surface-muted p-1 whitespace-nowrap">
        {ALL_TABS
          .filter(tab => {
            if (tab.id === 'apiCredentials' && user?.role === 'INSURER') {
              return true;
            }
            return !tab.adminOnly || (user && (user.role === 'ADMIN' || user.role === 'OWNER'));
          })
          .filter(tab => tab.id !== 'apiCredentials' || (user && user.fleetPlan === 'INSURANCE'))
          .map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shrink-0',
              activeTab === tab.id
                ? 'bg-surface-strong text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-surface-hover',
            )}
          >
            {tab.icon}
            <span>{t(tab.label)}</span>
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow={t("Account")} title={t("Profile information")}>
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent text-2xl font-bold">
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {user?.email ?? t('Unknown user')}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {user?.role ? t(formatEnumLabel(user.role)) : t('Operator')} &middot;{' '}
                    {user?.status ? t(formatEnumLabel(user.status)) : t('Active')}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField label={t("Email")} value={user?.email ?? t('Not set')} />
                <SettingsField label={t("Phone")} value={user?.phone ?? t('Not set')} />
                <SettingsField
                  label={t("Role")}
                  value={user?.role ? t(formatEnumLabel(user.role)) : t('Unknown')}
                />
                <SettingsField
                  label={t("Status")}
                  value={user?.status ? t(formatEnumLabel(user.status)) : t('Unknown')}
                />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard eyebrow={t("Preferences")} title={t("Display settings")}>
            <div className="space-y-4">
              <SettingsToggle
                icon={isDark ? <Moon size={15} /> : <Sun size={15} />}
                label={t("Dark mode")}
                description={isDark ? t('Using the dark interface theme') : t('Using the light interface theme')}
                checked={isDark}
                onChange={() => setTheme(isDark ? 'light' : 'dark')}
              />
              <SettingsToggle
                icon={<Globe size={15} />}
                label={t("Timezone")}
                description={
                  useLocalTimezone
                    ? t("Dates display in your browser's local timezone")
                    : t("Dates display in Coordinated Universal Time (UTC)")
                }
                checked={useLocalTimezone}
                onChange={() => {
                  setUseLocalTimezone((v) => {
                    const next = !v;
                    localStorage.setItem('emoto-use-local-tz', String(next));
                    window.dispatchEvent(new Event('storage'));
                    return next;
                  });
                }}
              />
              <div className="rounded-xl border border-line bg-surface-muted p-3 text-xs flex items-center justify-between shadow-xs">
                <span className="text-ink-soft flex items-center gap-1.5 font-medium">
                  <Clock size={14} className="text-accent" />
                  {t("Active System Time")}
                </span>
                <span className="font-mono font-bold text-ink bg-surface px-2.5 py-1 rounded-lg border border-line">
                  {formatTimestamp(currentTime)}
                </span>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Fleet */}
      {activeTab === 'fleet' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow={t("Organization")} title={t("Fleet details")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField label={t("Fleet ID")} value={user?.fleetId ?? t('Unknown')} mono />
              <SettingsField
                label={t("Fleet name")}
                value={user?.fleetName ?? t('Unnamed fleet')}
              />
              <SettingsField
                label={t("Plan")}
                value={t(entitlements.planLabel)}
              />
              <SettingsField
                label={t("Subscription")}
                value={t(entitlements.statusLabel)}
              />
            </div>
          </DashboardCard>

          <DashboardCard
            id="billing"
            eyebrow={t("Billing")}
            title={t("Billing & Subscription Summary")}
            description={t("Operational billing overview based on your active fleet size and plan.")}
          >
            {(() => {
              const rate = user?.monthlyRatePerBike ?? (user?.fleetPlan === 'PREMIUM' ? premiumMonthlyRate : user?.fleetPlan === 'INSURANCE' ? 0 : coreMonthlyRate);
              const isInsurance = user?.fleetPlan === 'INSURANCE';
              return (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                    {/* Stat 1: Fleet Size */}
                    <div className="rounded-2xl border border-line bg-surface-muted p-5 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                        {isInsurance ? t('Total Covered Bikes') : t('Total Fleet Bikes')}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-ink">{totalBikes}</span>
                        <span className="text-xs text-ink-muted">{totalBikes === 1 ? t('Active bike') : t('Active bikes')}</span>
                      </div>
                      <p className="text-xs text-ink-faint leading-relaxed">
                        {isInsurance
                          ? t('Bikes covered under your insurance policy.')
                          : t('Subscriptions are calculated per bike dynamically.')}
                      </p>
                    </div>

                    {/* Stat 2: Active Plan Cost */}
                    <div className="rounded-2xl border border-line bg-surface-muted p-5 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('Monthly Rate')}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-ink">
                          {rate.toLocaleString()} RWF
                        </span>
                        <span className="text-xs text-ink-muted">{t('/ bike / mo')}</span>
                      </div>
                      <p className="text-xs text-ink-faint leading-relaxed">
                        {t('Plan:')} <span className="font-bold text-accent">{t(entitlements.planLabel)}</span>
                      </p>
                    </div>

                    {/* Stat 3: Total Money To Pay */}
                    <div className="rounded-2xl border border-accent/25 bg-accent/[0.03] p-5 space-y-2 col-span-full md:col-span-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{t('Total Monthly Cost')}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-accent">
                          {(rate * totalBikes).toLocaleString()} RWF
                        </span>
                        <span className="text-xs text-ink-muted">{t('/ month')}</span>
                      </div>
                      <p className="text-xs text-ink-faint leading-relaxed">
                        {t('Auto-calculated subscription dues.')}
                      </p>
                    </div>
                  </div>

                  {/* Installation Setup Fee & Hardware Policy Info */}
                  {!isInsurance && (
                    <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-ink flex items-center gap-2">
                          <Banknote size={16} className="text-accent" />
                          {t('Device Setup & Hardware Policy')}
                        </p>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {t('Device Setup Fee:')} <strong className="text-emerald-400">0 RWF</strong>. {t('GPS hardware devices are not client property — they remain the exclusive company property of eMoto Fleet OS and are provided for fleet management.')}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xs text-ink-muted">{t('Setup Dues')}</p>
                        <p className="text-lg font-extrabold text-emerald-400">0 RWF</p>
                      </div>
                    </div>
                  )}

                  {/* Pending Alert if subscription is pending */}
                  {user?.subscriptionStatus === 'PENDING_UPGRADE' && (
                    <div className="mt-6 rounded-2xl border border-warning-ink/20 bg-warning-soft/20 p-5 flex gap-4 items-start animate-pulse">
                      <AlertTriangle className="text-warning-ink shrink-0 mt-0.5" size={20} />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-warning-ink">{t('Plan Upgrade Pending Approval')}</p>
                        <p className="text-xs text-ink-soft leading-relaxed">
                          {t('You have requested to upgrade to')} <strong className="font-semibold text-warning-ink">{t('Delivery Fleet Plan')}</strong>. {t('Your monthly rate will remain')} <strong className="font-semibold text-ink">{coreMonthlyRate.toLocaleString()} RWF</strong> {t('until your payment setup is confirmed and approved by the HQ admin.')}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </DashboardCard>

          <DashboardCard
            eyebrow={t("History")}
            title={t("Billing History")}
            description={t("View your recent invoices and payment history.")}
          >
            {myCyclesQuery.isLoading ? (
              <p className="text-xs text-ink-muted">{t("Loading billing history...")}</p>
            ) : !myCyclesQuery.data?.data || myCyclesQuery.data.data.length === 0 ? (
              <p className="text-xs text-ink-muted">{t("No invoices found for your fleet.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-ink-muted font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">{t("Invoice")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Billing Period")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Amount Due")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Amount Paid")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Status")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Due Date")}</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">{t("Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink-soft">
                    {myCyclesQuery.data.data.map((cycle: BillingCycleData) => (
                      <tr key={cycle.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">{t("Invoice #{number}").replace('{number}', String(cycle.cycleNumber))}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {new Date(cycle.periodStart).toLocaleDateString()} - {new Date(cycle.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">
                          {cycle.totalDue.toLocaleString()} RWF
                        </td>
                        <td className="py-3 px-4 text-success-ink font-semibold whitespace-nowrap">
                          {cycle.totalPaid.toLocaleString()} RWF
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            cycle.status === 'PAID'
                              ? 'border-success-ink/20 bg-success-soft/10 text-success-ink'
                              : cycle.status === 'OVERDUE'
                              ? 'border-error-ink/20 bg-error-soft/10 text-error-ink'
                              : 'border-warning-ink/20 bg-warning-soft/10 text-warning-ink'
                          )}>
                            {t(cycle.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {new Date(cycle.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {cycle.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayNowCycle(cycle);
                                  setPayNowPhone(currentSubscription?.subscription?.momoPhoneNumber || '');
                                  setPayNowSuccessMsg(null);
                                  setPayNowErrorMsg(null);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-accent bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/20 transition cursor-pointer"
                              >
                                <Banknote size={12} />
                                {t("Pay with MoMo")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceModal(cycle)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-hover transition cursor-pointer"
                            >
                              <FileText size={12} className="text-accent" />
                              {t("View / Print")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>

          {/* MoMo Automated Subscriptions Card */}
          <DashboardCard
            eyebrow={t("MTN Mobile Money")}
            title={t("Automated Subscription Plans")}
            description={t("Choose a subscription plan duration to unlock discounts and set up automated MoMo auto-pay.")}
          >
            <div className="space-y-6">
              {/* Active Subscription Status Banner */}
              {currentSubscription?.subscription ? (
                <div className="rounded-2xl border border-success-ink/20 bg-success-soft/10 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-success-ink uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      {t("Active Subscription Plan:")} {currentSubscription.subscription.plan.label} ({currentSubscription.subscription.plan.discountPercent}% {t("Discount")})
                    </p>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {t("Auto-Renew:")} <strong className="text-ink">{currentSubscription.subscription.autoRenew ? t("Enabled") : t("Disabled (Expires Soon)")}</strong>
                      {' • '}
                      {t("Renews/Expires on:")} <span className="font-medium text-ink">{new Date(currentSubscription.subscription.endDate).toLocaleDateString()}</span>
                    </p>
                    {currentSubscription.subscription.momoPhoneNumber && (
                      <p className="text-xs text-ink-muted">
                        {t("Auto-Pay Phone:")} <span className="font-mono font-bold text-ink">{currentSubscription.subscription.momoPhoneNumber}</span>
                      </p>
                    )}
                  </div>
                  {currentSubscription.subscription.autoRenew && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(t("Are you sure you want to cancel auto-renewal? Your subscription will expire at the end of the current term."))) return;
                        try {
                          await apiFetch('/billing/subscription/cancel', { method: 'PUT' });
                          refetchSub();
                          queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
                        } catch (err: unknown) {
                          alert(err instanceof Error ? err.message : t("Failed to cancel subscription"));
                        }
                      }}
                      className="rounded-xl border border-error-ink/30 bg-error-soft/10 px-3.5 py-2 text-xs font-bold text-error-ink hover:bg-error-soft/20 transition cursor-pointer"
                    >
                      {t("Cancel Auto-Renew")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-surface-muted p-4 text-xs text-ink-muted">
                  {t("No active long-term plan subscription. Subscribe below to save up to 20% on monthly rates.")}
                </div>
              )}

              {/* Plan Selection Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { duration: 'MONTHLY', months: 1, label: t('Monthly'), discount: 0 },
                  { duration: 'QUARTERLY', months: 3, label: t('3 Months'), discount: 5 },
                  { duration: 'SEMI_ANNUAL', months: 6, label: t('6 Months'), discount: 10 },
                  { duration: 'ANNUAL', months: 12, label: t('1 Year'), discount: 15 },
                  { duration: 'BIENNIAL', months: 24, label: t('2 Years'), discount: 20 },
                ].map((plan) => {
                  const rate = user?.monthlyRatePerBike ?? 10000;
                  const discountedRate = Math.round(rate * (1 - plan.discount / 100));
                  const isSelected = selectedPlanDuration === plan.duration;

                  return (
                    <div
                      key={plan.duration}
                      onClick={() => setSelectedPlanDuration(plan.duration)}
                      className={cx(
                        'rounded-2xl border p-4 space-y-3 cursor-pointer transition-all duration-200 relative flex flex-col justify-between',
                        isSelected
                          ? 'border-accent bg-accent/[0.04] ring-2 ring-accent'
                          : 'border-line bg-surface-muted hover:border-ink-muted'
                      )}
                    >
                      {plan.discount > 0 && (
                        <span className="absolute -top-2.5 right-3 bg-accent text-white font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                          {t("Save {percent}%").replace('{percent}', String(plan.discount))}
                        </span>
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-ink">{plan.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-ink">{discountedRate.toLocaleString()}</span>
                          <span className="text-[10px] text-ink-muted">RWF/bike/mo</span>
                        </div>
                        {plan.discount > 0 && (
                          <p className="text-[10px] text-ink-faint line-through">
                            {rate.toLocaleString()} RWF
                          </p>
                        )}
                      </div>
                      <div className="pt-2 border-t border-line/50 text-[10px] text-ink-muted">
                        {plan.months > 1 ? t("{months} months term").replace('{months}', String(plan.months)) : t("Billed monthly")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MoMo Phone Input & Subscribe Action */}
              <div className="rounded-2xl border border-line bg-surface-muted p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-ink flex items-center gap-2">
                      <CreditCard size={16} className="text-accent" />
                      {t("MTN Mobile Money Payment Setup")}
                    </p>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      {t("Enter your MTN Rwanda MoMo number. Automatic payment prompts will be sent 2 days before invoice due dates.")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="tel"
                    placeholder="0781234567"
                    value={momoPhoneInput}
                    onChange={(e) => setMomoPhoneInput(e.target.value)}
                    className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-mono text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    disabled={subscribing || !momoPhoneInput}
                    onClick={async () => {
                      setSubscribing(true);
                      setSubscribeError(null);
                      setSubscribeSuccess(null);
                      try {
                        await apiFetch('/billing/subscribe', {
                          method: 'POST',
                          body: JSON.stringify({
                            planDuration: selectedPlanDuration,
                            momoPhoneNumber: momoPhoneInput,
                          }),
                        });
                        setSubscribeSuccess(
                          t("Subscribed successfully to {plan} plan with MoMo auto-pay on {phone}!").replace(
                            '{plan}', selectedPlanDuration
                          ).replace('{phone}', momoPhoneInput)
                        );
                        refetchSub();
                        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
                      } catch (err: unknown) {
                        setSubscribeError(err instanceof Error ? err.message : t("Failed to subscribe"));
                      } finally {
                        setSubscribing(false);
                      }
                    }}
                    className="rounded-xl border border-accent bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {subscribing ? t("Saving...") : t("Save & Subscribe")}
                  </button>
                </div>

                {subscribeSuccess && (
                  <p className="text-xs font-bold text-success-ink flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    {subscribeSuccess}
                  </p>
                )}
                {subscribeError && (
                  <p className="text-xs font-bold text-error-ink flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    {subscribeError}
                  </p>
                )}
              </div>
            </div>
          </DashboardCard>

          {/* MoMo Transactions History Table */}
          <DashboardCard
            eyebrow={t("MoMo Logs")}
            title={t("Mobile Money Transactions")}
            description={t("Log of all MTN MoMo push payment attempts for this fleet.")}
          >
            {!momoTransactions?.data || momoTransactions.data.length === 0 ? (
              <p className="text-xs text-ink-muted">{t("No Mobile Money transactions recorded yet.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-ink-muted font-bold uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">{t("Reference")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Payer Phone")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Amount")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Status")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("MTN Tx ID")}</th>
                      <th className="py-3 px-4 whitespace-nowrap">{t("Date")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink-soft">
                    {momoTransactions.data.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-mono text-[11px] text-ink whitespace-nowrap">{tx.referenceId.slice(0, 8)}...</td>
                        <td className="py-3 px-4 font-mono whitespace-nowrap">{tx.payerPhone}</td>
                        <td className="py-3 px-4 font-bold text-ink whitespace-nowrap">{tx.amount.toLocaleString()} RWF</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            tx.status === 'SUCCESSFUL'
                              ? 'border-success-ink/20 bg-success-soft/10 text-success-ink'
                              : tx.status === 'FAILED'
                              ? 'border-error-ink/20 bg-error-soft/10 text-error-ink'
                              : 'border-warning-ink/20 bg-warning-soft/10 text-warning-ink'
                          )}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">{tx.financialTransactionId || '-'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>

          <DashboardCard
            eyebrow={t("Subscription")}
            title={t("Compare Plans")}
            description={t("View and compare the different service levels available for E-Moto Fleet OS.")}
          >
            {user?.fleetPlan === 'INSURANCE' ? (
              <div className="grid gap-6 md:grid-cols-1 max-w-xl">
                {/* Insurance Active Card */}
                <div className="rounded-[20px] border border-accent bg-accent/[0.05] p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ring-1 ring-accent">
                  <div className="absolute top-0 right-0 bg-accent text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    {t("Active Plan")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-accent" />
                      <p className="text-sm font-bold text-ink">{t("Insurance Partner Plan")}</p>
                    </div>
                    <div className="mt-4 flex flex-col items-start gap-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-ink">{t("Active Partnership")}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                      {t("Dedicated portal for insurance providers. Provides read-only access to insured fleet telemetry, crash evidence validation, and partner API integration keys.")}
                    </p>
                    
                    <div className="h-px w-full bg-line my-4" />
                    
                    <ul className="space-y-2.5 text-xs text-ink-soft">
                      {['Insured Fleet Telemetry Portal', 'Partner API & Access Token Keys', 'Dedicated Insurance SLA & Support', 'Automated Crash Evidence Packs', 'Weekly Risk Summary Analytics'].map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                          <span>{t(f)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
               <div className="grid gap-6 md:grid-cols-3">
                 {/* Safety Core Card */}
                 <div
                   className={cx(
                     'rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden',
                     !entitlements.isPremium && entitlements.isActive
                       ? 'border-success-ink/20 bg-success-soft/10 ring-1 ring-success-ink/25 shadow-lg shadow-success-soft/5'
                       : 'border-line bg-surface-muted/50 hover:bg-surface-muted hover:border-line-strong'
                   )}
                 >
                   {!entitlements.isPremium && entitlements.isActive && (
                     <div className="absolute top-0 right-0 bg-success-ink text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                       {t("Active Plan")}
                     </div>
                   )}
                   <div>
                     <div className="flex items-center gap-2">
                       <CheckCircle2 size={16} className={!entitlements.isPremium && entitlements.isActive ? "text-accent" : "text-ink-muted"} />
                       <p className="text-sm font-bold text-ink">{t("Safety Core")}</p>
                     </div>
                     <div className="mt-4 flex flex-col items-start gap-1">
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-extrabold text-ink">{coreMonthlyRate.toLocaleString()} RWF</span>
                         <span className="text-xs text-ink-muted">{t("/ bike / month")}</span>
                       </div>
                       <span className="text-[10px] font-bold text-success-ink">{t("+ {fee} RWF device setup & install").replace('{fee}', coreSetupFee.toLocaleString())}</span>
                     </div>
                     <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                       {t("Essential telemetry, safety event detection, and manual incident response tools.")}
                     </p>
                     
                     <div className="h-px w-full bg-line my-4" />
                     
                     <ul className="space-y-2.5 text-xs text-ink-soft">
                       {['Overview Dashboard', 'Live Map Tracking', 'Incident Escalation', 'Risk Events Feed', 'Bikes & Riders Directory', 'Fleet Configuration'].map((f) => (
                         <li key={f} className="flex items-start gap-2">
                           <CheckCircle2 size={12} className="text-success-ink shrink-0 mt-0.5" />
                           <span>{t(f)}</span>
                         </li>
                       ))}
                       {['Device provisioning', 'Policy geofencing', 'Remote commands', 'Audit logs'].map((f) => (
                         <li key={f} className="flex items-start gap-2 opacity-50">
                           <Lock size={10} className="text-ink-faint shrink-0 mt-0.5" />
                           <span className="line-through">{t(f)}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                   
                   <div className="mt-6">
                     {!entitlements.isPremium && entitlements.isActive ? (
                       <button
                         type="button"
                         disabled
                         className="w-full text-center rounded-xl bg-success-soft text-success-ink border border-success-ink/20 py-2 text-xs font-bold"
                       >
                         {t("Active Plan")}
                       </button>
                     ) : (
                       <button
                         type="button"
                         disabled
                         className="w-full text-center rounded-xl border border-line bg-surface-muted text-ink-muted py-2 text-xs font-semibold"
                       >
                         {t("Included in higher tier")}
                       </button>
                     )}
                   </div>
                 </div>

                 {/* Operations Plus Card */}
                 <div
                   className={cx(
                     'rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden',
                     entitlements.isPremium && entitlements.isActive
                       ? 'border-success-ink/20 bg-success-soft/10 ring-1 ring-success-ink/25 shadow-lg shadow-success-soft/5'
                       : 'border-line bg-surface-muted/50 hover:bg-surface-muted hover:border-line-strong'
                   )}
                 >
                   {entitlements.isPremium && entitlements.isActive && (
                     <div className="absolute top-0 right-0 bg-success-ink text-white font-bold text-[9px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                       {t("Active Plan")}
                     </div>
                   )}
                   <div>
                     <div className="flex items-center gap-2">
                       <CheckCircle2 size={16} className={entitlements.isPremium && entitlements.isActive ? "text-accent" : "text-ink-muted"} />
                       <p className="text-sm font-bold text-ink">{t("Operations Plus")}</p>
                     </div>
                     <div className="mt-4 flex flex-col items-start gap-1">
                       <div className="flex items-baseline gap-1">
                         <span className="text-2xl font-extrabold text-ink">{premiumMonthlyRate.toLocaleString()} RWF</span>
                         <span className="text-xs text-ink-muted">{t("/ bike / month")}</span>
                       </div>
                       <span className="text-[10px] font-bold text-accent">{t("+ {fee} RWF device setup & install").replace('{fee}', premiumSetupFee.toLocaleString())}</span>
                     </div>
                     <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                       {t("Unlocks device configuration, strict geofence speed caps, trip analytics, and remote commands.")}
                     </p>
                     
                     <div className="h-px w-full bg-line my-4" />
                     
                     <ul className="space-y-2.5 text-xs text-ink-soft">
                       <li className="flex items-start gap-2 text-accent font-semibold">
                         <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                         <span>{t("Everything in Safety Core")}</span>
                       </li>
                       {[
                         'Device Provisioning (SIMs/Hardware)',
                         'Policy Geofencing (Speed/Parking)',
                         'Trip Analytics & Reports',
                         'Immutable Compliance Audit Logs',
                         'Remote Commands (Lock/Unlock/Sound)',
                         'Incident Evidence Packs'
                       ].map((f) => (
                         <li key={f} className="flex items-start gap-2">
                           <CheckCircle2 size={12} className="text-accent shrink-0 mt-0.5" />
                           <span>{t(f)}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                   
                   <div className="mt-6">
                     {entitlements.isPremium && entitlements.isActive ? (
                       <button
                         type="button"
                         disabled
                         className="w-full text-center rounded-xl bg-success-soft text-success-ink border border-success-ink/20 py-2 text-xs font-bold"
                       >
                         {t("Active Plan")}
                       </button>
                     ) : (
                       <Link
                         href="/checkout?plan=operations-plus"
                         className="block w-full text-center rounded-xl bg-accent hover:bg-accent-strong text-white py-2 text-xs font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-[1.02]"
                       >
                         {t("Upgrade Plan")}
                       </Link>
                     )}
                   </div>
                 </div>

                 {/* Enterprise Fleet Card */}
                 <div className="rounded-[20px] border border-line bg-surface-muted/50 hover:bg-surface-muted hover:border-line-strong p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden">
                   <div>
                     <div className="flex items-center gap-2">
                       <CheckCircle2 size={16} className="text-ink-muted" />
                       <p className="text-sm font-bold text-ink">{t("Enterprise Fleet")}</p>
                     </div>
                     <div className="mt-4 flex items-baseline gap-1">
                       <span className="text-2xl font-extrabold text-ink">{t("Custom")}</span>
                       <span className="text-xs text-ink-muted">{t("for >50 bikes")}</span>
                     </div>
                     <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                       {t("Custom quotes, dedicated support, and volume discounts for fleet operators with more than 50 bikes.")}
                     </p>
                     
                     <div className="h-px w-full bg-line my-4" />
                     
                     <ul className="space-y-2.5 text-xs text-ink-soft">
                       <li className="flex items-start gap-2 font-semibold">
                         <CheckCircle2 size={12} className="text-ink-muted shrink-0 mt-0.5" />
                         <span>{t("Everything in Operations Plus")}</span>
                       </li>
                       {[
                         'Volume Discounts for Large Fleets',
                         'Dedicated Customer Support Manager',
                         '99.9% Uptime Guarantee SLA',
                         'Custom Integrations & Development',
                         'Priority Hardware Provisioning'
                       ].map((f) => (
                         <li key={f} className="flex items-start gap-2">
                           <CheckCircle2 size={12} className="text-success-ink shrink-0 mt-0.5" />
                           <span>{t(f)}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                   
                   <div className="mt-6">
                     <button
                       type="button"
                       onClick={() => setShowContactSales(true)}
                       className="w-full text-center rounded-xl border border-line bg-surface hover:bg-surface-hover text-ink py-2 text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer"
                     >
                       {t("Request Quote")}
                     </button>
                   </div>
                 </div>
               </div>
            )}
          </DashboardCard>
        </div>
      )}

      {/* Team */}
      {activeTab === 'team' && user && (user.role === 'ADMIN' || user.role === 'OWNER') && (
        <TeamTab currentUser={user} />
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow={t("Authentication")} title={t("Security settings")}>
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success-ink">
                  <Lock size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{t("Password")}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('Password management is handled through the authentication system. Use the "Forgot password" flow to reset your credentials.')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Key size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{t("Session")}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('Your session is secured with an httpOnly cookie. Sessions expire after inactivity. Account locks after 5 failed login attempts.')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning-ink">
                  <Shield size={16} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{t("Role-based access")}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('Your role ({role}) determines which actions and data you can access. Contact an admin to change your role.').replace('{role}', user?.role ? t(formatEnumLabel(user.role)) : t('Operator'))}
                  </p>
                </div>
              </div>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard eyebrow={t("Alerts")} title={t("Notification preferences")}>
            <div className="space-y-4">
              <SettingsToggle
                icon={<Siren size={15} />}
                label={t("Open incidents")}
                description={t("Show incident count badge in the sidebar and topbar")}
                checked={notifPrefs.openIncidents}
                disabled={savingNotifPref}
                onChange={() => updateNotifPref('openIncidents')}
              />
              <SettingsToggle
                icon={<Bell size={15} />}
                label={t("SOS alerts")}
                description={t("Real-time notification when a rider triggers SOS")}
                checked={notifPrefs.sosAlerts}
                disabled={savingNotifPref}
                onChange={() => updateNotifPref('sosAlerts')}
              />
              <SettingsToggle
                icon={<AlertTriangle size={15} />}
                label={t("Crash events")}
                description={t("Immediate notification for crash detection events")}
                checked={notifPrefs.crashEvents}
                disabled={savingNotifPref}
                onChange={() => updateNotifPref('crashEvents')}
              />
            </div>
            <p className="mt-4 text-xs text-ink-faint flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500 shrink-0" />
              {t("Notification preferences are synced to your account and apply across all your sessions.")}
            </p>
          </DashboardCard>
        </div>
      )}

      {/* Contact Sales Modal */}
      {showContactSales && (
        <div 
          onClick={() => {
            setShowContactSales(false);
            setSalesFormSubmitted(false);
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-white/[0.06] bg-[var(--background-subtle)] p-6 sm:p-8 space-y-5 shadow-2xl relative overflow-y-auto max-h-[90vh] md:max-h-[85vh] animate-fade-in text-ink"
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowContactSales(false);
                setSalesFormSubmitted(false);
              }}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors p-1"
            >
              <X size={20} />
            </button>

            {salesFormSubmitted ? (
              <div className="text-center space-y-6 py-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft/20 border border-success-ink/30 text-success-ink">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-ink">{t("Inquiry Submitted!")}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    {t('Thank you for contacting sales. Our team has received your inquiry for the {plan} and will get back to you within 2 hours.')
                      .split('{plan}')
                      .map((part, i) => i === 0 ? part : <React.Fragment key={i}><strong className="text-accent font-semibold">{t('Enterprise Plan')}</strong>{part}</React.Fragment>)}
                  </p>
                </div>
                <button
                  onClick={() => setShowContactSales(false)}
                  className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all"
                  style={{ background: '#3B82F6', color: 'white' }}
                >
                  {t("Return to Settings")}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">{t("Enterprise Plan")}</p>
                  <h3 className="text-2xl font-extrabold text-ink">{t("Contact Sales Representative")}</h3>
                  <p className="text-xs text-ink-muted">
                    {t("Reach out to our specialized enterprise sales team for customized volume pricing, API access keys, or SLA support contracts.")}
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSalesSending(true);
                    setTimeout(() => {
                      setSalesSending(false);
                      setSalesFormSubmitted(true);
                    }, 1200);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">{t("Fleet Name")}</label>
                    <input
                      type="text"
                      required
                      defaultValue={user?.fleetName ?? ''}
                      placeholder={t("Enter fleet name...")}
                      className="w-full h-11 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">{t("Email Address")}</label>
                    <input
                      type="email"
                      required
                      defaultValue={user?.email ?? ''}
                      placeholder={t("Enter business email...")}
                      className="w-full h-11 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">{t("Message")}</label>
                    <textarea
                      required
                      rows={3}
                      placeholder={t("How can we help your fleet operations? (e.g. volume discount pricing for 200+ bikes...)")}
                      className="w-full rounded-xl border border-line bg-surface p-4 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <a
                      href="mailto:sales@emotofleet.com?subject=Enterprise%20Plan%20Inquiry"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line hover:bg-surface-hover text-xs font-bold py-3.5 transition-all"
                    >
                      {t("Email Direct")}
                    </a>
                    <button
                      type="submit"
                      disabled={salesSending}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: '#3B82F6', color: 'white' }}
                    >
                      {salesSending ? t('Sending Request...') : t('Send Inquiry')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* API Credentials */}
      {activeTab === 'apiCredentials' && user && user.fleetPlan === 'INSURANCE' && (
        <div className="space-y-5 animate-fade-in">
          <DashboardCard
            eyebrow={t("Integration")}
            title={t("Partner API Credentials")}
            description={t("Use these credentials to access the E-Moto Fleet OS Partner API. Scopes are read-only and restricted to bikes covered under your insurance policy.")}
          >
            {rotateKeysError && (
              <p className="mb-4 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{rotateKeysError}</p>
            )}

            {partnerKeysQuery.isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-16 w-full rounded-xl bg-surface-muted" />
                <div className="h-16 w-full rounded-xl bg-surface-muted" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 relative">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
                    {t("Client ID")}
                  </p>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <p className="text-sm font-mono text-ink-muted select-all">
                      {partnerKeysQuery.data?.clientId ?? '—'}
                    </p>
                    {partnerKeysQuery.data?.clientId && (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(partnerKeysQuery.data.clientId);
                          setCopiedClientId(true);
                          setTimeout(() => setCopiedClientId(false), 2000);
                        }}
                        className="p-1 rounded bg-surface border border-line text-ink hover:text-accent hover:bg-surface-hover transition-colors"
                      >
                        {copiedClientId ? <Check size={14} className="text-success-ink" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {rotatedSecret ? (
                  <div className="rounded-xl border border-warning-ink/30 bg-warning-soft/10 px-4 py-3 relative animate-scale-in">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-warning-ink">
                      {t("New Client Secret (Copy now, it won't be shown again!)")}
                    </p>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <p className="text-sm font-mono text-ink select-all break-all">
                        {rotatedSecret}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(rotatedSecret);
                          setCopiedClientSecret(true);
                          setTimeout(() => setCopiedClientSecret(false), 2000);
                        }}
                        className="p-1 rounded bg-surface border border-line text-ink hover:text-accent hover:bg-surface-hover transition-colors"
                      >
                        {copiedClientSecret ? <Check size={14} className="text-success-ink" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-surface-muted px-4 py-3 relative">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
                      {t("Client Secret")}
                    </p>
                    <p className="mt-1.5 text-sm font-mono text-ink-soft italic">
                      •••••••••••••••••••••••••••••••• ({t("Hidden for security")})
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
                    {t("Assigned API Scopes")}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(partnerKeysQuery.data?.scopes ?? ['insurer:read', 'webhooks:write']).map((scope) => (
                      <span
                        key={scope}
                        className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isRotatingKeys}
                    onClick={handleRotateKeys}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
                    style={{ background: '#EF4444', color: 'white' }}
                  >
                    {isRotatingKeys ? t('Generating...') : t('Rotate API Credentials')}
                  </button>
                </div>
              </div>
            )}
          </DashboardCard>
        </div>
      )}

      {/* Printable Tax Invoice Modal */}
      {selectedInvoiceModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm print:p-0 print:bg-white animate-fade-in">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-6 print:border-none print:shadow-none print:text-black print:bg-white text-ink">
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b border-line pb-4 print:border-black">
              <div>
                <h2 className="text-xl font-bold text-ink print:text-black">eMoto Fleet OS</h2>
                <p className="text-xs text-ink-muted print:text-gray-600">Official Subscription Tax Invoice</p>
                <p className="text-[11px] text-ink-soft mt-1 print:text-gray-600">Emotofleet OS LTD · TIN: 156542452 · Kigali, Rwanda</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-lg bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-mono font-bold text-accent print:border print:border-black print:text-black">
                  INV-{new Date(selectedInvoiceModal.periodStart).getFullYear()}-{String(selectedInvoiceModal.cycleNumber).padStart(3, '0')}
                </span>
                <p className="text-xs text-ink-muted mt-1 print:text-gray-600">
                  {t("Issued")}: {new Date(selectedInvoiceModal.periodStart).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Customer & Cycle Info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-surface-muted p-4 rounded-xl print:bg-gray-100 print:border print:border-gray-300">
              <div>
                <p className="font-bold text-ink-muted uppercase tracking-wider text-[10px] print:text-gray-700">{t("Billed To")}</p>
                <p className="font-bold text-ink text-sm mt-0.5 print:text-black">{user?.fleetName ?? 'Fleet Operator'}</p>
                <p className="text-ink-soft print:text-gray-600">{t("Fleet ID")}: {user?.fleetId}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink-muted uppercase tracking-wider text-[10px] print:text-gray-700">{t("Billing Period")}</p>
                <p className="font-semibold text-ink mt-0.5 print:text-black">
                  {new Date(selectedInvoiceModal.periodStart).toLocaleDateString()} – {new Date(selectedInvoiceModal.periodEnd).toLocaleDateString()}
                </p>
                <p className="text-ink-soft mt-1 print:text-gray-600">
                  {t("Due Date")}: <span className="font-bold text-ink print:text-black">{new Date(selectedInvoiceModal.dueDate).toLocaleDateString()}</span>
                </p>
              </div>
            </div>

            {/* Line Item Table */}
            <div className="border border-line rounded-xl overflow-hidden print:border-gray-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-surface-muted border-b border-line text-ink-muted font-bold uppercase print:bg-gray-200 print:text-black">
                  <tr>
                    <th className="py-2.5 px-4">{t("Item / Description")}</th>
                    <th className="py-2.5 px-4 text-center">{t("Bikes")}</th>
                    <th className="py-2.5 px-4 text-right">{t("Rate / Bike")}</th>
                    <th className="py-2.5 px-4 text-right">{t("Total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line print:divide-gray-300 print:text-black">
                  <tr>
                    <td className="py-3 px-4 font-medium">
                      {t("E-Moto Fleet OS Subscription")} ({entitlements.planLabel})
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {selectedInvoiceModal.bikeCount ?? 1}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {(selectedInvoiceModal.ratePerBike ?? (selectedInvoiceModal.totalDue / (selectedInvoiceModal.bikeCount || 1))).toLocaleString()} RWF
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {selectedInvoiceModal.totalDue.toLocaleString()} RWF
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary & Totals */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs">
              <div className="space-y-1 text-ink-soft print:text-gray-600">
                <p className="font-bold text-ink print:text-black">{t("Payment Status")}: <span className="uppercase text-accent font-bold">{selectedInvoiceModal.status}</span></p>
                <p>{t("Payment Method")}: MTN Mobile Money / Bank Transfer</p>
                <p>{t("MoMo Pay Merchant Code")}: <span className="font-mono font-bold text-ink print:text-black">*182*8*1# (Code: 881234)</span></p>
              </div>
              <div className="text-right space-y-1.5 border-t border-line pt-2 w-full sm:w-56 print:border-gray-300">
                <div className="flex justify-between text-ink-soft">
                  <span>{t("Subtotal")}:</span>
                  <span className="font-mono">{selectedInvoiceModal.totalDue.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>{t("Amount Paid")}:</span>
                  <span className="font-mono text-success-ink">{selectedInvoiceModal.totalPaid.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-ink print:text-black border-t border-line pt-1">
                  <span>{t("Balance Due")}:</span>
                  <span className="font-mono text-accent">{(selectedInvoiceModal.totalDue - selectedInvoiceModal.totalPaid).toLocaleString()} RWF</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 border-t border-line pt-4 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedInvoiceModal(null)}
                className="rounded-xl border border-line bg-surface-muted px-4 py-2 text-xs font-bold text-ink hover:bg-surface-hover transition cursor-pointer"
              >
                {t("Close")}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent-strong transition cursor-pointer shadow-sm"
              >
                <Printer size={14} />
                {t("Print / Save PDF")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MoMo Pay Now Modal */}
      {payNowCycle && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPayNowCycle(null)}>
          <div className="relative mx-4 w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-xl text-ink space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-line pb-3">
              <div>
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <Banknote className="text-accent" size={18} />
                  {t("Pay Invoice with MTN MoMo")}
                </h2>
                <p className="text-xs text-ink-muted">{t("Invoice #{num}").replace('{num}', String(payNowCycle.cycleNumber))}</p>
              </div>
              <button type="button" onClick={() => setPayNowCycle(null)} className="p-1 text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t("Amount Due")}</p>
                  <p className="text-2xl font-extrabold text-accent">{(payNowCycle.totalDue - payNowCycle.totalPaid).toLocaleString()} RWF</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t("Due Date")}</p>
                  <p className="text-xs font-semibold text-ink">{new Date(payNowCycle.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink">{t("MTN MoMo Phone Number")}</label>
                <input
                  type="tel"
                  placeholder="0781234567"
                  value={payNowPhone}
                  onChange={(e) => setPayNowPhone(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-mono text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p className="text-[10px] text-ink-muted">
                  {t("A USSD push prompt will be sent directly to this phone number.")}
                </p>
              </div>

              {payNowSuccessMsg && (
                <div className="rounded-xl border border-success-ink/20 bg-success-soft/10 p-3 text-xs font-bold text-success-ink flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>{payNowSuccessMsg}</span>
                </div>
              )}

              {payNowErrorMsg && (
                <div className="rounded-xl border border-error-ink/20 bg-error-soft/10 p-3 text-xs font-bold text-error-ink flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{payNowErrorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayNowCycle(null)}
                className="flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-hover transition"
              >
                {payNowSuccessMsg ? t("Close") : t("Cancel")}
              </button>
              {!payNowSuccessMsg && (
                <button
                  type="button"
                  disabled={payingNow || !payNowPhone}
                  onClick={async () => {
                    setPayingNow(true);
                    setPayNowErrorMsg(null);
                    setPayNowSuccessMsg(null);
                    try {
                      const res = await apiFetch<{ message: string }>(`/billing/my-cycles/${payNowCycle.id}/pay-now`, {
                        method: 'POST',
                        body: JSON.stringify({ momoPhoneNumber: payNowPhone }),
                      });
                      setPayNowSuccessMsg(res.message);
                      refetchMomoTx();
                      myCyclesQuery.refetch();
                    } catch (err: unknown) {
                      setPayNowErrorMsg(err instanceof Error ? err.message : t("Failed to trigger MoMo payment"));
                    } finally {
                      setPayingNow(false);
                    }
                  }}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent/90 transition disabled:opacity-50"
                >
                  {payingNow ? t("Sending Prompt...") : t("Send Payment Prompt")}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function SettingsField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </p>
      <p
        className={cx(
          'mt-1.5 text-sm text-ink',
          mono && 'font-mono text-xs text-ink-muted',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SettingsToggle({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={cx(
        'flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface-muted px-4 py-3 text-left transition-colors',
        !disabled && 'hover:bg-surface-hover cursor-pointer',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-ink-muted">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      <div
        className={cx(
          'h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-ink-faint/40',
        )}
      >
        <div
          className={cx(
            'h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </div>
    </button>
  );
}

// ── Team Management ──────────────────────────────────────────────────

interface FleetUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECH', 'RIDER'];

function TeamTab({ currentUser }: { currentUser: { id: string; role: string; fleetId: string } }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', phone: '', role: 'RIDER' });
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['fleet-users'],
    queryFn: () => apiFetch<FleetUser[]>('/auth/fleet-users'),
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleError(null);
    setChangingRoleFor(userId);
    try {
      await apiFetch(`/auth/fleet-users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await queryClient.invalidateQueries({ queryKey: ['fleet-users'] });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setRoleError(error.message);
      } else {
        setRoleError(t('Failed to change role'));
      }
    } finally {
      setChangingRoleFor(null);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteForm.email.trim() && !inviteForm.phone.trim()) {
      setInviteError(t('Either Email or Phone number is required'));
      return;
    }
    setInviteError(null);
    setIsInviting(true);
    setGeneratedInviteLink(null);
    setCopiedLink(false);
    try {
      const res = await apiFetch<{ token: string }>('/auth/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteForm.email.trim() || undefined,
          phone: inviteForm.phone.trim() || undefined,
          role: inviteForm.role,
        }),
      });
      const link = `${window.location.origin}/register?token=${res.token}`;
      setGeneratedInviteLink(link);
      await queryClient.invalidateQueries({ queryKey: ['fleet-users'] });
      setInviteForm({ email: '', phone: '', role: 'RIDER' });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setInviteError(error.message);
      } else {
        setInviteError(t('Failed to invite member'));
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingUserId) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiFetch(`/auth/fleet-users/${deletingUserId}`, {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: ['fleet-users'] });
      setShowDeleteConfirm(false);
      setDeletingUserId(null);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setDeleteError(error.message);
      } else {
        setDeleteError(t('Failed to remove member'));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const deletingUser = members?.find(m => m.id === deletingUserId);

  return (
    <div className="space-y-5 animate-fade-in">
      <DashboardCard
        eyebrow={t("Organization")}
        title={t("Team members")}
        description={t("Manage users in your fleet. Change roles to control access levels.")}
        actions={
          <button
            type="button"
            onClick={() => {
              setInviteForm({ email: '', phone: '', role: 'RIDER' });
              setInviteError(null);
              setGeneratedInviteLink(null);
              setShowInviteModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white transition hover:bg-accent-strong shadow-sm"
            style={{ background: '#3B82F6', color: 'white' }}
          >
            <UserPlus size={14} />
            {t("Invite Member")}
          </button>
        }
      >
        {roleError && (
          <p className="mb-4 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{roleError}</p>
        )}

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 w-full rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : !members?.length ? (
          <p className="py-8 text-center text-sm text-ink-muted">{t("No team members found.")}</p>
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line overflow-hidden max-h-[300px] overflow-y-auto dashboard-scrollbar">
            {members.map((member) => {
              const isCurrentUser = member.id === currentUser.id;
              return (
                <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-4 bg-surface-muted hover:bg-surface-hover transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent text-sm font-bold">
                      {(member.email?.[0] ?? member.phone?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {member.email ?? member.phone ?? t('Unknown')}
                        {isCurrentUser && <span className="ml-2 text-xs text-ink-muted">({t('you')})</span>}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {t(formatEnumLabel(member.status))} · {t('Joined {date}').replace('{date}', new Date(member.createdAt).toLocaleDateString())}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {isCurrentUser ? (
                      <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                        {t(formatEnumLabel(member.role))}
                      </span>
                    ) : (
                      <>
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            disabled={changingRoleFor === member.id}
                            className="appearance-none rounded-xl border border-line bg-surface px-3 py-1.5 pr-8 text-xs font-semibold text-ink outline-none transition focus:border-accent disabled:opacity-50 cursor-pointer"
                          >
                            {ROLE_OPTIONS.map(role => (
                              <option key={role} value={role}>{t(formatEnumLabel(role))}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingUserId(member.id);
                            setDeleteError(null);
                            setShowDeleteConfirm(true);
                          }}
                          className="rounded-xl border border-danger-ink/20 p-2 text-danger-ink hover:bg-danger-soft/20 hover:border-danger-ink/40 transition-colors"
                          aria-label={t("Remove member")}
                        >
                          <Trash size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          {t('{count} members in this fleet. Use role assignments to control feature access.').replace('{count}', String(members?.length ?? 0))}
        </p>
      </DashboardCard>

      {/* Invite Member Modal */}
      {mounted && showInviteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
          <div className="relative mx-4 w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-xl text-ink" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowInviteModal(false)} className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted hover:text-ink transition">
              <X size={18} />
            </button>

            {generatedInviteLink ? (
              <div className="space-y-4 pt-2">
                <h2 className="text-lg font-bold text-ink">{t("Invitation Link Generated")}</h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {t("Send this one-time link to the invitee to allow them to register in your fleet.")}
                </p>
                <div className="flex gap-2 items-center rounded-xl border border-line bg-surface-muted p-3">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="flex-1 bg-transparent text-xs text-ink-soft select-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedInviteLink)}
                    className="shrink-0 p-2 rounded-lg bg-surface border border-line text-ink hover:bg-surface-hover hover:text-accent transition"
                  >
                    {copiedLink ? <Check size={14} className="text-success-ink" /> : <Copy size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-full mt-2 rounded-xl bg-surface-muted border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
                >
                  {t("Close")}
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-ink">{t("Invite New Member")}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t("Generate a secure invite link to register a new user.")}</p>
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">{t("Email Address")}</label>
                    <input
                      type="email"
                      placeholder={t("e.g. member@emoto.com")}
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">{t("Phone Number")}</label>
                    <input
                      type="text"
                      placeholder={t("e.g. +250788000000")}
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">{t("Member Role")}</label>
                    <select
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface cursor-pointer"
                    >
                      <option value="ADMIN">{t("Admin")}</option>
                      <option value="DISPATCHER">{t("Dispatcher")}</option>
                      <option value="TECH">{t("Technician")}</option>
                      <option value="RIDER">{t("Rider")}</option>
                    </select>
                  </div>
                  {inviteError && <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{inviteError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover">
                      {t("Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleInviteMember}
                      disabled={isInviting}
                      className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-60"
                      style={{ background: '#3B82F6', color: 'white' }}
                    >
                      {isInviting ? t('Inviting...') : t('Send Invite')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {mounted && showDeleteConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="relative mx-4 w-full max-sm rounded-[24px] border border-line bg-surface p-6 shadow-xl text-ink" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink">{t("Remove Team Member")}</h2>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              {t('Are you sure you want to remove {member}? They will lose immediate dashboard access.')
                .split('{member}')
                .reduce<React.ReactNode[]>((acc, part, i) => {
                  if (i === 0) return [part];
                  return [...acc, <strong key={i} className="font-semibold text-ink">{deletingUser?.email ?? deletingUser?.phone ?? t('this member')}</strong>, part];
                }, [])}
            </p>
            {deleteError && <p className="mt-3 rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{deleteError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-danger-ink text-white px-4 py-3 text-sm font-bold hover:bg-accent-strong transition disabled:opacity-60"
                style={{ background: '#EF4444', color: 'white' }}
              >
                {isDeleting ? t('Removing...') : t('Remove')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

