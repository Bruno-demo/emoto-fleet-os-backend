'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';
import { 
  Cpu, 
  Search, 
  Bike, 
  X, 
  Link2, 
  Unlink, 
  KeyRound, 
  Plus, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { MetricCardSkeleton } from '@/components/ui/skeleton';

import { Badge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useTranslation } from '@/components/i18n/LanguageProvider';
import { buildQueryString } from '@/lib/api/query-string';
import { cx, formatTimeAgo, formatTimestamp } from '@/lib/ui';

const devicesResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      deviceUid: z.string(),
      imei: z.string().nullable(),
      simPhoneNumber: z.string().nullable().optional(),
      status: z.string(),
      lastSeenAt: z.string().nullable(),
      fwVersion: z.string().nullable(),
      bikeId: z.string().nullable(),
      bike: z.object({ id: z.string(), label: z.string() }).nullable(),
      fleet: z.object({ id: z.string(), name: z.string() }),
    })
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

type HqDevice = z.infer<typeof devicesResponseSchema>['data'][number];

const fleetsListSchema = z.array(
  z.object({ id: z.string(), name: z.string() })
);

const fleetDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  bikes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      plate: z.string().nullable(),
      status: z.string(),
    })
  ),
});

const STATUSES = ['ACTIVE', 'INACTIVE', 'RETIRED'];
const PAGE_SIZE = 25;

export default function HqDevicesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFleetId, setFilterFleetId] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [page, setPage] = useState(1);
  const [accumulatedDevices, setAccumulatedDevices] = useState<HqDevice[]>([]);

  // Reset page and accumulated list when filters change
  useEffect(() => {
    setPage(1);
    setAccumulatedDevices([]);
  }, [search, filterStatus, filterFleetId, filterAssigned]);

  // Detail drawer state
  const [selectedDevice, setSelectedDevice] = useState<HqDevice | null>(null);

  // Assign modal state
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null);
  const [assignFleetId, setAssignFleetId] = useState<string | null>(null);
  const [assignBikeId, setAssignBikeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  // Add Device modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDeviceUid, setNewDeviceUid] = useState('');
  const [newImei, setNewImei] = useState('');
  const [newSimPhoneNumber, setNewSimPhoneNumber] = useState('');
  const [newFleetId, setNewFleetId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // One-time secret display state
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [oneTimeSecretDeviceUid, setOneTimeSecretDeviceUid] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // ConfirmModals states
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotateTargetId, setRotateTargetId] = useState<string | null>(null);
  const [rotateTargetUid, setRotateTargetUid] = useState<string | null>(null);

  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [unassignTargetId, setUnassignTargetId] = useState<string | null>(null);
  const [unassignTargetUid, setUnassignTargetUid] = useState<string | null>(null);
  const [unassignTargetBikeLabel, setUnassignTargetBikeLabel] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; deviceUid: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hq', 'devices', page, search, filterStatus, filterFleetId, filterAssigned],
    queryFn: () => {
      const queryStr = buildQueryString({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: filterStatus || undefined,
        fleetId: filterFleetId || undefined,
        assigned: filterAssigned || undefined,
      });
      return apiFetch(`/hq/devices${queryStr}`, {}, { schema: devicesResponseSchema });
    },
  });

  useEffect(() => {
    if (data?.data) {
      if (page === 1) {
        setAccumulatedDevices(data.data);
      } else {
        setAccumulatedDevices((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const newDevices = (data.data ?? []).filter((d) => !existingIds.has(d.id));
          return [...prev, ...newDevices];
        });
      }
    }
  }, [data, page]);

  const { data: fleetsList } = useQuery({
    queryKey: ['hq', 'fleets-list'],
    queryFn: () => apiFetch('/hq/fleets?pageSize=200', {}).then((res) => {
      const r = res as { data?: Array<{ id: string; name: string }> };
      return (r.data ?? r) as Array<{ id: string; name: string }>;
    }),
  });

  // Fetch bikes for selected fleet when assigning
  const { data: fleetDetail } = useQuery({
    queryKey: ['hq', 'fleet', assignFleetId],
    queryFn: () => apiFetch(`/hq/fleets/${assignFleetId}`, {}, { schema: fleetDetailSchema }),
    enabled: !!assignFleetId,
  });

  const assignMutation = useMutation({
    mutationFn: ({ deviceId, bikeId }: { deviceId: string; bikeId: string }) =>
      apiFetch<{ bikeId: string; bike: { id: string; label: string } | null }>(`/hq/devices/${deviceId}/assign-bike`, {
        method: 'POST',
        body: JSON.stringify({ bikeId }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setPage(1);
      setAccumulatedDevices([]);
      // Update local state if the drawer is open for this device
      if (selectedDevice && selectedDevice.id === assignDeviceId) {
        setSelectedDevice((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            bikeId: res.bikeId || assignBikeId,
            bike: res.bike || { id: assignBikeId, label: fleetDetail?.bikes.find(b => b.id === assignBikeId)?.label ?? 'Bike' }
          };
        });
      }
      setAssignDeviceId(null);
      setAssignFleetId(null);
      setAssignBikeId('');
      setAssignError(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setAssignError(error?.message ?? t('Failed to assign device'));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/unassign-bike`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setPage(1);
      setAccumulatedDevices([]);
      if (selectedDevice && selectedDevice.id === unassignTargetId) {
        setSelectedDevice((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            bikeId: null,
            bike: null
          };
        });
      }
      setUnassignConfirmOpen(false);
      setUnassignTargetId(null);
      setUnassignTargetUid(null);
      setUnassignTargetBikeLabel(null);
    },
  });

  const createDeviceMutation = useMutation({
    mutationFn: (body: { deviceUid: string; imei?: string; simPhoneNumber?: string; fleetId: string }) =>
      apiFetch('/hq/devices', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (res: unknown) => {
      const result = res as { deviceSecret: string; device: { deviceUid: string } };
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setPage(1);
      setAccumulatedDevices([]);
      setIsAddModalOpen(false);
      setNewDeviceUid('');
      setNewImei('');
      setNewSimPhoneNumber('');
      setNewFleetId('');
      setAddError(null);
      setOneTimeSecret(result.deviceSecret);
      setOneTimeSecretDeviceUid(result.device.deviceUid);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      setAddError(error?.message ?? t('Failed to provision device'));
    },
  });

  const rotateSecretMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/rotate-secret`, {
        method: 'POST',
      }),
    onSuccess: (res: unknown) => {
      const result = res as { deviceSecret: string; deviceUid: string };
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setPage(1);
      setAccumulatedDevices([]);
      setRotateConfirmOpen(false);
      setRotateTargetId(null);
      setRotateTargetUid(null);
      setOneTimeSecret(result.deviceSecret);
      setOneTimeSecretDeviceUid(result.deviceUid);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      alert(error?.message ?? t('Failed to rotate device secret'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (deviceId: string) =>
      apiFetch(`/hq/devices/${deviceId}/permanent`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'devices'] });
      setPage(1);
      setAccumulatedDevices([]);
      setDeleteTarget(null);
      setSelectedDevice(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      alert(error?.message ?? t('Failed to delete device'));
    },
  });

  // Calculate client side metrics from current page
  const devicesList = accumulatedDevices;
  const metrics = useMemo(() => {
    const total = data?.total ?? 0;
    const active = devicesList.filter(d => d.status === 'ACTIVE').length;
    const inactive = devicesList.filter(d => d.status === 'INACTIVE').length;
    const assigned = devicesList.filter(d => d.bikeId !== null).length;
    return { total, active, inactive, assigned };
  }, [data?.total, devicesList]);

  const columns: Array<DataTableColumn<HqDevice>> = [
    {
      header: t('Device UID'),
      render: (row) => <span className="font-bold text-ink whitespace-nowrap">{row.deviceUid}</span>,
    },
    {
      header: t('IMEI'),
      render: (row) => <span className="font-mono text-xs text-ink-muted whitespace-nowrap">{row.imei ?? '—'}</span>,
    },
    {
      header: t('SIM Phone'),
      render: (row) => (
        <span className="font-mono text-xs text-ink-muted whitespace-nowrap">
          {row.simPhoneNumber ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-sky-400 font-semibold">
              📱 {row.simPhoneNumber}
            </span>
          ) : (
            <span className="text-ink-faint italic">{t('No SIM')}</span>
          )}
        </span>
      ),
    },
    {
      header: t('Fleet'),
      render: (row) => <span className="text-xs text-ink-soft whitespace-nowrap">{row.fleet.name}</span>,
    },
    {
      header: t('Assigned Bike'),
      render: (row) => row.bike ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent whitespace-nowrap">
          <Bike size={12} />
          {row.bike.label}
        </span>
      ) : (
        <span className="text-xs text-ink-faint whitespace-nowrap">{t('Unassigned')}</span>
      ),
    },
    {
      header: t('Status'),
      render: (row) => {
        const tone = row.status === 'ACTIVE' ? 'success' : row.status === 'INACTIVE' ? 'warning' : 'danger';
        return <Badge tone={tone} label={row.status} />;
      },
    },
    {
      header: t('Last Seen'),
      render: (row) => <span className="text-xs text-ink-soft whitespace-nowrap">{row.lastSeenAt ? formatTimeAgo(row.lastSeenAt) : t('Never')}</span>,
    },
    {
      header: t('FW Version'),
      render: (row) => <span className="font-mono text-xs text-ink-muted whitespace-nowrap">{row.fwVersion ?? '—'}</span>,
    },
    {
      header: t('Actions'),
      className: 'text-right',
      cellClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setRotateTargetId(row.id);
              setRotateTargetUid(row.deviceUid);
              setRotateConfirmOpen(true);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-bold text-ink-soft hover:bg-surface-hover transition-all"
            title={t('Rotate Secret')}
          >
            <KeyRound size={12} />
            {t('Rotate')}
          </button>
          {row.bike ? (
            <button
              onClick={() => {
                setUnassignTargetId(row.id);
                setUnassignTargetUid(row.deviceUid);
                setUnassignTargetBikeLabel(row.bike?.label ?? 'Bike');
                setUnassignConfirmOpen(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11px] font-bold text-warning-ink hover:bg-warning-soft transition-all"
              title={t('Unassign')}
            >
              <Unlink size={12} />
              {t('Unassign')}
            </button>
          ) : (
            <button
              onClick={() => {
                setAssignDeviceId(row.id);
                setAssignFleetId(row.fleet.id);
                setAssignBikeId('');
                setAssignError(null);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-2.5 text-[11px] font-bold text-accent hover:bg-accent/20 transition-all"
              title={t('Assign Bike')}
            >
              <Link2 size={12} />
              {t('Assign')}
            </button>
          )}
          <button
            onClick={() => setDeleteTarget({ id: row.id, deviceUid: row.deviceUid })}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
            title={t('Delete Device')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              title={t('Total Devices')}
              value={metrics.total.toLocaleString()}
              hint={t('Registered tracking units')}
              icon={<Cpu size={20} />}
              tone="info"
            />
            <MetricCard
              title={t('Active')}
              value={metrics.active.toLocaleString()}
              hint={t('Devices reporting telemetry')}
              icon={<CheckCircle2 size={20} />}
              tone="success"
            />
            <MetricCard
              title={t('Inactive')}
              value={metrics.inactive.toLocaleString()}
              hint={t('Devices currently offline')}
              icon={<AlertCircle size={20} />}
              tone="warning"
            />
            <MetricCard
              title={t('Assigned to Bike')}
              value={metrics.assigned.toLocaleString()}
              hint={t('Linked to physical bikes')}
              icon={<Bike size={20} />}
              tone="info"
            />
          </>
        )}
      </div>

      {/* Main Registry */}
      <DashboardCard
        eyebrow={t('Hardware')}
        title={t('Device Registry')}
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:brightness-115 transition-all shadow-md shadow-accent/15"
          >
            <Plus size={14} />
            {t('Add Device')}
          </button>
        }
      >
        <div className="space-y-4">
          <DataTableToolbar>
            <div className="flex flex-col gap-3 w-full">
              <div className="relative group max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint group-focus-within:text-accent transition-colors" size={15} />
                <input
                  type="text"
                  placeholder={t('Search by device UID or IMEI...')}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(''); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterFleetId}
                  onChange={(e) => { setFilterFleetId(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft focus:border-accent focus:outline-none cursor-pointer hover:bg-surface-hover transition"
                >
                  <option value="">{t('All fleets')}</option>
                  {(fleetsList ?? []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft focus:border-accent focus:outline-none cursor-pointer hover:bg-surface-hover transition"
                >
                  <option value="">{t('All statuses')}</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={filterAssigned}
                  onChange={(e) => { setFilterAssigned(e.target.value); setPage(1); }}
                  className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink-soft focus:border-accent focus:outline-none cursor-pointer hover:bg-surface-hover transition"
                >
                  <option value="">{t('All assignments')}</option>
                  <option value="true">{t('Assigned')}</option>
                  <option value="false">{t('Unassigned')}</option>
                </select>
              </div>
            </div>
          </DataTableToolbar>

          {/* Device Table */}
          <DataTable
            data={devicesList}
            columns={columns}
            keyExtractor={(row) => row.id}
            loading={isLoading}
            onRowClick={(row) => setSelectedDevice(row)}
          />

          {/* Load More Button */}
          {accumulatedDevices.length < (data?.total ?? 0) && (
            <div className="mt-6 flex justify-center border-t border-line pt-6">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setPage((prev) => prev + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : (
                  <ChevronDown size={16} className="animate-bounce" />
                )}
                {isLoading ? t('Loading...') : t('Load more')}
              </button>
            </div>
          )}
          {accumulatedDevices.length >= (data?.total ?? 0) && (data?.total ?? 0) > 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 mt-6 pt-6 border-t border-line">
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                <Check size={14} /> {t('All {total} devices loaded').replace('{total}', String(data?.total ?? 0))}
              </p>
            </div>
          )}
        </div>
      </DashboardCard>

      {/* Device Detail Drawer */}
      <Drawer
        open={!!selectedDevice}
        title={selectedDevice ? selectedDevice.deviceUid : ''}
        description={t('Device Hardware Profile')}
        onClose={() => setSelectedDevice(null)}
      >
        {selectedDevice && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <KeyMetric label={t('Device UID')} value={selectedDevice.deviceUid} />
              <KeyMetric
                label={t('Status')}
                value={
                  <Badge 
                    tone={selectedDevice.status === 'ACTIVE' ? 'success' : selectedDevice.status === 'INACTIVE' ? 'warning' : 'danger'}
                    label={selectedDevice.status}
                  />
                }
              />
              <KeyMetric label={t('IMEI')} value={selectedDevice.imei ?? t('Not set')} />
              <KeyMetric label={t('SIM Phone')} value={selectedDevice.simPhoneNumber ? `📱 ${selectedDevice.simPhoneNumber}` : t('Not set')} />
              <KeyMetric label={t('FW Version')} value={selectedDevice.fwVersion ?? t('Not set')} />
              <KeyMetric label={t('Fleet')} value={selectedDevice.fleet.name} />
              <KeyMetric
                label={t('Assigned Bike')}
                value={
                  selectedDevice.bike ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                      <Bike size={13} />
                      {selectedDevice.bike.label}
                    </span>
                  ) : (
                    <span className="text-ink-faint">{t('Unassigned')}</span>
                  )
                }
              />
              <KeyMetric
                label={t('Last Seen')}
                value={selectedDevice.lastSeenAt ? formatTimestamp(selectedDevice.lastSeenAt) : t('Never')}
              />
            </div>

            {/* Quick Actions Panel */}
            <div className="rounded-2xl border border-line bg-surface-muted p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">{t('Hardware Administration')}</h3>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => {
                    setRotateTargetId(selectedDevice.id);
                    setRotateTargetUid(selectedDevice.deviceUid);
                    setRotateConfirmOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-ink-soft hover:bg-surface-hover transition-colors"
                >
                  <KeyRound size={14} />
                  {t('Rotate Credentials')}
                </button>
                {selectedDevice.bike ? (
                  <button
                    onClick={() => {
                      setUnassignTargetId(selectedDevice.id);
                      setUnassignTargetUid(selectedDevice.deviceUid);
                      setUnassignTargetBikeLabel(selectedDevice.bike?.label ?? 'Bike');
                      setUnassignConfirmOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-semibold text-warning-ink hover:bg-warning-soft transition-colors"
                  >
                    <Unlink size={14} />
                    {t('Unassign Bike')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAssignDeviceId(selectedDevice.id);
                      setAssignFleetId(selectedDevice.fleet.id);
                      setAssignBikeId('');
                      setAssignError(null);
                    }}
                    className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-strong transition-all shadow-md shadow-accent/10"
                  >
                    <Link2 size={14} />
                    {t('Assign Bike')}
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget({ id: selectedDevice.id, deviceUid: selectedDevice.deviceUid })}
                  className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                >
                  <Trash2 size={14} />
                  {t('Delete Device')}
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Provision Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[var(--radius-panel)] border border-line bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-faint hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-ink">{t('Provision New Device')}</h2>
            <p className="mt-1 text-xs text-ink-soft">{t('Register a new IoT tracker unit to a specific fleet.')}</p>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDeviceUid.trim()) {
                  setAddError(t('Device UID is required'));
                  return;
                }
                if (!newFleetId) {
                  setAddError(t('Fleet assignment is required'));
                  return;
                }
                createDeviceMutation.mutate({
                  deviceUid: newDeviceUid.trim(),
                  imei: newImei.trim() || undefined,
                  simPhoneNumber: newSimPhoneNumber.trim() || undefined,
                  fleetId: newFleetId,
                });
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Device UID')}</label>
                <input
                  type="text"
                  placeholder="e.g. EMOTO-DEV-201"
                  value={newDeviceUid}
                  onChange={(e) => setNewDeviceUid(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Hardware IMEI')}</label>
                <input
                  type="text"
                  placeholder="e.g. 864012345678901"
                  value={newImei}
                  onChange={(e) => setNewImei(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Tracker SIM Phone (SMS Fallback)')}</label>
                <input
                  type="text"
                  placeholder="e.g. 0781234567 or +250781234567"
                  value={newSimPhoneNumber}
                  onChange={(e) => setNewSimPhoneNumber(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <p className="mt-1 text-[11px] text-ink-soft">{t('Used for budget-friendly SMS lock/unlock commands when GPRS/TCP is offline.')}</p>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Select Fleet')}</label>
                <select
                  value={newFleetId}
                  onChange={(e) => setNewFleetId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— {t('Select a fleet')} —</option>
                  {(fleetsList ?? []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {addError && (
                <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">{addError}</p>
              )}
              
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-muted"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createDeviceMutation.isPending}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {createDeviceMutation.isPending ? t('Provisioning...') : t('Provision')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Secret Display Modal */}
      {oneTimeSecret && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[var(--radius-panel)] border border-warning-ink/20 bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning-ink mb-4">
              <KeyRound size={24} />
            </div>
            
            <h2 className="text-lg font-bold text-center text-ink">{t('One-Time Device Secret')}</h2>
            <p className="mt-2 text-center text-xs text-ink-muted leading-relaxed">
              {t('Successfully generated secret for')} <strong className="text-ink-soft">{oneTimeSecretDeviceUid}</strong>.
            </p>
            
            <div className="mt-5 space-y-4">
              <div className="relative rounded-2xl border border-line bg-surface-muted p-4 font-mono text-sm text-center text-warning-ink break-all select-all">
                {oneTimeSecret}
              </div>
              
              <div className="rounded-2xl border border-warning-ink/20 bg-warning-soft/30 p-4 text-xs text-warning-ink leading-relaxed space-y-1.5">
                <p className="font-bold">⚠️ {t('CRITICAL SECURITY WARNING:')}</p>
                <p>{t('This secret is cryptographically salted and hashed. It is never stored in plain text and cannot be retrieved or viewed again.')}</p>
                <p className="mt-1">{t('Copy it now for hardware provisioning. If lost, a new secret rotation will be required.')}</p>
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(oneTimeSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="flex w-full h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all hover:bg-accent-strong shadow-lg shadow-warning-ink/10"
                  style={{ backgroundColor: '#f59e0b', color: '#09090b' }}
                >
                  {copiedSecret ? (
                    <>
                      <Check size={16} />
                      {t('Copied!')}
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      {t('Copy to Clipboard')}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOneTimeSecret(null);
                    setOneTimeSecretDeviceUid(null);
                  }}
                  className="w-full h-12 rounded-xl border border-line bg-surface-hover text-sm font-semibold text-ink-soft transition hover:bg-surface-muted"
                >
                  {t('I have saved this secret')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Device Modal */}
      {assignDeviceId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4 animate-fade-in" style={{ animationDuration: '150ms' }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[var(--radius-panel)] border border-line bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-faint hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-ink">{t('Assign Device to Bike')}</h2>
            <p className="mt-1 text-xs text-ink-soft">{t('Select a bike from the same fleet to link this device.')}</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft mb-2">{t('Select Bike')}</label>
                <select
                  value={assignBikeId}
                  onChange={(e) => setAssignBikeId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-accent cursor-pointer"
                >
                  <option value="">— {t('Select a bike')} —</option>
                  {(fleetDetail?.bikes ?? []).map((bike) => (
                    <option key={bike.id} value={bike.id}>
                      {bike.label}{bike.plate ? ` (${bike.plate})` : ''} — {bike.status}
                    </option>
                  ))}
                </select>
              </div>
              {assignError && (
                <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-2.5 text-xs text-danger-ink">{assignError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setAssignDeviceId(null); setAssignFleetId(null); }}
                  className="flex-1 rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm font-semibold text-ink-soft transition hover:bg-surface-muted"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (assignDeviceId && assignBikeId) {
                      assignMutation.mutate({ deviceId: assignDeviceId, bikeId: assignBikeId });
                    }
                  }}
                  disabled={assignMutation.isPending || !assignBikeId}
                  className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {assignMutation.isPending ? t('Assigning...') : t('Assign')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modals */}
      <ConfirmModal
        open={rotateConfirmOpen}
        title={t('Rotate Device Secret')}
        description={`${t('Are you sure you want to rotate the secret for device')} "${rotateTargetUid}"? ${t('The existing secret will be immediately invalidated and cannot be retrieved again.')}`}
        confirmLabel={t('Rotate Secret')}
        tone="danger"
        isSubmitting={rotateSecretMutation.isPending}
        onConfirm={() => {
          if (rotateTargetId) rotateSecretMutation.mutate(rotateTargetId);
        }}
        onCancel={() => {
          setRotateConfirmOpen(false);
          setRotateTargetId(null);
          setRotateTargetUid(null);
        }}
      />

      <ConfirmModal
        open={unassignConfirmOpen}
        title={t('Unassign Bike')}
        description={`${t('Unassign device')} "${unassignTargetUid}" ${t('from bike')} "${unassignTargetBikeLabel}"?`}
        confirmLabel={t('Unassign')}
        tone="default"
        isSubmitting={unassignMutation.isPending}
        onConfirm={() => {
          if (unassignTargetId) unassignMutation.mutate(unassignTargetId);
        }}
        onCancel={() => {
          setUnassignConfirmOpen(false);
          setUnassignTargetId(null);
          setUnassignTargetUid(null);
          setUnassignTargetBikeLabel(null);
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={t('Delete Device')}
        description={`${t('Are you sure you want to permanently delete device')} "${deleteTarget?.deviceUid}"? ${t('All historical telemetry, incidents, commands, and active configurations will be wiped. This action cannot be undone.')}`}
        confirmLabel={t('Delete Permanently')}
        tone="danger"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
