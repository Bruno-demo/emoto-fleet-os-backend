'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import {
  Banknote,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  HelpCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { InlineNotice, SelectField, TextAreaField, TextField } from '@/components/ui/form-controls';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type { PaginatedResponse, Rider } from '@/lib/types/dashboard';
import { cx } from '@/lib/ui';

const PAGE_SIZE = 15;
const DAILY_LEASE_RATE = 15000; // default daily lease rate in RWF

interface PaymentRecord {
  id: string;
  fleetId: string;
  riderId: string;
  riderName: string;
  riderEmail: string | null;
  riderPhone: string | null;
  amount: number;
  paidAt: string;
  method: 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'OTHER';
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface FinancialSummary {
  earnedToday: number;
  earnedThisMonth: number;
  earnedThisYear: number;
  totalEarnedAllTime: number;
  totalEarnedRange: number;
  activeRidersCount: number;
  overdueCount: number;
  unpaidCount: number;
  unpaidLogsSum: number;
  methodBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  dailyEarnings: Array<{ date: string; amount: number }>;
}

interface LeaseContract {
  id: string;
  riderName: string;
  riderPhone: string;
  bikeLabel: string;
  bikePlate: string;
  totalPrincipal: number;
  totalPaid: number;
  dailyRate: number;
  arrears: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'DELINQUENT';
  lockState: 'LOCKED' | 'UNLOCKED';
  bikeId: string | null;
}

export default function FinancialsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  
  // Buy-to-Own leases tab & backend data management
  const [activeTab, setActiveTab] = useState<'collections' | 'buyToOwn'>('collections');
  const leasesQuery = useQuery({
    queryKey: ['leases'],
    queryFn: () => apiFetch<LeaseContract[]>('/financials/leases'),
  });
  const leases = useMemo(() => leasesQuery.data ?? [], [leasesQuery.data]);
  const [dispatchingLockId, setDispatchingLockId] = useState<string | null>(null);
  const [commandNotification, setCommandNotification] = useState<string | null>(null);

  const leaseMetrics = useMemo(() => {
    const activeLeases = leases.filter(l => l.status === 'ACTIVE' || l.status === 'DELINQUENT').length;
    const totalAssetValue = leases.reduce((sum, l) => sum + l.totalPrincipal, 0);
    const totalPaid = leases.reduce((sum, l) => sum + l.totalPaid, 0);
    const overallEquity = totalAssetValue > 0 ? Math.round((totalPaid / totalAssetValue) * 100) : 0;
    const totalArrears = leases.reduce((sum, l) => sum + l.arrears, 0);
    return {
      activeLeases,
      totalAssetValue,
      overallEquity,
      totalArrears
    };
  }, [leases]);

  const handleToggleLeaseLock = async (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId);
    if (!lease || !lease.bikeId) {
      setCommandNotification(t('No bike assigned to this lease contract.'));
      return;
    }

    setDispatchingLockId(leaseId);
    setCommandNotification(null);

    const action = lease.lockState === 'LOCKED' ? 'unlock' : 'lock';

    try {
      await apiFetch(
        `/commands/${action}?bikeId=${lease.bikeId}`,
        { method: 'POST' }
      );

      const nextState = lease.lockState === 'LOCKED' ? 'UNLOCKED' : 'LOCKED';
      setCommandNotification(t(
        nextState === 'LOCKED' 
          ? 'Dispatched GPRS motor starter lock command to bike {plate}.' 
          : 'Dispatched engine start enablement command to bike {plate}.'
      ).replace('{plate}', lease.bikePlate));

      await queryClient.invalidateQueries({ queryKey: ['leases'] });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setCommandNotification(t('Failed to dispatch command: {msg}').replace('{msg}', error.message));
      } else {
        setCommandNotification(t('Failed to dispatch remote command.'));
      }
    } finally {
      setDispatchingLockId(null);
    }

    setTimeout(() => {
      setCommandNotification(null);
    }, 4000);
  };

  // Close modal on Escape key and lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCollectModal(false);
      }
    };
    if (showCollectModal) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showCollectModal]);

  // Date ranges
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // default 2 weeks range
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Collect payment form state
  const [formRiderId, setFormRiderId] = useState('');
  const [formAmount, setFormAmount] = useState(String(DAILY_LEASE_RATE));
  const [formPaidAt, setFormPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [formMethod, setFormMethod] = useState<'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'OTHER'>('CASH');
  const [formStatus, setFormStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'>('PAID');
  const [formReference, setFormReference] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Fetch Selected Rider's payments history for arrears calculation in modal
  const riderPaymentsQuery = useQuery({
    queryKey: ['payments', 'rider', formRiderId],
    queryFn: () =>
      apiFetch<PaginatedResponse<PaymentRecord>>(
        `/financials${buildQueryString({ riderId: formRiderId, page: 1, pageSize: 100 })}`,
      ),
    enabled: !!formRiderId && showCollectModal,
  });

  const riderArrears = useMemo(() => {
    if (!riderPaymentsQuery.data) return 0;
    return riderPaymentsQuery.data.data
      .filter((p) => p.status === 'UNPAID' || p.status === 'OVERDUE')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [riderPaymentsQuery.data]);

  // 1. Fetch Riders (for dropdown and matrix)
  const ridersQuery = useQuery({
    queryKey: ['riders', 'financials-dropdown'],
    queryFn: () => apiFetch<PaginatedResponse<Rider>>('/riders?page=1&pageSize=200'),
  });

  // 2. Fetch Payments History Log
  const paymentsQuery = useQuery({
    queryKey: ['payments', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<PaymentRecord>>(
        `/financials${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  // 3. Fetch Aggregate Summary metrics
  const summaryQuery = useQuery({
    queryKey: ['financials-summary', startDate, endDate],
    queryFn: () =>
      apiFetch<FinancialSummary>(`/financials/summary?startDate=${startDate}&endDate=${endDate}`),
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: (data: {
      riderId: string;
      amount: number;
      paidAt: string;
      method: string;
      status: string;
      reference?: string;
      notes?: string;
    }) =>
      apiFetch<PaymentRecord>('/financials', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['financials-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      setShowCollectModal(false);
      resetForm();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setCollectError(error.message);
      } else {
        setCollectError(t('Failed to record payment'));
      }
    },
  });

  const resetForm = () => {
    setFormRiderId('');
    setFormAmount(String(DAILY_LEASE_RATE));
    setFormPaidAt(new Date().toISOString().slice(0, 16));
    setFormMethod('CASH');
    setFormStatus('PAID');
    setFormReference('');
    setFormNotes('');
    setCollectError(null);
  };

  const ridersList = ridersQuery.data?.data ?? [];
  const paymentsList = paymentsQuery.data?.data ?? [];
  const summary = summaryQuery.data;

  // Compute current week calendar matrix with offset support
  const weekDays = useMemo(() => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const current = new Date();
    
    // Shift current date based on weekOffset (7 days per offset step)
    current.setDate(current.getDate() + weekOffset * 7);
    
    // Monday is 1st day in grid
    const first = current.getDate() - current.getDay() + (current.getDay() === 0 ? -6 : 1);
    
    return Array.from({ length: 7 }, (_, i) => {
      const next = new Date(current.getFullYear(), current.getMonth(), first + i);
      return {
        dayLabel: daysOfWeek[i],
        dateString: next.toISOString().slice(0, 10),
        displayDate: next.getDate(),
      };
    });
  }, [weekOffset]);

  // Compute week range human-readable label
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const start = new Date(weekDays[0].dateString);
    const end = new Date(weekDays[6].dateString);
    const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString(undefined, formatOptions);
    const endStr = end.toLocaleDateString(undefined, formatOptions);
    const yearStr = end.getFullYear();
    return `${startStr} - ${endStr}, ${yearStr}`;
  }, [weekDays]);

  const openCollectForMatrix = (riderId: string, dateString: string) => {
    setFormRiderId(riderId);
    setFormPaidAt(`${dateString}T12:00`);
    setShowCollectModal(true);
  };

  // Helper to check payment on a matrix day
  const getMatrixCellStatus = (riderId: string, dateString: string) => {
    // Check if there is an existing payment record in the current page list or active cache
    const matched = paymentsList.find(
      (p) => p.riderId === riderId && p.paidAt.slice(0, 10) === dateString,
    );
    if (!matched) return 'unpaid';
    return matched.status.toLowerCase();
  };

  // CSV Export helper
  const handleExportCSV = () => {
    if (paymentsList.length === 0) return;
    const headers = ['Rider', 'Email', 'Phone', 'Amount', 'Date', 'Method', 'Status', 'Reference', 'Notes'];
    const rows = paymentsList.map((p) => [
      p.riderName,
      p.riderEmail ?? '',
      p.riderPhone ?? '',
      p.amount,
      p.paidAt,
      p.method,
      p.status,
      p.reference ?? '',
      p.notes ?? '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fleet_collections_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRecordPaymentSubmit = () => {
    if (!formRiderId) {
      setCollectError(t('Please select a rider.'));
      return;
    }
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCollectError(t('Please input a valid amount greater than zero.'));
      return;
    }

    // Allocate payment to Buy-to-Own lease contract if the rider is registered
    const targetRider = ridersList.find(r => r.id === formRiderId);
    if (targetRider) {
      setLeases(prev => prev.map(l => {
        if (l.riderName === targetRider.fullName) {
          const newPaid = Math.min(l.totalPrincipal, l.totalPaid + amountNum);
          const newArrears = Math.max(0, l.arrears - amountNum);
          return {
            ...l,
            totalPaid: newPaid,
            arrears: newArrears,
            status: newPaid >= l.totalPrincipal ? 'PAID_OFF' : newArrears === 0 ? 'ACTIVE' : l.status
          };
        }
        return l;
      }));
    }

    recordPaymentMutation.mutate({
      riderId: formRiderId,
      amount: amountNum,
      paidAt: new Date(formPaidAt).toISOString(),
      method: formMethod,
      status: formStatus,
      reference: formReference || undefined,
      notes: formNotes || undefined,
    });
  };

  // Table columns
  const columns = useMemo<Array<DataTableColumn<PaymentRecord>>>(
    () => [
      {
        header: t('Rider'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent font-semibold text-xs">
              <User size={13} />
            </span>
            <div>
              <p className="font-semibold text-ink leading-none">{pay.riderName}</p>
              <p className="text-[10px] text-ink-muted mt-0.5">{pay.riderPhone ?? t('No Phone')}</p>
            </div>
          </div>
        ),
      },
      {
        header: t('Amount Collected'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <span className="font-mono text-sm font-bold text-ink-soft">
            {pay.amount.toLocaleString()} RWF
          </span>
        ),
      },
      {
        header: t('Collection Date'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <span className="text-xs text-ink-muted tabular-nums">
            {new Date(pay.paidAt).toLocaleDateString()} &middot;{' '}
            {new Date(pay.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        ),
      },
      {
        header: t('Payment Method'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <div className="flex items-center gap-1 text-xs text-ink-soft">
            {pay.method === 'MOBILE_MONEY' && <Wallet size={12} className="text-emerald-400" />}
            {pay.method === 'CASH' && <Coins size={12} className="text-amber-400" />}
            {pay.method === 'BANK_TRANSFER' && <CreditCard size={12} className="text-blue-400" />}
            {pay.method === 'OTHER' && <HelpCircle size={12} className="text-purple-400" />}
            <span>
              {t(pay.method
                .replace('_', ' ')
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase()))}
            </span>
          </div>
        ),
      },
      {
        header: t('Status'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <Badge
            label={t(pay.status)}
            tone={
              pay.status === 'PAID'
                ? 'success'
                : pay.status === 'PARTIAL'
                  ? 'warning'
                  : pay.status === 'OVERDUE'
                    ? 'danger'
                    : 'neutral'
            }
          />
        ),
      },
      {
        header: t('Reference Code'),
        className: 'whitespace-nowrap',
        cellClassName: 'whitespace-nowrap',
        render: (pay) => (
          <span className="font-mono text-xs text-ink-faint">{pay.reference ?? '--'}</span>
        ),
      },
    ],
    [t],
  );

  // SVG Chart values
  const svgChartPath = useMemo(() => {
    if (!summary || summary.dailyEarnings.length === 0) return '';
    const data = summary.dailyEarnings;
    const maxVal = Math.max(...data.map((d) => d.amount), 50);
    const height = 110;
    const width = 680;
    const padding = 15;
    
    const xStep = (width - padding * 2) / (data.length === 1 ? 1 : data.length - 1);
    
    const coords = data.map((d, index) => {
      const x = padding + index * xStep;
      const y = height - padding - (d.amount / maxVal) * (height - padding * 2);
      return { x, y };
    });

    if (coords.length === 0) return '';
    
    // Create spline or line path
    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      path += ` L ${coords[i].x} ${coords[i].y}`;
    }

    // Closed path for background gradient
    const closedPath = `${path} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
    
    return { linePath: path, areaPath: closedPath, points: coords };
  }, [summary]);

  const hoveredPoint = useMemo(() => {
    if (activePointIndex === null || !summary || !svgChartPath || typeof svgChartPath !== 'object') return null;
    const pt = svgChartPath.points[activePointIndex];
    const earn = summary.dailyEarnings[activePointIndex];
    return {
      x: pt.x,
      y: pt.y,
      date: new Date(earn.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: earn.amount,
    };
  }, [activePointIndex, summary, svgChartPath]);

  return (
    <div className="space-y-6">
      {/* Date selector header */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Fleet Financials')}</h2>
          <p className="text-xs text-ink-muted">{t('Track rider daily rates, payments, and overall revenues.')}</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-muted border border-line rounded-2xl p-1.5 self-start sm:self-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs font-semibold text-ink px-2 outline-none"
          />
          <span className="text-ink-faint text-xs">&rarr;</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs font-semibold text-ink px-2 outline-none"
          />
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={cx(
            'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer outline-none',
            activeTab === 'collections'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink-soft'
          )}
        >
          {t('Daily Collections')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('buyToOwn')}
          className={cx(
            'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer outline-none',
            activeTab === 'buyToOwn'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink-soft'
          )}
        >
          {t('Buy-to-Own Leases')}
        </button>
      </div>

      {/* Collections Tab Content */}
      {activeTab === 'collections' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI summaries */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl border border-line bg-surface-muted animate-pulse" />
              ))
            ) : (
              <>
                <MetricCard
                  title={t("Today's Collections")}
                  value={summary ? `${summary.earnedToday.toLocaleString()} RWF` : '0 RWF'}
                  hint={t("Revenue recorded today")}
                  icon={<Coins size={18} />}
                  tone="success"
                />
                <MetricCard
                  title={t("This Month")}
                  value={summary ? `${summary.earnedThisMonth.toLocaleString()} RWF` : '0 RWF'}
                  hint={t("Revenues collected this month")}
                  icon={<TrendingUp size={18} />}
                  tone="info"
                />
                <MetricCard
                  title={t("Outstanding Debts")}
                  value={summary ? `${summary.unpaidLogsSum.toLocaleString()} RWF` : '0 RWF'}
                  hint={t('{count} overdue payments pending').replace('{count}', String(summary?.overdueCount ?? 0))}
                  icon={<Banknote size={18} />}
                  tone={summary && summary.unpaidLogsSum > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  title={t("Collection Average")}
                  value={summary ? `${(summary.totalEarnedRange / Math.max(summary.activeRidersCount, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })} RWF` : '0 RWF'}
                  hint={t("Avg rate collected per active rider")}
                  icon={<Users size={18} />}
                  tone="info"
                />
              </>
            )}
          </section>

          {/* Grid: Charts + Daily Payment Matrix */}
          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              {/* Earning Graph */}
              <DashboardCard
                eyebrow={t("Revenue Streams")}
                title={t("Earning progression")}
                actions={
                  <button
                    type="button"
                    onClick={() => void queryClient.invalidateQueries({ queryKey: ['financials-summary'] })}
                    className="rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition"
                    title={t("Refresh stats")}
                  >
                    <RefreshCw size={12} />
                  </button>
                }
              >
                {summaryQuery.isLoading ? (
                  <div className="h-[120px] w-full bg-surface-hover rounded-xl animate-pulse" />
                ) : summary && summary.dailyEarnings.length > 0 ? (
                  <div className="space-y-3">
                    <div className="relative h-[120px] w-full overflow-visible mt-6">
                      {/* Tooltip Overlay */}
                      {hoveredPoint && (
                        <div
                          className="absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none rounded-xl border border-line bg-surface p-2.5 shadow-xl text-[10px] space-y-0.5 leading-none transition-all duration-150 text-ink animate-scale-in"
                          style={{
                            left: `${(hoveredPoint.x / 680) * 100}%`,
                            top: `${(hoveredPoint.y / 110) * 120 - 12}px`,
                          }}
                        >
                          <p className="font-semibold text-ink-muted">{hoveredPoint.date}</p>
                          <p className="font-mono font-bold text-accent text-xs">{hoveredPoint.amount.toLocaleString()} RWF</p>
                        </div>
                      )}

                      <svg viewBox="0 0 680 110" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
                          </linearGradient>
                        </defs>
                        {/* Fill Area */}
                        {typeof svgChartPath === 'object' && (
                          <path d={svgChartPath.areaPath} fill="url(#chartGrad)" />
                        )}
                        {/* Line path */}
                        {typeof svgChartPath === 'object' && (
                          <path
                            d={svgChartPath.linePath}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {/* Hover guide line */}
                        {activePointIndex !== null && typeof svgChartPath === 'object' && (
                          <line
                            x1={svgChartPath.points[activePointIndex].x}
                            y1={0}
                            x2={svgChartPath.points[activePointIndex].x}
                            y2={110}
                            stroke="rgba(59, 130, 246, 0.4)"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                          />
                        )}
                        {/* Dots */}
                        {typeof svgChartPath === 'object' &&
                          svgChartPath.points.map((p, i) => (
                            <g key={i}>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={activePointIndex === i ? 5.5 : 3.5}
                                fill={activePointIndex === i ? "#3B82F6" : "#1E293B"}
                                stroke="#3B82F6"
                                strokeWidth="2"
                                className="transition-all duration-150"
                              />
                              {/* Invisible hover trigger zone (wider radius) */}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="20"
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setActivePointIndex(i)}
                                onMouseLeave={() => setActivePointIndex(null)}
                              />
                            </g>
                          ))}
                      </svg>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-ink-muted px-2">
                      <span>{new Date(startDate).toLocaleDateString()}</span>
                      <span>{t("Average collection trend active")}</span>
                      <span>{new Date(endDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUp size={18} />}
                    title={t("No revenue logged")}
                    description={t("Collections data graphs will appear here once logs are entered.")}
                  />
                )}
              </DashboardCard>

              {/* Interactive Matrix Grid */}
              <DashboardCard
                eyebrow={t("Operational Tracker")}
                title={t("Interactive payment matrix")}
                description={t('Weekly view for {range}').replace('{range}', weekRangeLabel)}
                actions={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev - 1)}
                      className="rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors border border-line cursor-pointer"
                      title={t("Previous week")}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekOffset(0)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-surface hover:bg-surface-hover border border-line text-ink-soft hover:text-ink transition-colors cursor-pointer"
                      title={t("Current week")}
                    >
                      {t("Current")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev + 1)}
                      className="rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors border border-line cursor-pointer"
                      title={t("Next week")}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                }
              >
                {ridersQuery.isLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-10 bg-surface-muted rounded-xl" />
                    <div className="h-10 bg-surface-muted rounded-xl" />
                    <div className="h-10 bg-surface-muted rounded-xl" />
                  </div>
                ) : ridersList.length === 0 ? (
                  <EmptyState
                    icon={<Calendar size={18} />}
                    title={t("No riders registered")}
                    description={t("Riders must be added to your registry to track daily lease matrix.")}
                  />
                ) : (
                  <div className="overflow-x-auto dashboard-scrollbar">
                    <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-ink-faint">
                          <th className="py-2.5 font-bold">{t('Rider')}</th>
                          {weekDays.map((d) => (
                            <th key={d.dateString} className="py-2.5 text-center font-bold">
                              <div>{t(d.dayLabel)}</div>
                              <div className="text-[10px] opacity-70 font-semibold">{d.displayDate}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ridersList.map((rider) => (
                          <tr key={rider.id} className="border-b border-line hover:bg-surface-hover transition-colors">
                            <td className="py-3 font-semibold text-ink">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent text-[10px] font-bold">
                                  {(rider.fullName ?? 'U').charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate max-w-[120px]">
                                  {rider.fullName ?? t('Rider {id}').replace('{id}', rider.id.slice(0, 8))}
                                </span>
                              </div>
                            </td>
                            {weekDays.map((day) => {
                              const status = getMatrixCellStatus(rider.id, day.dateString);
                              return (
                                <td key={day.dateString} className="py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => openCollectForMatrix(rider.id, day.dateString)}
                                    className={cx(
                                      'h-7 w-7 rounded-lg flex items-center justify-center transition-all border outline-none cursor-pointer group mx-auto',
                                      status === 'paid' && 'bg-success-soft/20 border-success-ink/25 text-success-ink hover:bg-success-soft/40',
                                      status === 'partial' && 'bg-warning-soft/20 border-warning-ink/25 text-warning-ink hover:bg-warning-soft/40',
                                      status === 'overdue' && 'bg-danger-soft/20 border-danger-ink/25 text-danger-ink hover:bg-danger-soft/40',
                                      status === 'unpaid' && 'bg-surface-muted/50 border-line text-ink-faint hover:bg-surface-hover hover:border-line-strong hover:text-ink-soft',
                                    )}
                                    title={
                                      status === 'unpaid'
                                        ? t('Log rate for {rider} on {day}').replace('{rider}', rider.fullName ?? '').replace('{day}', t(day.dayLabel))
                                        : t('Status: {status} (Click to log new)').replace('{status}', t(status.toUpperCase()))
                                    }
                                  >
                                    {status === 'paid' && <Check size={12} className="stroke-[3px]" />}
                                    {status === 'partial' && <AlertTriangle size={12} className="stroke-[2.5px]" />}
                                    {status === 'overdue' && <AlertCircle size={12} className="stroke-[2.5px]" />}
                                    {status === 'unpaid' && <Plus size={10} className="opacity-40 group-hover:opacity-100 transition-opacity" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DashboardCard>
            </div>

            {/* Right side: Method pie/doughnut + quick record panel shortcut */}
            <div className="space-y-5">
              {/* Method Chart */}
              <DashboardCard eyebrow={t("Financial Distribution")} title={t("Collections by payment method")}>
                {summaryQuery.isLoading ? (
                  <div className="h-[140px] w-full bg-surface-hover rounded-xl animate-pulse" />
                ) : summary && summary.totalEarnedRange > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                    {/* SVG Doughnut chart */}
                    <div className="relative h-28 w-28 shrink-0">
                      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                        {(() => {
                          const total = summary.totalEarnedRange;
                          let currentOffset = 0;
                          return Object.entries(summary.methodBreakdown).map(([method, amount]) => {
                            const percent = (amount / total) * 100;
                            const strokeDash = `${percent} ${100 - percent}`;
                            const offset = currentOffset;
                            currentOffset += percent;

                            let strokeColor = '#94A3B8'; // OTHER
                            if (method === 'CASH') strokeColor = '#FBBF24'; // amber
                            if (method === 'MOBILE_MONEY') strokeColor = '#34D399'; // emerald
                            if (method === 'BANK_TRANSFER') strokeColor = '#60A5FA'; // blue

                            return (
                              <circle
                                key={method}
                                cx="18"
                                cy="18"
                                r="15.915"
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="3.2"
                                strokeDasharray={strokeDash}
                                strokeDashoffset={100 - offset}
                                strokeLinecap="round"
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{t("Total")}</span>
                        <span className="text-[11px] font-bold text-ink leading-none">{summary.totalEarnedRange.toLocaleString()} RWF</span>
                      </div>
                    </div>

                    {/* Legends */}
                    <div className="grid gap-2 text-xs">
                      {Object.entries(summary.methodBreakdown).map(([method, val]) => {
                        let dotColor = 'bg-slate-400';
                        if (method === 'CASH') dotColor = 'bg-amber-400';
                        if (method === 'MOBILE_MONEY') dotColor = 'bg-emerald-400';
                        if (method === 'BANK_TRANSFER') dotColor = 'bg-blue-400';

                        return (
                          <div key={method} className="flex items-center gap-2">
                            <span className={cx('h-2 w-2 rounded-full shrink-0', dotColor)} />
                            <span className="font-semibold text-ink-soft min-w-[90px]">
                              {t(method.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))}
                            </span>
                            <span className="font-mono text-ink font-bold">{val.toLocaleString()} RWF</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<Coins size={18} />}
                    title={t("No distribution data")}
                    description={t("Distribution analysis requires recorded transaction history.")}
                  />
                )}
              </DashboardCard>

              {/* Quick Collection Panel shortcut */}
              <DashboardCard eyebrow={t("Shortcuts")} title={t("Cash collections console")}>
                <p className="text-xs text-ink-muted mb-4">
                  {t("Directly collect lease payments from riders, clear outstanding arrears, or log mobile transactions.")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowCollectModal(true);
                  }}
                  style={{ backgroundColor: '#3B82F6', color: '#ffffff' }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold py-3 text-sm transition-all shadow-md shadow-accent/15 hover:opacity-90 hover:brightness-110"
                >
                  <Plus size={14} />
                  {t("Collect lease payment")}
                </button>
              </DashboardCard>
            </div>
          </section>

          {/* History table */}
          <DashboardCard
            eyebrow={t("Registry")}
            title={t("Collection Logs history")}
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={paymentsList.length === 0}
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-muted hover:bg-surface-hover text-ink-soft hover:text-ink transition-all px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <Download size={12} />
                  {t("Export CSV")}
                </button>
              </div>
            }
          >
            <div className="mt-2">
              <DataTable
                data={paymentsList}
                columns={columns}
                keyExtractor={(pay) => pay.id}
                loading={paymentsQuery.isLoading}
                emptyState={
                  <EmptyState
                    icon={<Coins size={18} />}
                    title={t("No collections logged")}
                    description={t("Create custom entries to see logs here.")}
                  />
                }
              />
            </div>

            <PaginationControls
              page={paymentsQuery.data?.page ?? page}
              totalPages={paymentsQuery.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </DashboardCard>
        </div>
      )}

      {/* Buy-to-Own Leases Tab Content */}
      {activeTab === 'buyToOwn' && (
        <div className="space-y-6 animate-fade-in">
          {/* Custom Lease KPI cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title={t("Active Leases")}
              value={String(leaseMetrics.activeLeases)}
              hint={t("Ongoing lease contracts")}
              icon={<Users size={18} />}
              tone="info"
            />
            <MetricCard
              title={t("Leased Asset Value")}
              value={`${leaseMetrics.totalAssetValue.toLocaleString()} RWF`}
              hint={t("Total principal under financing")}
              icon={<TrendingUp size={18} />}
              tone="info"
            />
            <MetricCard
              title={t("Rider Equity")}
              value={`${leaseMetrics.overallEquity}%`}
              hint={t("Average portfolio ownership paid")}
              icon={<Wallet size={18} />}
              tone="success"
            />
            <MetricCard
              title={t("Overdue Arrears")}
              value={`${leaseMetrics.totalArrears.toLocaleString()} RWF`}
              hint={t("Accumulated financing arrears")}
              icon={<Banknote size={18} />}
              tone={leaseMetrics.totalArrears > 0 ? 'warning' : 'neutral'}
            />
          </section>

          {/* GPRS Dispatch Command Notification Alert */}
          {commandNotification && (
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-400">
              <AlertCircle size={14} className="shrink-0" />
              <p className="font-semibold">{commandNotification}</p>
            </div>
          )}

          {/* Financing Ledger Table Card */}
          <DashboardCard
            eyebrow={t("Financing Ledger")}
            title={t("Buy-to-own lease portfolio")}
            description={t("Monitor driver ownership progress, arrears, and remote start controls.")}
          >
            <div className="overflow-x-auto dashboard-scrollbar mt-2">
              <table className="w-full min-w-[800px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-ink-faint">
                    <th className="py-2.5 font-bold">{t('Rider & Contact')}</th>
                    <th className="py-2.5 font-bold">{t('Lease Rate')}</th>
                    <th className="py-2.5 font-bold">{t('Ownership Progress')}</th>
                    <th className="py-2.5 font-bold">{t('Current Arrears')}</th>
                    <th className="py-2.5 font-bold text-center">{t('Security Status')}</th>
                    <th className="py-2.5 font-bold text-center">{t('Financing Status')}</th>
                    <th className="py-2.5 font-bold text-right">{t('Compliance Control')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => (
                    <tr key={lease.id} className="border-b border-line hover:bg-surface-hover transition-colors">
                      <td className="py-3 font-semibold text-ink">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent font-semibold text-xs shrink-0">
                            <User size={13} />
                          </span>
                          <div>
                            <p className="font-semibold text-ink leading-none">{lease.riderName}</p>
                            <p className="text-[10px] text-ink-muted mt-1">{lease.riderPhone}</p>
                            <p className="text-[9px] text-accent/80 font-mono mt-0.5">{lease.bikeLabel} &middot; {lease.bikePlate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="text-xs">
                          <p className="font-semibold text-ink">{lease.dailyRate.toLocaleString()} RWF</p>
                          <p className="text-[10px] text-ink-muted mt-0.5">{t('per day')}</p>
                        </div>
                      </td>
                      <td className="py-3">
                        {(() => {
                          const pct = Math.round((lease.totalPaid / lease.totalPrincipal) * 100);
                          return (
                            <div className="min-w-[120px] max-w-[160px] text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-ink-soft">{pct}%</span>
                                <span className="text-[10px] text-ink-muted tabular-nums">
                                  {lease.totalPaid.toLocaleString()} / {lease.totalPrincipal.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden border border-line">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3">
                        <span className={cx(
                          "font-mono text-xs font-bold",
                          lease.arrears > 0 ? "text-danger-ink bg-danger-soft/20 px-2 py-1 rounded-md" : "text-ink-soft"
                        )}>
                          {lease.arrears.toLocaleString()} RWF
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          label={t(lease.lockState === 'LOCKED' ? 'Locked' : 'Unlocked')}
                          tone={lease.lockState === 'LOCKED' ? 'danger' : 'success'}
                        />
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          label={t(lease.status === 'PAID_OFF' ? 'Paid Off' : lease.status === 'ACTIVE' ? 'Active' : 'Delinquent')}
                          tone={
                            lease.status === 'PAID_OFF'
                              ? 'success'
                              : lease.status === 'ACTIVE'
                                ? 'info'
                                : 'danger'
                          }
                        />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {lease.status !== 'PAID_OFF' && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedRider = ridersList.find(r => r.fullName === lease.riderName);
                                if (matchedRider) {
                                  setFormRiderId(matchedRider.id);
                                } else {
                                  setFormRiderId('');
                                }
                                setFormAmount(String(lease.dailyRate));
                                setShowCollectModal(true);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-line bg-surface hover:bg-surface-hover text-accent transition-colors cursor-pointer"
                            >
                              {t('Collect payment')}
                            </button>
                          )}
                          {lease.status !== 'PAID_OFF' && (
                            <button
                              type="button"
                              disabled={dispatchingLockId !== null}
                              onClick={() => handleToggleLeaseLock(lease.id)}
                              className={cx(
                                "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer min-w-[85px] text-center",
                                lease.lockState === 'UNLOCKED'
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20"
                              )}
                            >
                              {dispatchingLockId === lease.id ? t('Enforcing...') : lease.lockState === 'UNLOCKED' ? t('Immobilize') : t('Restore start')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </div>
      )}

      {/* Quick Collect lease Modal */}
      {showCollectModal && (
        <div
          onClick={() => setShowCollectModal(false)}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-[4px] p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-line bg-surface shadow-2xl animate-scale-in overflow-hidden cursor-default"
          >
            {/* Header: fixed height */}
            <div className="flex items-center justify-between border-b border-line p-5 shrink-0">
              <h3 className="font-display text-lg font-bold text-ink">{t("Collect daily lease rate")}</h3>
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body: scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 dashboard-scrollbar">
              {collectError && <InlineNotice message={collectError} tone="danger" />}

              <SelectField
                label={t("Rider")}
                value={formRiderId}
                onChange={(e) => setFormRiderId(e.target.value)}
              >
                <option value="">{t("-- Select Rider --")}</option>
                {ridersList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} ({r.phone ?? r.email ?? t('No contact info')})
                  </option>
                ))}
              </SelectField>

              {formRiderId && (
                <div className="space-y-1">
                  {riderPaymentsQuery.isLoading ? (
                    <p className="text-[10px] text-ink-muted animate-pulse">{t("Calculating outstanding arrears...")}</p>
                  ) : (
                    <div className={cx(
                      "p-3 rounded-xl border text-xs flex justify-between items-center transition-all",
                      riderArrears > 0 ? "bg-danger-soft/10 border-danger-ink/20 text-danger-ink" : "bg-success-soft/10 border-success-ink/20 text-success-ink"
                    )}>
                      <span className="font-semibold">{t("Outstanding Arrears:")}</span>
                      <span className="font-mono font-bold text-sm">
                        {riderArrears.toLocaleString()} RWF
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label={t("Lease Rate Collected (RWF)")}
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  step="1"
                  min="1"
                />
                <TextField
                  label={t("Date & Time")}
                  type="datetime-local"
                  value={formPaidAt}
                  onChange={(e) => setFormPaidAt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label={t("Payment Method")}
                  value={formMethod}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormMethod(e.target.value as 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'OTHER')}
                >
                  <option value="CASH">{t("Cash")}</option>
                  <option value="MOBILE_MONEY">{t("Mobile Money (MTN MoMo / Airtel)")}</option>
                  <option value="BANK_TRANSFER">{t("Bank Transfer")}</option>
                  <option value="OTHER">{t("Other")}</option>
                </SelectField>

                <SelectField
                  label={t("Rate Status")}
                  value={formStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormStatus(e.target.value as 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE')}
                >
                  <option value="PAID">{t("Full Payment (Paid)")}</option>
                  <option value="PARTIAL">{t("Arrears/Partial")}</option>
                  <option value="UNPAID">{t("Unpaid")}</option>
                  <option value="OVERDUE">{t("Overdue Rate")}</option>
                </SelectField>
              </div>

              <TextField
                label={t("Transaction Reference Code (Optional)")}
                type="text"
                placeholder={t("e.g. Mobile Money ID or Bank Receipt number")}
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
              />

              <TextAreaField
                label={t("Operator Notes (Optional)")}
                placeholder={t("Remarks about the payment")}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            {/* Footer: fixed height */}
            <div className="flex justify-end gap-3 border-t border-line p-5 shrink-0">
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-surface-hover hover:text-ink transition"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={recordPaymentMutation.isPending}
                onClick={handleRecordPaymentSubmit}
                style={{ backgroundColor: '#3B82F6', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 rounded-xl font-semibold px-5 py-2.5 text-sm hover:opacity-90 hover:brightness-110 disabled:opacity-50 transition"
              >
                {recordPaymentMutation.isPending ? t('Saving...') : t('Confirm Collection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
