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
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
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
import { useCurrentUser } from '@/lib/auth/use-current-user';

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
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixTab, setMatrixTab] = useState<'daily' | 'lease'>('daily');
  
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
    const overallEquity = totalAssetValue > 0 ? Math.min(100, Math.max(0, Math.round((totalPaid / totalAssetValue) * 100))) : 0;
    return {
      activeLeases,
      totalAssetValue,
      overallEquity,
      totalArrears: leases.reduce((sum, l) => sum + l.arrears, 0)
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
    queryKey: ['payments', page, startDate, endDate],
    queryFn: () =>
      apiFetch<PaginatedResponse<PaymentRecord>>(
        `/financials${buildQueryString({
          page,
          pageSize: PAGE_SIZE,
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
        })}`,
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

  const ridersList = useMemo(() => ridersQuery.data?.data ?? [], [ridersQuery.data]);

  const filteredRiders = useMemo(() => {
    return ridersList.filter((r) => {
      const q = matrixSearch.toLowerCase();
      return (
        (r.fullName ?? '').toLowerCase().includes(q) ||
        (r.phone && r.phone.includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
      );
    });
  }, [ridersList, matrixSearch]);

  const dailyCollectionRiders = useMemo(() => {
    return filteredRiders.filter((r) => !r.leaseToOwn);
  }, [filteredRiders]);

  const buyToOwnRiders = useMemo(() => {
    return filteredRiders.filter((r) => r.leaseToOwn);
  }, [filteredRiders]);

  const activeMatrixRiders = matrixTab === 'daily' ? dailyCollectionRiders : buyToOwnRiders;

  const paymentsList = useMemo(() => paymentsQuery.data?.data ?? [], [paymentsQuery.data]);
  const summary = summaryQuery.data;

  const selectedRider = useMemo(() => {
    return ridersList.find((r) => r.id === formRiderId);
  }, [ridersList, formRiderId]);

  const isRiderUnassignedLease = useMemo(() => {
    if (!selectedRider) return false;
    return selectedRider.leaseToOwn && (!selectedRider.activeAssignments || selectedRider.activeAssignments.length === 0);
  }, [selectedRider]);

  // Reset pagination page when date range filter changes
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  // Reset weekly offset when date range filter changes
  useEffect(() => {
    setWeekOffset(0);
  }, [endDate]);

  // Compute current week calendar matrix with offset support (anchored to endDate)
  const weekDays = useMemo(() => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const current = new Date(endDate);
    
    // Shift current date based on weekOffset (7 days per offset step)
    current.setDate(current.getDate() + weekOffset * 7);
    
    // Monday is 1st day in grid
    const first = current.getDate() - current.getDay() + (current.getDay() === 0 ? -6 : 1);
    
    return Array.from({ length: 7 }, (_, i) => {
      const next = new Date(current.getFullYear(), current.getMonth(), first + i);
      const year = next.getFullYear();
      const month = String(next.getMonth() + 1).padStart(2, '0');
      const date = String(next.getDate()).padStart(2, '0');
      return {
        dayLabel: daysOfWeek[i],
        dateString: `${year}-${month}-${date}`,
        displayDate: next.getDate(),
      };
    });
  }, [weekOffset, endDate]);

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

  // Fetch payments for the active week to populate the payment matrix
  const weekStartDate = weekDays[0]?.dateString;
  const weekEndDate = weekDays[6]?.dateString;
  const weekPaymentsQuery = useQuery({
    queryKey: ['payments', 'week', weekStartDate, weekEndDate],
    queryFn: () =>
      apiFetch<PaginatedResponse<PaymentRecord>>(
        `/financials${buildQueryString({
          startDate: `${weekStartDate}T00:00:00.000Z`,
          endDate: `${weekEndDate}T23:59:59.999Z`,
          pageSize: 200,
        })}`,
      ),
    enabled: !!weekStartDate && !!weekEndDate,
  });
  const weekPayments = weekPaymentsQuery.data?.data ?? [];

  const openCollectForMatrix = (riderId: string, dateString: string) => {
    setFormRiderId(riderId);

    const matched = weekPayments.find(
      (p) => p.riderId === riderId && p.paidAt.slice(0, 10) === dateString,
    );

    if (matched) {
      setFormAmount(String(matched.amount));
      const d = new Date(matched.paidAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setFormPaidAt(localStr);
      setFormMethod(matched.method);
      setFormStatus(matched.status);
      setFormReference(matched.reference ?? '');
      setFormNotes(matched.notes ?? '');
    } else {
      const rider = ridersList.find(r => r.id === riderId);
      const leaseRate = rider?.leaseDailyRate ?? DAILY_LEASE_RATE;
      setFormAmount(String(leaseRate));
      setFormPaidAt(`${dateString}T12:00`);
      setFormMethod('CASH');
      setFormStatus('PAID');
      setFormReference('');
      setFormNotes('');
    }

    setShowCollectModal(true);
  };

  // Helper to check payment on a matrix day
  const getMatrixCellStatus = (riderId: string, dateString: string) => {
    const matched = weekPayments.find(
      (p) => p.riderId === riderId && p.paidAt.slice(0, 10) === dateString,
    );
    if (!matched) return 'unpaid';
    return matched.status.toLowerCase();
  };

  // Professional CSV/Excel Export helper
  const handleExportCSV = () => {
    if (paymentsList.length === 0) return;
    const headers = [
      'Rider Name',
      'Email Address',
      'Phone Number',
      'Amount Collected (RWF)',
      'Payment Date',
      'Payment Method',
      'Payment Status',
      'Reference Code',
      'Notes',
    ];
    
    const rows = paymentsList.map((p) => {
      const date = new Date(p.paidAt);
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      const friendlyMethod = p.method.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      const friendlyStatus = p.status.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

      return [
        p.riderName,
        p.riderEmail ?? '',
        p.riderPhone ?? '',
        p.amount,
        formattedDate,
        friendlyMethod,
        friendlyStatus,
        p.reference ?? '',
        p.notes ?? '',
      ];
    });

    // Excel UTF-8 BOM prefix
    const BOM = '\uFEFF';
    const csvString = [headers.join(','), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fleet_collections_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRecordPaymentSubmit = () => {
    if (!formRiderId) {
      setCollectError(t('Please select a rider.'));
      return;
    }
    if (isRiderUnassignedLease) {
      setCollectError(t('Cannot collect lease fees for a rider who is not assigned to a bike.'));
      return;
    }
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCollectError(t('Please input a valid amount greater than zero.'));
      return;
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

  if (currentUser && currentUser.fleetType === 'DELIVERY') {
    return <DeliveryFinancialsView />;
  }

  if (currentUser && currentUser.fleetType !== 'COOP') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle size={48} className="text-amber-500 animate-bounce" />
        <h1 className="text-lg font-bold text-ink">{t('Access Denied')}</h1>
        <p className="text-sm text-ink-muted">{t('Financial management features are only available for Cooperative fleets.')}</p>
      </div>
    );
  }

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
                  <div className="h-[180px] w-full bg-surface-hover rounded-xl animate-pulse" />
                ) : summary && summary.dailyEarnings.length > 0 ? (
                  <div className="space-y-3">
                    <div className="h-[180px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={summary.dailyEarnings}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="date"
                            tickFormatter={(str) => {
                              const d = new Date(str);
                              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            }}
                            stroke="rgba(255,255,255,0.08)"
                            tick={{ fill: 'var(--color-ink-muted, #94A3B8)', fontSize: 10 }}
                          />
                          <YAxis
                            stroke="rgba(255,255,255,0.08)"
                            tick={{ fill: 'var(--color-ink-muted, #94A3B8)', fontSize: 10 }}
                            tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                          />
                          <ChartTooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { date: string; amount: number };
                                return (
                                  <div className="rounded-xl border border-line bg-surface p-2.5 shadow-xl text-[10px] leading-none text-ink">
                                    <p className="font-semibold text-ink-muted">
                                      {new Date(data.date).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </p>
                                    <p className="font-mono font-bold text-accent text-xs mt-1">
                                      {data.amount.toLocaleString()} RWF
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#chartGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-ink-muted px-2 border-t border-line/20 pt-2">
                      <span>{new Date(startDate).toLocaleDateString()}</span>
                      <span className="font-medium text-ink-soft">{t("Daily Revenue Stream")}</span>
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
                  <div className="space-y-4">
                    {/* Search & Tabs Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-muted/40 p-2.5 rounded-xl border border-line/50">
                      {/* Tabs selector */}
                      <div className="flex rounded-lg bg-surface-muted p-0.5 border border-line w-fit">
                        <button
                          type="button"
                          onClick={() => setMatrixTab('daily')}
                          className={cx(
                            'rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer',
                            matrixTab === 'daily'
                              ? 'bg-surface text-ink shadow-sm'
                              : 'text-ink-muted hover:text-ink'
                          )}
                        >
                          {t('Daily Collections')} ({dailyCollectionRiders.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatrixTab('lease')}
                          className={cx(
                            'rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer',
                            matrixTab === 'lease'
                              ? 'bg-surface text-ink shadow-sm'
                              : 'text-ink-muted hover:text-ink'
                          )}
                        >
                          {t('Buy-to-Own Leases')} ({buyToOwnRiders.length})
                        </button>
                      </div>

                      {/* Search box */}
                      <div className="relative max-w-xs w-full">
                        <span className="absolute inset-y-0 left-2.5 flex items-center text-ink-faint pointer-events-none">
                          <Search size={12} />
                        </span>
                        <input
                          type="text"
                          placeholder={t('Search rider by name, phone...')}
                          value={matrixSearch}
                          onChange={(e) => setMatrixSearch(e.target.value)}
                          className="w-full rounded-lg border border-line bg-surface pl-8 pr-7 py-1 text-xs text-ink placeholder-ink-faint focus:outline-none focus:border-accent"
                        />
                        {matrixSearch && (
                          <button
                            type="button"
                            onClick={() => setMatrixSearch('')}
                            className="absolute inset-y-0 right-2.5 flex items-center text-ink-faint hover:text-ink"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Matrix Table */}
                    {activeMatrixRiders.length === 0 ? (
                      <EmptyState
                        icon={<Users size={16} />}
                        title={t("No matching riders found")}
                        description={t("Try refining your search query or switching tabs.")}
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
                            {activeMatrixRiders.map((rider) => (
                              <tr key={rider.id} className="border-b border-line hover:bg-surface-hover transition-colors">
                                <td className="py-3 font-semibold text-ink">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent text-[10px] font-bold">
                                      {(rider.fullName ?? 'U').charAt(0).toUpperCase()}
                                    </span>
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate max-w-[120px] font-semibold">
                                        {rider.fullName ?? t('Rider {id}').replace('{id}', rider.id.slice(0, 8))}
                                      </span>
                                      <span className="text-[10px] text-ink-muted leading-tight font-normal">
                                        {rider.phone ?? rider.email ?? ''}
                                      </span>
                                    </div>
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
                    {/* Recharts PieChart */}
                    <div className="relative h-32 w-32 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(summary.methodBreakdown).map(([method, amount]) => {
                              let color = '#94A3B8';
                              if (method === 'CASH') color = '#F59E0B';
                              if (method === 'MOBILE_MONEY') color = '#10B981';
                              if (method === 'BANK_TRANSFER') color = '#3B82F6';
                              return { name: method, value: amount, color };
                            })}
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={46}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {Object.entries(summary.methodBreakdown).map(([method, amount]) => {
                              let color = '#94A3B8';
                              if (method === 'CASH') color = '#F59E0B';
                              if (method === 'MOBILE_MONEY') color = '#10B981';
                              if (method === 'BANK_TRANSFER') color = '#3B82F6';
                              return <Cell key={`cell-${method}`} fill={color} />;
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider">{t("Total")}</span>
                        <span className="text-[10px] font-bold text-ink leading-none text-center max-w-[80px] truncate">
                          {summary.totalEarnedRange.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>

                    {/* Legends */}
                    <div className="grid gap-2 text-xs">
                      {Object.entries(summary.methodBreakdown).map(([method, val]) => {
                        let dotColor = 'bg-slate-400';
                        if (method === 'CASH') dotColor = 'bg-amber-500';
                        if (method === 'MOBILE_MONEY') dotColor = 'bg-emerald-500';
                        if (method === 'BANK_TRANSFER') dotColor = 'bg-blue-500';

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
                          const pct = lease.totalPrincipal > 0 ? Math.min(100, Math.max(0, Math.round((lease.totalPaid / lease.totalPrincipal) * 100))) : 0;
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
                                  role="progressbar"
                                  aria-valuenow={pct}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setFormRiderId(val);
                  if (val && formPaidAt) {
                    const dateString = formPaidAt.slice(0, 10);
                    const matched = weekPayments.find(
                      (p) => p.riderId === val && p.paidAt.slice(0, 10) === dateString,
                    );
                    if (matched) {
                      setFormAmount(String(matched.amount));
                      setFormMethod(matched.method);
                      setFormStatus(matched.status);
                      setFormReference(matched.reference ?? '');
                      setFormNotes(matched.notes ?? '');
                    } else {
                      const r = ridersList.find(r => r.id === val);
                      setFormAmount(String(r?.leaseDailyRate ?? DAILY_LEASE_RATE));
                      setFormMethod('CASH');
                      setFormStatus('PAID');
                      setFormReference('');
                      setFormNotes('');
                    }
                  } else {
                    resetForm();
                  }
                }}
              >
                <option value="">{t("-- Select Rider --")}</option>
                {ridersList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} ({r.phone ?? r.email ?? t('No contact info')})
                  </option>
                ))}
              </SelectField>

              {isRiderUnassignedLease && (
                <InlineNotice
                  message={t("This rider is registered under a Lease-to-Own plan but currently has no active bike assigned. Lease fees cannot be collected until a bike is assigned.")}
                  tone="warning"
                />
              )}

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
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormPaidAt(val);
                    if (formRiderId && val) {
                      const dateString = val.slice(0, 10);
                      const matched = weekPayments.find(
                        (p) => p.riderId === formRiderId && p.paidAt.slice(0, 10) === dateString,
                      );
                      if (matched) {
                        setFormAmount(String(matched.amount));
                        setFormMethod(matched.method);
                        setFormStatus(matched.status);
                        setFormReference(matched.reference ?? '');
                        setFormNotes(matched.notes ?? '');
                      } else {
                        const r = ridersList.find(r => r.id === formRiderId);
                        setFormAmount(String(r?.leaseDailyRate ?? DAILY_LEASE_RATE));
                        setFormMethod('CASH');
                        setFormStatus('PAID');
                        setFormReference('');
                        setFormNotes('');
                      }
                    }
                  }}
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
                disabled={recordPaymentMutation.isPending || isRiderUnassignedLease}
                onClick={handleRecordPaymentSubmit}
                style={{ backgroundColor: '#3B82F6', color: '#ffffff' }}
                className="inline-flex items-center gap-1.5 rounded-xl font-semibold px-5 py-2.5 text-sm hover:opacity-90 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

function DeliveryFinancialsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ['delivery-summary'],
    queryFn: () =>
      apiFetch<{
        totalPending: number;
        totalPaid: number;
        deliveryCount: number;
        avgCommission: number;
      }>('/financials/delivery/summary'),
  });

  const payoutsQuery = useQuery({
    queryKey: ['delivery-payouts'],
    queryFn: () =>
      apiFetch<
        Array<{
          id: string;
          riderId: string;
          riderName: string;
          riderPhone: string;
          amount: number;
          paidAt: string;
          status: 'PAID' | 'UNPAID';
          notes: string;
          reference: string;
        }>
      >('/financials/delivery/payouts'),
  });

  const payoutMutation = useMutation({
    mutationFn: (riderId: string) =>
      apiFetch('/financials/delivery/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-payouts'] });
    },
  });

  const summary = summaryQuery.data || { totalPending: 0, totalPaid: 0, deliveryCount: 0, avgCommission: 0 };
  const payouts = payoutsQuery.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white">{t('Delivery Financials')}</h2>
        <p className="text-xs text-ink-muted">{t('Track courier delivery commissions, pending balances, and process mobile money payouts.')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('Pending Payouts')}
          value={`${summary.totalPending.toLocaleString()} RWF`}
          icon={<Wallet size={20} className="text-amber-500" />}
          hint={t('Accrued commissions not yet paid out')}
        />
        <MetricCard
          title={t('Total Paid')}
          value={`${summary.totalPaid.toLocaleString()} RWF`}
          icon={<Coins size={20} className="text-green-500" />}
          hint={t('Commissions successfully paid to riders')}
        />
        <MetricCard
          title={t('Completed Deliveries')}
          value={String(summary.deliveryCount)}
          icon={<Banknote size={20} className="text-blue-500" />}
          hint={t('Total packages successfully delivered')}
        />
        <MetricCard
          title={t('Avg Commission')}
          value={`${Math.round(summary.avgCommission).toLocaleString()} RWF`}
          icon={<TrendingUp size={20} className="text-purple-500" />}
          hint={t('Average commission earnings per package')}
        />
      </div>

      <DashboardCard title={t('Courier Payouts Ledger')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line text-ink-muted uppercase tracking-wider text-[10px] font-bold">
                <th className="px-6 py-4">{t('Date')}</th>
                <th className="px-6 py-4">{t('Courier')}</th>
                <th className="px-6 py-4">{t('Details')}</th>
                <th className="px-6 py-4">{t('Commission')}</th>
                <th className="px-6 py-4">{t('Status')}</th>
                <th className="px-6 py-4 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-ink-muted">
                    {t('No payout or commission records found.')}
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 text-white font-mono">
                      {new Date(p.paidAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{p.riderName}</div>
                      <div className="text-[10px] text-ink-muted">{p.riderPhone}</div>
                    </td>
                    <td className="px-6 py-4 text-ink-muted">{p.notes}</td>
                    <td className="px-6 py-4 font-bold text-white">{p.amount.toLocaleString()} RWF</td>
                    <td className="px-6 py-4">
                      {p.status === 'PAID' ? (
                        <Badge label={t('Paid')} tone="success" />
                      ) : (
                        <Badge label={t('Pending')} tone="warning" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {p.status === 'UNPAID' && (
                        <button
                          onClick={() => payoutMutation.mutate(p.riderId)}
                          disabled={payoutMutation.isPending}
                          className="rounded-lg bg-accent px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-accent/80 disabled:opacity-50"
                        >
                          {payoutMutation.isPending ? t('Processing...') : t('Pay Out')}
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
    </div>
  );
}
