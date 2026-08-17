'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Clipboard,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  UserCheck,
  MapPin,
  FileText,
  User,
  Phone,
  Copy,
  Check,
  Navigation,
  AlertTriangle,
  Search,
  Award,
  Activity,
  TrendingUp,
  Flame,
  Zap,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { apiFetch } from '@/lib/api/client';
import { cx, formatTimestamp } from '@/lib/ui';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';

interface Delivery {
  id: string;
  orderNumber: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  customerName: string;
  customerPhone: string;
  status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  notes?: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  proofPhotoUrl?: string;
  proofSignature?: string;
  createdAt: string;
  rider?: {
    id: string;
    email: string | null;
    phone: string | null;
    riderProfile?: {
      fullName: string;
    } | null;
  } | null;
}

interface Rider {
  id: string;
  email: string | null;
  phone: string | null;
  riderProfile?: {
    fullName: string;
  } | null;
}

export default function DeliveriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const [now] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED'>('ALL');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Delivery | null>(null);
  const [statusTarget, setStatusTarget] = useState<Delivery | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'registry' | 'analytics'>('registry');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for creating delivery
  const [orderNumber, setOrderNumber] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('-1.9441');
  const [pickupLng, setPickupLng] = useState('30.0899');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState('-1.9398');
  const [dropoffLng, setDropoffLng] = useState('30.0532');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Status simulation form states
  const [simulatedStatus, setSimulatedStatus] = useState<'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED'>('PICKED_UP');
  const [failureReason, setFailureReason] = useState('');
  const [simulatedNotes, setSimulatedNotes] = useState('');

  // Queries
  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ['deliveries'],
    queryFn: () => apiFetch('/deliveries'),
  });

  const { data: ridersData } = useQuery<{ data: Rider[] }>({
    queryKey: ['riders-list'],
    queryFn: () => apiFetch('/riders?pageSize=100'),
    enabled: !!currentUser,
  });

  const riders = ridersData?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newDelivery: Record<string, unknown>) =>
      apiFetch('/deliveries', {
        method: 'POST',
        body: JSON.stringify(newDelivery),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err: unknown) => {
      const apiErr = err as { message?: string };
      setFormError(apiErr.message || 'Failed to create delivery');
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ deliveryId, riderId }: { deliveryId: string; riderId: string }) =>
      apiFetch(`/deliveries/${deliveryId}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ riderId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setAssignTarget(null);
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch(`/deliveries/${deliveryId}/auto-assign`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setAssignTarget(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ deliveryId, payload }: { deliveryId: string; payload: Record<string, unknown> }) =>
      apiFetch(`/deliveries/${deliveryId}/status`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setStatusTarget(null);
      resetStatusForm();
    },
  });

  const resetCreateForm = () => {
    setOrderNumber('');
    setPickupAddress('');
    setPickupLat('-1.9441');
    setPickupLng('30.0899');
    setDropoffAddress('');
    setDropoffLat('-1.9398');
    setDropoffLng('30.0532');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setFormError('');
  };

  const resetStatusForm = () => {
    setSimulatedStatus('PICKED_UP');
    setFailureReason('');
    setSimulatedNotes('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!orderNumber || !pickupAddress || !dropoffAddress || !customerName || !customerPhone) {
      setFormError('All fields marked as required are mandatory.');
      return;
    }

    createMutation.mutate({
      orderNumber,
      pickupAddress,
      pickupLat: parseFloat(pickupLat) || -1.9441,
      pickupLng: parseFloat(pickupLng) || 30.0899,
      dropoffAddress,
      dropoffLat: parseFloat(dropoffLat) || -1.9398,
      dropoffLng: parseFloat(dropoffLng) || 30.0532,
      customerName,
      customerPhone,
      notes: notes || undefined,
    });
  };

  const handleCopyLink = (deliveryId: string) => {
    const trackingLink = `${window.location.origin}/track/${deliveryId}`;
    navigator.clipboard.writeText(trackingLink);
    setCopiedId(deliveryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics calculations
  const pendingCount = deliveries.filter((d) => d.status === 'PENDING').length;
  const activeCount = deliveries.filter((d) => ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)).length;
  const completedCount = deliveries.filter((d) => d.status === 'DELIVERED').length;
  const failedCount = deliveries.filter((d) => d.status === 'FAILED').length;

  const filteredDeliveries = deliveries.filter((d) => {
    // Search query filtering
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchesSearch =
        d.orderNumber.toLowerCase().includes(query) ||
        d.customerName.toLowerCase().includes(query) ||
        d.customerPhone.toLowerCase().includes(query) ||
        d.pickupAddress.toLowerCase().includes(query) ||
        d.dropoffAddress.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (activeTab === 'PENDING') return d.status === 'PENDING';
    if (activeTab === 'ACTIVE') return ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status);
    if (activeTab === 'COMPLETED') return d.status === 'DELIVERED';
    if (activeTab === 'FAILED') return d.status === 'FAILED';
    return true;
  });

  // SLA Calculations
  const completedDeliveries = deliveries.filter((d) => d.status === 'DELIVERED' && d.assignedAt && d.deliveredAt);
  const slaMet = completedDeliveries.filter((d) => {
    const assigned = new Date(d.assignedAt!).getTime();
    const delivered = new Date(d.deliveredAt!).getTime();
    const diffMins = (delivered - assigned) / (1000 * 60);
    return diffMins <= 30; // 30 min SLA
  }).length;
  const slaRate = completedDeliveries.length > 0 ? ((slaMet / completedDeliveries.length) * 100).toFixed(1) : '100.0';

  const totalTransitMins = completedDeliveries.reduce((sum, d) => {
    const assigned = new Date(d.assignedAt!).getTime();
    const delivered = new Date(d.deliveredAt!).getTime();
    return sum + (delivered - assigned) / (1000 * 60);
  }, 0);
  const avgDeliveryTime = completedDeliveries.length > 0 ? (totalTransitMins / completedDeliveries.length).toFixed(0) : '0';

  const activeSlaBreaching = deliveries.filter((d) => {
    if (!['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status) || !d.assignedAt) return false;
    const duration = (now - new Date(d.assignedAt).getTime()) / (1000 * 60);
    return duration > 30;
  });

  // Top Couriers
  const topCouriers = (() => {
    const courierMap: Record<string, { name: string; phone: string; count: number; totalTime: number }> = {};
    completedDeliveries.forEach((d) => {
      if (!d.rider) return;
      const riderId = d.rider.id;
      const riderName = d.rider.riderProfile?.fullName || 'Unknown Rider';
      const riderPhone = d.rider.phone || 'No Phone';
      const duration = (new Date(d.deliveredAt!).getTime() - new Date(d.assignedAt!).getTime()) / (1000 * 60);
      
      if (!courierMap[riderId]) {
        courierMap[riderId] = { name: riderName, phone: riderPhone, count: 0, totalTime: 0 };
      }
      courierMap[riderId].count += 1;
      courierMap[riderId].totalTime += duration;
    });

    return Object.values(courierMap)
      .map((c) => ({
        ...c,
        avgTime: (c.totalTime / c.count).toFixed(0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();

  // 7 Days Volume Trend
  const last7DaysData = (() => {
    const data: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      data[dateString] = 0;
    }

    deliveries.forEach((d) => {
      const dateString = new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (dateString in data) {
        data[dateString] += 1;
      }
    });

    return Object.entries(data).map(([label, value]) => ({ label, value }));
  })();

  const svgChart = (() => {
    const data = last7DaysData;
    const maxVal = Math.max(...data.map((d) => d.value), 5);
    const height = 120;
    const width = 600;
    const padding = 20;

    const xStep = (width - padding * 2) / (data.length - 1);
    const coords = data.map((d, index) => {
      const x = padding + index * xStep;
      const y = height - padding - (d.value / maxVal) * (height - padding * 2);
      return { x, y };
    });

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      path += ` L ${coords[i].x} ${coords[i].y}`;
    }

    const closedPath = `${path} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
    return { linePath: path, areaPath: closedPath, points: coords };
  })();

  if (currentUser && currentUser.fleetType !== 'DELIVERY') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle size={48} className="text-amber-500 animate-bounce" />
        <h1 className="text-lg font-bold text-ink">{t('Access Denied')}</h1>
        <p className="text-sm text-ink-muted">{t('Delivery features are only available for Delivery fleets.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Deliveries Management')}</h2>
          <p className="text-xs text-ink-muted">{t('Dispatch orders, track live couriers, and monitor SLAs.')}</p>
        </div>
        <div className="flex bg-surface-muted border border-line rounded-2xl p-1 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('registry')}
            className={cx(
              'rounded-xl px-4 py-2 text-xs font-bold transition-all',
              viewMode === 'registry' ? 'bg-accent text-ink' : 'text-ink-muted hover:text-ink'
            )}
          >
            {t('tab_registry', 'Registry')}
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={cx(
              'rounded-xl px-4 py-2 text-xs font-bold transition-all',
              viewMode === 'analytics' ? 'bg-accent text-ink' : 'text-ink-muted hover:text-ink'
            )}
          >
            {t('tab_analytics', 'Analytics & SLA')}
          </button>
        </div>
      </div>

      {viewMode === 'registry' ? (
        <>
          {/* Metrics Row */}
          <div className="grid gap-6 md:grid-cols-4">
            <MetricCard
              title={t('metric_deliveries_pending', 'Pending Assignment')}
              value={String(pendingCount)}
              hint={t('hint_pending_deliveries', 'Orders waiting for dispatcher assignment')}
              icon={<Clock size={20} />}
              tone="warning"
            />
            <MetricCard
              title={t('metric_deliveries_active', 'Active Deliveries')}
              value={String(activeCount)}
              hint={t('hint_active_deliveries', 'Deliveries currently in progress')}
              icon={<Truck size={20} />}
              tone="info"
            />
            <MetricCard
              title={t('metric_deliveries_completed', 'Completed Today')}
              value={String(completedCount)}
              hint={t('hint_completed_deliveries', 'Successfully completed dropoffs')}
              icon={<CheckCircle2 size={20} />}
              tone="success"
            />
            <MetricCard
              title={t('metric_deliveries_failed', 'Failed Deliveries')}
              value={String(failedCount)}
              hint={t('hint_failed_deliveries', 'Canceled or unsuccessful delivery runs')}
              icon={<XCircle size={20} />}
              tone="danger"
            />
          </div>

          {/* Main Panel */}
          <DashboardCard
            title={t('delivery_registry', 'Delivery Registry')}
            description={t('delivery_registry_desc', 'Track dispatch requests, assign riders, and monitor active deliveries.')}
            actions={
              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-ink hover:bg-accent-hover transition-colors shadow-lg shadow-accent/15"
              >
                <Plus size={16} />
                {t('btn_add_delivery', 'Add Delivery')}
              </button>
            }
          >
            {/* Search query input */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                placeholder={t('search_deliveries_placeholder', 'Search by order number, customer, or address...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-muted pl-11 pr-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
              />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-line mb-6">
              {(['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'FAILED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cx(
                    'px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all',
                    activeTab === tab
                      ? 'border-accent text-accent'
                      : 'border-transparent text-ink-muted hover:text-ink hover:border-line'
                  )}
                >
                  {t(`tab_delivery_${tab.toLowerCase()}`, tab)}
                </button>
              ))}
            </div>

            {/* Deliveries Table */}
            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-card p-6 text-center">
                <Package className="h-10 w-10 text-ink-muted mb-3" />
                <p className="text-sm font-bold text-ink">{t('no_deliveries_found', 'No Deliveries Found')}</p>
                <p className="text-xs text-ink-muted mt-1">
                  {t('no_deliveries_found_desc', 'No delivery records match the current filter.')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-ink">
                  <thead>
                    <tr className="border-b border-line text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted">
                      <th className="px-6 py-4">{t('col_order_number', 'Order #')}</th>
                      <th className="px-6 py-4">{t('col_customer', 'Customer')}</th>
                      <th className="px-6 py-4">{t('col_pickup', 'Pickup')}</th>
                      <th className="px-6 py-4">{t('col_dropoff', 'Dropoff')}</th>
                      <th className="px-6 py-4">{t('col_assigned_rider', 'Assigned Rider')}</th>
                      <th className="px-6 py-4">{t('col_status', 'Status')}</th>
                      <th className="px-6 py-4 text-right">{t('col_actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredDeliveries.map((delivery) => (
                      <tr key={delivery.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-ink">
                          {delivery.orderNumber}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{delivery.customerName}</div>
                          <div className="text-xs text-ink-muted">{delivery.customerPhone}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate" title={delivery.pickupAddress}>
                          {delivery.pickupAddress}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate" title={delivery.dropoffAddress}>
                          {delivery.dropoffAddress}
                        </td>
                        <td className="px-6 py-4">
                          {delivery.rider?.riderProfile?.fullName ? (
                            <div className="flex items-center gap-2 font-bold text-accent">
                              <User size={14} />
                              {delivery.rider.riderProfile.fullName}
                            </div>
                          ) : (
                            <span className="text-ink-muted italic text-xs">{t('unassigned', 'Unassigned')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cx(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                              delivery.status === 'PENDING' && 'bg-amber-500/10 text-amber-400',
                              delivery.status === 'ASSIGNED' && 'bg-blue-500/10 text-blue-400',
                              delivery.status === 'PICKED_UP' && 'bg-purple-500/10 text-purple-400',
                              delivery.status === 'IN_TRANSIT' && 'bg-cyan-500/10 text-cyan-400',
                              delivery.status === 'DELIVERED' && 'bg-emerald-500/10 text-emerald-400',
                              delivery.status === 'FAILED' && 'bg-rose-500/10 text-rose-400'
                            )}
                          >
                            {t(`delivery_status_${delivery.status}`, delivery.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Copy Link Action */}
                            <button
                              onClick={() => handleCopyLink(delivery.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-muted hover:text-ink transition-all"
                              title={t('copy_tracking_link', 'Copy Customer Tracking Link')}
                            >
                              {copiedId === delivery.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            </button>

                            {/* Public Link Action */}
                            <a
                              href={`/track/${delivery.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-muted hover:text-ink transition-all"
                              title={t('view_live_tracking', 'Open Live Tracking Page')}
                            >
                              <Navigation size={16} />
                            </a>

                            {/* Assign Rider Trigger */}
                            {delivery.status === 'PENDING' && (
                              <button
                                onClick={() => setAssignTarget(delivery)}
                                className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20 transition-all"
                              >
                                <UserCheck size={14} />
                                {t('btn_assign', 'Assign')}
                              </button>
                            )}

                            {/* Update Status Trigger */}
                            {['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(delivery.status) && (
                              <button
                                onClick={() => {
                                  setStatusTarget(delivery);
                                  if (delivery.status === 'ASSIGNED') setSimulatedStatus('PICKED_UP');
                                  else if (delivery.status === 'PICKED_UP') setSimulatedStatus('IN_TRANSIT');
                                  else setSimulatedStatus('DELIVERED');
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20 transition-all"
                              >
                                <Truck size={14} />
                                {t('btn_update', 'Update')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardCard>
        </>
      ) : (
        /* Analytics View */
        <div className="space-y-6 animate-fade-in">
          {/* Active SLA Breach Warnings */}
          {activeSlaBreaching.length > 0 && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-sm font-bold text-white">{t('sla_breach_warning', 'Active SLA Breach Warnings')}</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    {t('sla_breach_desc', 'The following active deliveries have exceeded the 30-minute SLA threshold:')}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {activeSlaBreaching.map((d) => {
                      const activeMins = ((now - new Date(d.assignedAt!).getTime()) / (1000 * 60)).toFixed(0);
                      return (
                        <li key={d.id} className="text-xs font-semibold text-rose-300">
                          &bull; Order <span className="font-mono">{d.orderNumber}</span> &middot; Assigned to <span className="font-bold text-white">{d.rider?.riderProfile?.fullName || 'Courier'}</span> &middot; Active for <span className="underline">{activeMins} mins</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Key KPI Cards */}
          <div className="grid gap-6 md:grid-cols-3">
            <MetricCard
              title={t('metric_sla_compliance', 'SLA Fulfillment Rate')}
              value={`${slaRate}%`}
              hint={t('hint_sla_compliance', 'Percentage of completed orders delivered within 30 minutes')}
              icon={<Award size={20} />}
              tone={parseFloat(slaRate) >= 90 ? 'success' : parseFloat(slaRate) >= 70 ? 'warning' : 'danger'}
            />
            <MetricCard
              title={t('metric_avg_delivery_time', 'Avg Delivery Duration')}
              value={`${avgDeliveryTime} mins`}
              hint={t('hint_avg_delivery_time', 'Average transit duration from dispatch assignment to dropoff')}
              icon={<Activity size={20} />}
              tone="info"
            />
            <MetricCard
              title={t('metric_total_deliveries', 'Historical Volume')}
              value={String(deliveries.length)}
              hint={t('hint_total_deliveries', 'Total number of dispatch records registered')}
              icon={<TrendingUp size={20} />}
              tone="neutral"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Chart Card */}
            <div className="lg:col-span-8 rounded-2xl border border-line bg-surface-card p-6">
              <h3 className="text-sm font-bold text-white mb-1">{t('delivery_volume_trend', 'Delivery Volume Trend')}</h3>
              <p className="text-xs text-ink-muted mb-6">{t('volume_trend_desc', 'Daily volume of registered deliveries over the past 7 days.')}</p>

              <div className="relative h-[150px] w-full mt-4">
                <svg viewBox="0 0 600 120" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2="580" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="20" y1="60" x2="580" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  <line x1="20" y1="100" x2="580" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                  {/* Gradient Area */}
                  {svgChart.areaPath && (
                    <path d={svgChart.areaPath} fill="url(#areaGrad)" />
                  )}

                  {/* Stroke Line */}
                  {svgChart.linePath && (
                    <path d={svgChart.linePath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                  )}

                  {/* Data Points */}
                  {svgChart.points.map((pt, idx) => (
                    <g key={idx}>
                      <circle cx={pt.x} cy={pt.y} r="4" fill="#0ea5e9" className="transition-all hover:r-6 cursor-pointer" />
                      <text x={pt.x} y="118" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle" fontWeight="bold">
                        {last7DaysData[idx]?.label}
                      </text>
                      <text x={pt.x} y={pt.y - 8} fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">
                        {last7DaysData[idx]?.value}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Courier Leaderboard */}
            <div className="lg:col-span-4 rounded-2xl border border-line bg-surface-card p-6">
              <h3 className="text-sm font-bold text-white mb-1">{t('top_performing_couriers', 'Top Performing Couriers')}</h3>
              <p className="text-xs text-ink-muted mb-6">{t('top_couriers_desc', 'Riders ranked by volume & efficiency.')}</p>

              {topCouriers.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Flame className="h-6 w-6 text-ink-muted mb-2" />
                  <p className="text-xs text-ink-muted">{t('no_courier_rankings', 'No courier analytics available yet')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topCouriers.map((courier, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-line/40 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-accent font-bold text-[10px]">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white">{courier.name}</p>
                          <p className="text-[10px] text-ink-muted mt-0.5">{courier.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-accent">{courier.count} {t('trips_count', 'deliveries')}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{t('avg_time_label', 'Avg:')} {courier.avgTime} {t('minutes_abbreviation', 'm')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD DELIVERY MODAL ─── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-[24px] border border-line bg-surface shadow-2xl overflow-hidden cursor-default">
            
            {/* Header: fixed */}
            <div className="flex items-center justify-between border-b border-line p-5 shrink-0">
              <h3 className="font-display text-lg font-bold text-ink">{t('modal_add_delivery_title', 'Create Delivery Request')}</h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Form & Body: scrollable */}
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0 m-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 dashboard-scrollbar">
                {formError && <div className="rounded-lg bg-danger-soft border border-danger-ink/20 p-3 text-xs font-semibold text-danger-ink">{formError}</div>}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_order_number', 'Order Number')} *</label>
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="ORD-10020"
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_customer_name', 'Customer Name')} *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_customer_phone', 'Customer Phone')} *</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                    required
                  />
                </div>

                <div className="space-y-3 border-t border-line/50 pt-3">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-wider">{t('pickup_details', 'Pickup Point')}</h4>
                  <div>
                    <label className="block text-xs text-ink-muted mb-1">{t('label_pickup_address', 'Address')} *</label>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Kigali Heights, KG 7 Ave"
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">{t('label_latitude', 'Latitude')}</label>
                      <input
                        type="text"
                        value={pickupLat}
                        onChange={(e) => setPickupLat(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2 text-xs font-mono text-ink focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">{t('label_longitude', 'Longitude')}</label>
                      <input
                        type="text"
                        value={pickupLng}
                        onChange={(e) => setPickupLng(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2 text-xs font-mono text-ink focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-line/50 pt-3">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-wider">{t('dropoff_details', 'Dropoff Point')}</h4>
                  <div>
                    <label className="block text-xs text-ink-muted mb-1">{t('label_dropoff_address', 'Address')} *</label>
                    <input
                      type="text"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      placeholder="Nyabugogo Bus Station"
                      className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">{t('label_latitude', 'Latitude')}</label>
                      <input
                        type="text"
                        value={dropoffLat}
                        onChange={(e) => setDropoffLat(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2 text-xs font-mono text-ink focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-muted mb-1">{t('label_longitude', 'Longitude')}</label>
                      <input
                        type="text"
                        value={dropoffLng}
                        onChange={(e) => setDropoffLng(e.target.value)}
                        className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2 text-xs font-mono text-ink focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_notes', 'Order Notes')}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Extra dropoff instructions..."
                    className="w-full h-20 rounded-xl border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none resize-none placeholder:text-ink-faint"
                  />
                </div>
              </div>

              {/* Action buttons: fixed at bottom */}
              <div className="flex gap-4 border-t border-line p-5 shrink-0 bg-surface-muted">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold text-ink hover:bg-surface-hover"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-strong disabled:opacity-50 transition-all"
                >
                  {createMutation.isPending ? t('saving', 'Saving...') : t('btn_create_request', 'Create Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ASSIGN RIDER MODAL ─── */}
      {assignTarget && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0" onClick={() => setAssignTarget(null)} />
          <div className="relative w-full max-w-sm rounded-[24px] border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink mb-2">{t('modal_assign_rider_title', 'Assign Rider')}</h3>
            <p className="text-xs text-ink-muted mb-4">
              {t('modal_assign_rider_desc', 'Choose a rider to assign to order')} <span className="font-bold text-ink">{assignTarget.orderNumber}</span>.
            </p>

            <button
              onClick={() => autoAssignMutation.mutate(assignTarget.id)}
              disabled={autoAssignMutation.isPending}
              className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-ink transition hover:bg-accent-strong disabled:opacity-50"
            >
              {autoAssignMutation.isPending ? (
                <span>{t('auto_assigning', 'Auto-Assigning...')}</span>
              ) : (
                <>
                  <Zap size={14} />
                  <span>{t('auto_assign_closest', 'Auto-Assign Closest Rider')}</span>
                </>
              )}
            </button>

            <div className="border-t border-line my-4 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-bold">
                {t('or_assign_manually', 'Or Assign Manually')}
              </p>
            </div>

            {riders.length === 0 ? (
              <p className="text-sm font-semibold text-rose-400 my-4 text-center">{t('no_active_riders_found', 'No active riders registered in your fleet')}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6 pr-1 dashboard-scrollbar">
                {riders.map((rider) => (
                  <button
                    key={rider.id}
                    onClick={() => assignMutation.mutate({ deliveryId: assignTarget.id, riderId: rider.id })}
                    disabled={assignMutation.isPending}
                    className="w-full flex items-center justify-between rounded-xl border border-line bg-surface-muted px-4 py-3 hover:bg-surface-hover hover:border-accent text-left transition-all"
                  >
                    <div>
                      <div className="font-bold text-ink">{rider.riderProfile?.fullName || 'Unnamed Rider'}</div>
                      <div className="text-[10px] text-ink-muted font-mono">{rider.email || rider.phone}</div>
                    </div>
                    <UserCheck size={16} className="text-accent" />
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setAssignTarget(null)}
              className="w-full rounded-xl border border-line bg-surface-muted py-3 text-sm font-bold text-ink hover:bg-surface-hover"
            >
              {t('cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ─── SIMULATE STATUS UPDATE MODAL ─── */}
      {statusTarget && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0" onClick={() => setStatusTarget(null)} />
          <div className="relative w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-ink mb-2">{t('modal_update_status_title', 'Update Delivery Status')}</h3>
            <p className="text-xs text-ink-muted mb-4">
              {t('modal_update_status_desc', 'Simulate rider status updates for')} <span className="font-bold text-ink">{statusTarget.orderNumber}</span>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const payload: {
                  status: string;
                  notes?: string;
                  proofPhotoUrl?: string;
                  proofSignature?: string;
                  failureReason?: string;
                } = {
                  status: simulatedStatus,
                  notes: simulatedNotes || undefined,
                };
                if (simulatedStatus === 'DELIVERED') {
                  if (process.env.NODE_ENV === 'development') {
                    // Simulate proof photo and signature
                    payload.proofPhotoUrl = 'https://picsum.photos/400/300';
                    payload.proofSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAt0lEQVR42u3YwQnCQBQF0HMtN9FArMTQyhy0C8sY2ogX1sIs3ESFIIgP7oH/eTCDYQcWTpL/k4wREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREXm1wAMA/r7P1eZz6m4AAAAASUVORK5CYII=';
                  }
                }
                if (simulatedStatus === 'FAILED') {
                  payload.failureReason = failureReason || 'Unreachable customer';
                }

                if (statusTarget) {
                  updateStatusMutation.mutate({ deliveryId: statusTarget.id, payload });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_new_status', 'Status')}</label>
                <select
                  value={simulatedStatus}
                  onChange={(e) => setSimulatedStatus(e.target.value as typeof simulatedStatus)}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
                >
                  <option value="PICKED_UP">{t('delivery_status_PICKED_UP', 'Picked Up')}</option>
                  <option value="IN_TRANSIT">{t('delivery_status_IN_TRANSIT', 'In Transit')}</option>
                  <option value="DELIVERED">{t('delivery_status_DELIVERED', 'Delivered (with Proof)')}</option>
                  <option value="FAILED">{t('delivery_status_FAILED', 'Failed')}</option>
                </select>
              </div>

              {simulatedStatus === 'FAILED' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_failure_reason', 'Failure Reason')}</label>
                  <input
                    type="text"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="e.g. Recipient was unreachable"
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none placeholder:text-ink-faint"
                    required
                  />
                </div>
              )}

              {simulatedStatus === 'DELIVERED' && process.env.NODE_ENV === 'development' && (
                <div className="rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-400">
                  <p className="font-bold mb-1">✓ {t('simulated_pod', 'Simulated POD (Proof of Delivery)')}</p>
                  <p>{t('simulated_pod_desc', 'This action will automatically append a simulated proof-of-delivery photo and customer signature.')}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">{t('label_update_notes', 'Execution Notes')}</label>
                <textarea
                  value={simulatedNotes}
                  onChange={(e) => setSimulatedNotes(e.target.value)}
                  placeholder="Notes about status transition..."
                  className="w-full h-20 rounded-xl border border-line bg-surface-muted px-4 py-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none resize-none placeholder:text-ink-faint"
                />
              </div>

              <div className="flex gap-4 border-t border-line pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setStatusTarget(null)}
                  className="flex-1 rounded-xl border border-line bg-surface-muted py-3 text-sm font-bold text-ink hover:bg-surface-hover"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-ink hover:bg-accent-strong disabled:opacity-50 transition-all"
                >
                  {updateStatusMutation.isPending ? t('updating', 'Updating...') : t('btn_update_status', 'Save Status')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
