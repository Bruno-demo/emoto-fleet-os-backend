'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bike,
  Cpu,
  Gauge,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  Unlock,
  UserCheck,
  UserRound,
  X,
  Search,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { Badge } from '@/components/ui/badge';
import { canProvisionDevices, canViewAssignments } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { canUseFeature } from '@/lib/subscription';
import type {
  Assignment,
  Bike as FleetBike,
  BikeTrip,
  CommandStatusEvent,
  Device,
  DeviceCommand,
  FleetEvent,
  PaginatedResponse,
  Rider,
} from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimestamp } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { DataTable, type DataTableColumn, DataTableToolbar } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineNotice, TextField } from '@/components/ui/form-controls';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { DrawerSkeleton } from '@/components/ui/skeleton';
import { compressImage } from '@/lib/image';

const PAGE_SIZE = 20;

type CommandIntent = 'LOCK' | 'UNLOCK';

export default function BikesPage() {
  const { data: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { commandStatuses, recordCommandStatus } = useRealtime();
  const [page, setPage] = useState(1);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandIntent, setCommandIntent] = useState<CommandIntent | null>(null);
  const [showCreateBike, setShowCreateBike] = useState(false);
  const [createBikeForm, setCreateBikeForm] = useState({ label: '', plate: '', serial: '', model: '', imageUrl: '', type: 'SPIRO' });
  const [isCreatingBike, setIsCreatingBike] = useState(false);
  const [createBikeError, setCreateBikeError] = useState<string | null>(null);
  const [showAssignRider, setShowAssignRider] = useState(false);
  const [assignRiderId, setAssignRiderId] = useState('');
  const [isAssigningRider, setIsAssigningRider] = useState(false);
  const [assignRiderError, setAssignRiderError] = useState<string | null>(null);
  const [showAssignInsurer, setShowAssignInsurer] = useState(false);
  const [assignInsurerId, setAssignInsurerId] = useState('');
  const [isAssigningInsurer, setIsAssigningInsurer] = useState(false);
  const [assignInsurerError, setAssignInsurerError] = useState<string | null>(null);

  const canCreateBikes = !!currentUser && canProvisionDevices(currentUser.role);

  const handleCreateBike = async () => {
    if (!createBikeForm.label.trim()) {
      setCreateBikeError('Label is required');
      return;
    }
    setCreateBikeError(null);
    setIsCreatingBike(true);
    try {
      await apiFetch<FleetBike>('/bikes', {
        method: 'POST',
        body: JSON.stringify({
          label: createBikeForm.label.trim(),
          plate: createBikeForm.plate.trim() || undefined,
          serial: createBikeForm.serial.trim() || undefined,
          model: createBikeForm.model.trim() || undefined,
          imageUrl: createBikeForm.imageUrl || undefined,
          type: createBikeForm.type || undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['bikes'] });
      setShowCreateBike(false);
      setCreateBikeForm({ label: '', plate: '', serial: '', model: '', imageUrl: '', type: 'SPIRO' });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setCreateBikeError(error.message);
      } else {
        setCreateBikeError('Failed to create bike');
      }
    } finally {
      setIsCreatingBike(false);
    }
  };

  const bikesQuery = useQuery({
    queryKey: ['bikes', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetBike>>(
        `/bikes${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  const devicesQuery = useQuery({
    queryKey: ['devices', 'bike-join'],
    queryFn: () => apiFetch<PaginatedResponse<Device>>('/devices?page=1&pageSize=100'),
  });

  const assignmentsEnabled = !!currentUser && canViewAssignments(currentUser.role);
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'active'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Assignment>>('/assignments?page=1&pageSize=100&active=true'),
    enabled: assignmentsEnabled,
    retry: false,
  });

  const ridersQuery = useQuery({
    queryKey: ['riders', 'for-assign'],
    queryFn: () => apiFetch<PaginatedResponse<Rider>>('/riders?page=1&pageSize=200'),
    enabled: assignmentsEnabled,
  });

  const insurersQuery = useQuery({
    queryKey: ['fleet-users', 'insurers'],
    queryFn: () => apiFetch<Array<{ id: string; email: string | null; phone: string | null; role: string; riderProfile?: { fullName: string } | null }>>('/auth/fleet-users'),
    enabled: !!currentUser && canProvisionDevices(currentUser.role),
  });

  const insurerUsers = useMemo(() =>
    (insurersQuery.data ?? []).filter(u => u.role === 'INSURER'),
    [insurersQuery.data],
  );

  const handleAssignRider = async () => {
    if (!selectedBikeId || !assignRiderId) return;
    setAssignRiderError(null);
    setIsAssigningRider(true);
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({ bikeId: selectedBikeId, riderUserId: assignRiderId }),
      });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setShowAssignRider(false);
      setAssignRiderId('');
    } catch (error: unknown) {
      if (error instanceof ApiError) setAssignRiderError(error.message);
      else setAssignRiderError('Failed to assign rider');
    } finally {
      setIsAssigningRider(false);
    }
  };

  const handleAssignInsurer = async () => {
    if (!selectedBikeId) return;
    setAssignInsurerError(null);
    setIsAssigningInsurer(true);
    try {
      const targetInsurerUserId = (assignInsurerId === 'none' || !assignInsurerId) ? null : assignInsurerId;
      await apiFetch(`/bikes/${selectedBikeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ insurerUserId: targetInsurerUserId }),
      });
      await queryClient.invalidateQueries({ queryKey: ['bikes'] });
      setShowAssignInsurer(false);
      setAssignInsurerId('');
    } catch (error: unknown) {
      if (error instanceof ApiError) setAssignInsurerError(error.message);
      else setAssignInsurerError('Failed to assign insurer');
    } finally {
      setIsAssigningInsurer(false);
    }
  };

  useEffect(() => {
    const bikeId = searchParams.get('bikeId');
    if (bikeId) {
      setSelectedBikeId(bikeId);
    }
  }, [searchParams]);

  const deviceByBikeId = useMemo(() => {
    const byBike = new Map<string, Device>();
    for (const device of devicesQuery.data?.data ?? []) {
      if (device.bikeId) {
        byBike.set(device.bikeId, device);
      }
    }
    return byBike;
  }, [devicesQuery.data?.data]);

  const assignmentByBikeId = useMemo(() => {
    const byBike = new Map<string, Assignment>();
    for (const assignment of assignmentsQuery.data?.data ?? []) {
      if (assignment.active) {
        byBike.set(assignment.bikeId, assignment);
      }
    }
    return byBike;
  }, [assignmentsQuery.data?.data]);

  const filteredBikes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const bikes = bikesQuery.data?.data ?? [];
    if (!query) {
      return bikes;
    }

    const tokens = query.split(/\s+/).filter(Boolean);
    return bikes.filter((bike) => {
      const device = deviceByBikeId.get(bike.id);
      const assignment = assignmentByBikeId.get(bike.id);
      
      return tokens.every((token) => {
        return [
          bike.label,
          bike.plate,
          bike.model,
          bike.serial,
          bike.status,
          formatEnumLabel(bike.status),
          device?.deviceUid,
          device?.imei,
          assignment?.riderFullName,
          bike.insurer?.riderProfile?.fullName,
          bike.insurer?.email,
          bike.insurer?.phone,
        ]
          .filter((val): val is string => !!val)
          .some((val) => val.toLowerCase().includes(token));
      });
    });
  }, [assignmentByBikeId, bikesQuery.data?.data, deviceByBikeId, searchQuery]);

  const selectedBike = useMemo(
    () => (bikesQuery.data?.data ?? []).find((bike) => bike.id === selectedBikeId) ?? null,
    [bikesQuery.data?.data, selectedBikeId],
  );

  const selectedBikeDetailQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'detail'],
    queryFn: () => apiFetch<FleetBike>(`/bikes/${selectedBikeId}`),
    enabled: !!selectedBikeId && !selectedBike,
  });

  const activeBike = selectedBike ?? selectedBikeDetailQuery.data ?? null;

  const bikeTripsQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'trips'],
    queryFn: () =>
      apiFetch<PaginatedResponse<BikeTrip>>(`/bikes/${selectedBikeId}/trips?page=1&pageSize=10`),
    enabled: !!selectedBikeId,
  });

  const bikeEventsQuery = useQuery({
    queryKey: ['events', 'bike', selectedBikeId],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetEvent>>(
        `/events${buildQueryString({
          bikeId: selectedBikeId,
          page: 1,
          pageSize: 10,
        })}`,
      ),
    enabled: !!selectedBikeId,
  });

  const bikeCommandStatuses = useMemo(
    () =>
      commandStatuses
        .filter((status) => status.bikeId === selectedBikeId)
        .sort((left, right) => right.ts.localeCompare(left.ts)),
    [commandStatuses, selectedBikeId],
  );

  const bikes = useMemo(() => bikesQuery.data?.data ?? [], [bikesQuery.data?.data]);
  const totalAssignedDevices = bikes.filter((bike) => deviceByBikeId.has(bike.id)).length;
  const totalAssignedRiders = bikes.filter((bike) => assignmentByBikeId.has(bike.id)).length;
  const maintenanceCount = bikes.filter((bike) => bike.status === 'MAINTENANCE').length;
  const canSendCommands =
    !!currentUser &&
    canProvisionDevices(currentUser.role) &&
    canUseFeature(currentUser, 'commands');

  // Sends a lock or unlock command and mirrors the first status in the websocket cache.
  const requestCommand = async (action: CommandIntent) => {
    if (!selectedBikeId) {
      return;
    }

    setCommandError(null);
    try {
      setIsSendingCommand(true);
      const command = await apiFetch<DeviceCommand>(
        `/commands/${action.toLowerCase()}${buildQueryString({ bikeId: selectedBikeId })}`,
        { method: 'POST' },
      );

      const commandStatus: CommandStatusEvent = {
        commandId: command.id,
        status: command.status,
        ts: command.updatedAt,
        bikeId: command.bikeId ?? undefined,
        deviceId: command.deviceId,
        action: command.type,
        message: command.errorMessage ?? undefined,
      };

      recordCommandStatus(commandStatus);
      setCommandIntent(null);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setCommandError(error.message);
      } else {
        setCommandError('Command request failed');
      }
    } finally {
      setIsSendingCommand(false);
    }
  };

  const getBikeLockStatus = useCallback(
    (bikeId: string) => {
      const bikeCommands = commandStatuses
        .filter(
          (status) =>
            status.bikeId === bikeId && (status.action === 'LOCK' || status.action === 'UNLOCK'),
        )
        .sort((left, right) => right.ts.localeCompare(left.ts));
      if (bikeCommands.length === 0) return 'UNLOCKED';
      const latest = bikeCommands[0];
      if (latest.action === 'LOCK') {
        if (latest.status === 'ACKED') return 'LOCKED';
        if (
          latest.status === 'PENDING' ||
          latest.status === 'SENT' ||
          latest.status === 'QUEUED'
        ) {
          return 'LOCKING';
        }
        return 'UNLOCKED';
      } else {
        if (latest.status === 'ACKED') return 'UNLOCKED';
        if (
          latest.status === 'PENDING' ||
          latest.status === 'SENT' ||
          latest.status === 'QUEUED'
        ) {
          return 'UNLOCKING';
        }
        return 'LOCKED';
      }
    },
    [commandStatuses],
  );

  const columns = useMemo<Array<DataTableColumn<FleetBike>>>(
    () => [
      {
        header: 'Bike',
        render: (bike) => {
          const lockStatus = getBikeLockStatus(bike.id);
          return (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{bike.label}</span>
                {lockStatus === 'LOCKED' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-ink border border-danger-ink/10 shadow-sm animate-pulse">
                    <Lock size={10} className="text-danger-ink" />
                    Locked
                  </span>
                )}
                {lockStatus === 'LOCKING' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-ink border border-warning-ink/10 shadow-sm animate-pulse">
                    <Lock size={10} className="text-warning-ink animate-bounce" />
                    Locking
                  </span>
                )}
                {lockStatus === 'UNLOCKING' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/10 shadow-sm animate-pulse">
                    <Unlock size={10} className="text-accent animate-bounce" />
                    Unlocking
                  </span>
                )}
                {lockStatus === 'UNLOCKED' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success-ink border border-success-ink/10 shadow-sm">
                    <Unlock size={10} className="text-success-ink" />
                    Unlocked
                  </span>
                )}
              </div>
              <p className="text-xs leading-5 text-ink-soft">
                {bike.plate ?? bike.model ?? bike.serial ?? bike.id.slice(0, 8)}
              </p>
            </div>
          );
        },
      },
      {
        header: 'Status',
        render: (bike) => <BikeStatusBadge status={bike.status} />,
      },
      {
        header: 'Device',
        render: (bike) => (
          <span className="text-sm text-ink-soft">
            {deviceByBikeId.get(bike.id)?.deviceUid ?? 'Unassigned'}
          </span>
        ),
      },
      {
        header: 'Rider',
        render: (bike) => (
          <span className="text-sm text-ink-soft">
            {assignmentByBikeId.get(bike.id)?.riderFullName ?? 'Unassigned'}
          </span>
        ),
      },
      {
        header: 'Action',
        className: 'text-right',
        cellClassName: 'text-right',
        render: (bike) => (
          <button
            type="button"
            className="rounded-xl border border-line bg-surface-hover px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-surface-muted hover:border-accent/30"
            onClick={() => setSelectedBikeId(bike.id)}
          >
            View detail
          </button>
        ),
      },
    ],
    [assignmentByBikeId, deviceByBikeId, getBikeLockStatus],
  );

  return (
    <div className="space-y-6">
      {canCreateBikes && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreateBike(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 shadow-sm"
            style={{ background: '#3B82F6', color: 'white' }}
          >
            <Plus size={16} strokeWidth={3} />
            Add Bike
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Fleet Bikes"
          value={String(bikesQuery.data?.total ?? 0)}
          hint="Total registered bikes in the current fleet scope."
          icon={<Bike size={18} />}
          tone="info"
        />
        <MetricCard
          title="Assigned Devices"
          value={String(totalAssignedDevices)}
          hint="Bikes currently paired to an active telemetry device."
          icon={<Cpu size={18} />}
          tone="success"
        />
        <MetricCard
          title="Assigned Riders"
          value={String(totalAssignedRiders)}
          hint="Bikes with an active rider assignment."
          icon={<UserRound size={18} />}
          tone="info"
        />
        <MetricCard
          title="Maintenance Queue"
          value={String(maintenanceCount)}
          hint="Bikes flagged for maintenance and unavailable for trips."
          icon={<ShieldAlert size={18} />}
          tone="warning"
        />
      </section>

      <DashboardCard
        eyebrow="Fleet Registry"
        title="Bike inventory"
        description="Search bike, rider, and device context from one standardized fleet registry."
      >
        <DataTableToolbar>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">Search</label>
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="text"
                  placeholder="Search bike label, plate, model, serial, status, rider, device UID, or insurer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[var(--radius-control)] border border-line bg-surface-hover py-3 pl-10 pr-10 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-[var(--radius-panel)] border border-line bg-surface-muted px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Visible bikes
              </p>
              <p className="mt-2 font-display text-3xl font-semibold text-ink">
                {filteredBikes.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Matching bikes on the current page.
              </p>
            </div>
          </div>
        </DataTableToolbar>

        <div className="mt-6">
          <DataTable
            data={filteredBikes}
            columns={columns}
            keyExtractor={(bike) => bike.id}
            loading={bikesQuery.isLoading}
            emptyState={
              <EmptyState
                icon={<Bike size={18} />}
                title="No bikes match this search"
                description="Adjust the query or page through the fleet registry to find another bike."
              />
            }
          />
        </div>

        <PaginationControls
          page={bikesQuery.data?.page ?? page}
          totalPages={bikesQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </DashboardCard>

      <Drawer
        open={!!selectedBikeId}
        title={activeBike?.label ?? 'Bike detail'}
        description="Recent trips, recent events, and remote control history for the selected bike."
        onClose={() => {
          setSelectedBikeId(null);
          setCommandIntent(null);
          setCommandError(null);
        }}
      >
        {!selectedBikeId ? null : selectedBikeDetailQuery.isLoading ? (
          <DrawerSkeleton />
        ) : !activeBike ? (
          <EmptyState
            icon={<Bike size={18} />}
            title="Bike detail unavailable"
            description="This bike could not be loaded from the current fleet scope."
          />
        ) : (
          <div className="space-y-5">
            {activeBike.imageUrl && (
              <div className="rounded-[24px] border border-line bg-surface-muted overflow-hidden max-h-[160px] flex items-center justify-center">
                <img src={activeBike.imageUrl} alt={activeBike.label} className="w-full object-cover max-h-[160px]" />
              </div>
            )}
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric label="Bike status" value={<BikeStatusBadge status={activeBike.status} />} />
              <KeyMetric label="Bike type" value={<span>{activeBike.type ?? '—'}</span>} />
              <KeyMetric
                label="Security state"
                value={
                  <div className="flex items-center gap-2">
                    {(() => {
                      const lockStatus = getBikeLockStatus(activeBike.id);
                      switch (lockStatus) {
                        case 'LOCKED':
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger-ink border border-danger-ink/10 shadow-sm animate-pulse">
                              <Lock size={12} className="text-danger-ink" />
                              Locked
                            </span>
                          );
                        case 'LOCKING':
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-ink border border-warning-ink/10 shadow-sm animate-pulse">
                              <Lock size={12} className="text-warning-ink animate-bounce" />
                              Locking...
                            </span>
                          );
                        case 'UNLOCKING':
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent border border-accent/10 shadow-sm animate-pulse">
                              <Unlock size={12} className="text-accent animate-bounce" />
                              Unlocking...
                            </span>
                          );
                        default:
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink border border-success-ink/10 shadow-sm">
                              <Unlock size={12} className="text-success-ink" />
                              Unlocked
                            </span>
                          );
                      }
                    })()}
                  </div>
                }
              />
              <KeyMetric
                label="Assigned device"
                value={<span>{deviceByBikeId.get(activeBike.id)?.deviceUid ?? 'Unassigned'}</span>}
              />
              <KeyMetric
                label="Assigned rider"
                value={<span>{assignmentByBikeId.get(activeBike.id)?.riderFullName ?? 'Unassigned'}</span>}
              />
              <KeyMetric
                label="Assigned insurer"
                value={
                  <span>
                    {activeBike.insurer
                      ? activeBike.insurer.riderProfile?.fullName
                        ? `${activeBike.insurer.riderProfile.fullName} (${activeBike.insurer.email ?? activeBike.insurer.phone})`
                        : (activeBike.insurer.email ?? activeBike.insurer.phone ?? 'Assigned')
                      : 'Unassigned'}
                  </span>
                }
              />
              <KeyMetric
                label="Latest trip"
                value={
                  <span>
                    {bikeTripsQuery.data?.data?.[0]?.startTs
                      ? formatTimestamp(bikeTripsQuery.data.data[0].startTs)
                      : 'No trips yet'}
                  </span>
                }
              />
            </section>

            {/* Assignment Actions */}
            {canCreateBikes && (
              <DashboardCard eyebrow="Assignments" title="Bike assignments" description="Manage rider and insurer assignments for this bike.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setShowAssignRider(true); setAssignRiderError(null); }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/20"
                  >
                    <UserCheck size={16} />
                    {assignmentByBikeId.get(activeBike.id) ? 'Reassign Rider' : 'Assign Rider'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignInsurer(true);
                      setAssignInsurerError(null);
                      setAssignInsurerId(activeBike.insurerUserId || 'none');
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover"
                  >
                    <Shield size={16} />
                    Assign Insurer
                  </button>
                </div>

                {/* Assign Rider Inline */}
                {showAssignRider && (
                  <div className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 space-y-3 animate-scale-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-ink">Select a rider</h4>
                      <button type="button" onClick={() => setShowAssignRider(false)} className="p-1 text-ink-muted hover:text-ink"><X size={14} /></button>
                    </div>
                    <select
                      value={assignRiderId}
                      onChange={(e) => setAssignRiderId(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="">— Select rider —</option>
                      {(ridersQuery.data?.data ?? []).map((rider) => (
                        <option key={rider.id} value={rider.id}>{rider.fullName ?? rider.email ?? rider.phone ?? rider.id.slice(0,8)}</option>
                      ))}
                    </select>
                    {assignRiderError && <p className="text-sm text-danger-ink">{assignRiderError}</p>}
                    <button
                      type="button"
                      onClick={handleAssignRider}
                      disabled={isAssigningRider || !assignRiderId}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                      style={{ background: '#3B82F6', color: 'white' }}
                    >
                      {isAssigningRider ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                  </div>
                )}

                {/* Assign Insurer Inline */}
                {showAssignInsurer && (
                  <div className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 space-y-3 animate-scale-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-ink">Select an insurer</h4>
                      <button type="button" onClick={() => setShowAssignInsurer(false)} className="p-1 text-ink-muted hover:text-ink"><X size={14} /></button>
                    </div>
                    {insurerUsers.length === 0 ? (
                      <p className="text-xs text-ink-muted">No insurer accounts in this fleet. Add a user with the INSURER role in Settings → Team first.</p>
                    ) : (
                      <>
                        <select
                          value={assignInsurerId}
                          onChange={(e) => setAssignInsurerId(e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="none">No Insurer (Unassign)</option>
                          {insurerUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.riderProfile?.fullName
                                ? `${u.riderProfile.fullName} (${u.email ?? u.phone ?? 'no contact'})`
                                : (u.email ?? u.phone ?? u.id.slice(0, 8))}
                            </option>
                          ))}
                        </select>
                        {assignInsurerError && <p className="text-sm text-danger-ink">{assignInsurerError}</p>}
                        <button
                          type="button"
                          onClick={handleAssignInsurer}
                          disabled={isAssigningInsurer}
                          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                          style={{ background: '#3B82F6', color: 'white' }}
                        >
                          {isAssigningInsurer ? 'Assigning...' : 'Confirm Insurer'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </DashboardCard>
            )}

            <DashboardCard
              eyebrow="Remote Control"
              title="Command actions"
              description="Send a lock or unlock request to the assigned device. Use the command history below to confirm acknowledgements."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!canSendCommands || isSendingCommand}
                  onClick={() => setCommandIntent('LOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger-ink px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: '#EF4444', color: 'white' }}
                >
                  <Lock size={16} />
                  Lock bike
                </button>
                <button
                  type="button"
                  disabled={!canSendCommands || isSendingCommand}
                  onClick={() => setCommandIntent('UNLOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-hover px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Unlock size={16} />
                  Unlock bike
                </button>
              </div>

              {!canUseFeature(currentUser, 'commands') ? (
                <InlineNotice message="Remote lock and unlock controls are available on Operations Plus." />
              ) : null}
              {commandError ? <InlineNotice message={commandError} /> : null}
            </DashboardCard>

            <section className="flex flex-col gap-4">
              <DetailPanel
                title="Recent trips"
                icon={<Gauge size={16} className="text-accent" />}
                emptyLabel="No trips recorded for this bike yet."
                loading={bikeTripsQuery.isLoading}
              >
                {(bikeTripsQuery.data?.data ?? []).map((trip) => (
                  <li key={trip.id} className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{formatTripDistance(trip.distanceKm)}</p>
                      <ScoreBadge score={trip.score} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">
                      {formatTimestamp(trip.startTs)} · {formatTripDuration(trip.durationSec)}
                    </p>
                  </li>
                ))}
              </DetailPanel>

              <DetailPanel
                title="Recent events"
                icon={<ShieldAlert size={16} className="text-accent" />}
                emptyLabel="No recent events linked to this bike."
                loading={bikeEventsQuery.isLoading}
              >
                {(bikeEventsQuery.data?.data ?? []).map((event) => (
                  <li key={event.id} className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{formatEnumLabel(event.type)}</p>
                      <EventSeverityBadge severity={event.severity} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">{formatTimestamp(event.ts)}</p>
                  </li>
                ))}
              </DetailPanel>

              <DetailPanel
                title="Command history"
                icon={<Activity size={16} className="text-accent" />}
                emptyLabel="No command activity for the selected bike."
                loading={false}
              >
                {bikeCommandStatuses.slice(0, 10).map((status) => (
                  <li
                    key={`${status.commandId}-${status.ts}`}
                    className="rounded-[18px] border border-line bg-surface-muted px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{status.action ?? 'Command'}</p>
                      <CommandStatusBadge status={status.status} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">{formatTimestamp(status.ts)}</p>
                    {status.message ? (
                      <p className="mt-1 text-xs leading-5 text-ink-soft">{status.message}</p>
                    ) : null}
                  </li>
                ))}
              </DetailPanel>
            </section>
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={!!commandIntent}
        title={commandIntent === 'LOCK' ? 'Confirm bike lock' : 'Confirm bike unlock'}
        description={
          commandIntent === 'LOCK'
            ? `Send a lock command for ${activeBike?.label ?? 'this bike'}?`
            : `Send an unlock command for ${activeBike?.label ?? 'this bike'}?`
        }
        confirmLabel={commandIntent === 'LOCK' ? 'Send lock request' : 'Send unlock request'}
        tone={commandIntent === 'LOCK' ? 'danger' : 'default'}
        isSubmitting={isSendingCommand}
        onCancel={() => setCommandIntent(null)}
        onConfirm={() => {
          if (commandIntent) {
            void requestCommand(commandIntent);
          }
        }}
      />

      {/* Create Bike Modal */}
      {showCreateBike && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateBike(false)}>
          <div className="relative mx-4 w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowCreateBike(false)} className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted hover:text-ink transition">
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-ink">Add New Bike</h2>
            <p className="mt-1 text-sm text-ink-muted">Register a new bike in your fleet inventory.</p>
            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Bike-001"
                  value={createBikeForm.label}
                  onChange={(e) => setCreateBikeForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Plate</label>
                  <input
                    type="text"
                    placeholder="RAB123C"
                    value={createBikeForm.plate}
                    onChange={(e) => setCreateBikeForm(f => ({ ...f, plate: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Serial</label>
                  <input
                    type="text"
                    placeholder="SER-000001"
                    value={createBikeForm.serial}
                    onChange={(e) => setCreateBikeForm(f => ({ ...f, serial: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Model</label>
                <input
                  type="text"
                  placeholder="eMoto-X2"
                  value={createBikeForm.model}
                  onChange={(e) => setCreateBikeForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Bike Type *</label>
                  <select
                    value={createBikeForm.type}
                    onChange={(e) => setCreateBikeForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-surface cursor-pointer"
                  >
                    <option value="SPIRO">SPIRO</option>
                    <option value="AMPARSAND">AMPARSAND</option>
                    <option value="AMAZI">AMAZI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Bike Image</label>
                  <div className="flex flex-col gap-2">
                    {createBikeForm.imageUrl ? (
                      <div className="relative group rounded-xl border border-line overflow-hidden max-h-[80px]">
                        <img src={createBikeForm.imageUrl} alt="Preview" className="w-full object-cover max-h-[80px]" />
                        <button
                          type="button"
                          onClick={() => setCreateBikeForm(f => ({ ...f, imageUrl: '' }))}
                          className="absolute top-1 right-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80 transition"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface-muted p-2 cursor-pointer hover:border-accent/40 transition max-h-[80px]">
                        <span className="text-xs font-semibold text-accent">Upload Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressImage(file);
                                setCreateBikeForm(f => ({ ...f, imageUrl: compressed }));
                              } catch (err) {
                                console.error('Image compression failed', err);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              {createBikeError && <p className="rounded-xl border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm text-danger-ink">{createBikeError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateBike(false)} className="flex-1 rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-hover">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBike}
                  disabled={isCreatingBike}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ background: '#3B82F6', color: 'white' }}
                >
                  {isCreatingBike ? 'Creating...' : 'Create Bike'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function DetailPanel({
  title,
  icon,
  emptyLabel,
  loading,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);

  return (
    <DashboardCard eyebrow={title} title={title} description="" className="h-full">
      <div className="mb-4 inline-flex rounded-[18px] bg-surface-muted p-3 text-accent">{icon}</div>
      {loading ? (
        <DrawerSkeleton />
      ) : items.length ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <EmptyState title={emptyLabel} description="This panel updates as soon as related backend data becomes available." />
      )}
    </DashboardCard>
  );
}

function BikeStatusBadge({ status }: { status: FleetBike['status'] }) {
  return (
    <span
      className={
        status === 'ACTIVE'
          ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
          : status === 'MAINTENANCE'
            ? 'inline-flex rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-ink'
            : 'inline-flex rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft'
      }
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function EventSeverityBadge({ severity }: { severity: FleetEvent['severity'] }) {
  return (
    <span
      className={
        severity === 'CRITICAL'
          ? 'inline-flex rounded-full bg-critical-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-critical-ink'
          : severity === 'HIGH'
            ? 'inline-flex rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-ink'
            : severity === 'MEDIUM'
              ? 'inline-flex rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent'
              : 'inline-flex rounded-full bg-low-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-low-ink'
      }
    >
      {severity}
    </span>
  );
}

function CommandStatusBadge({ status }: { status: CommandStatusEvent['status'] }) {
  return (
    <span
      className={
        status === 'ACKED'
          ? 'inline-flex rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
          : status === 'FAILED' || status === 'EXPIRED'
            ? 'inline-flex rounded-full bg-danger-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger-ink'
            : 'inline-flex rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent'
      }
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={
        score >= 85
          ? 'rounded-full bg-success-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-success-ink'
          : score >= 70
            ? 'rounded-full bg-warning-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning-ink'
            : 'rounded-full bg-danger-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-danger-ink'
      }
    >
      Score {score.toFixed(1)}
    </span>
  );
}

function formatTripDistance(distanceKm: number) {
  return `${distanceKm.toFixed(2)} km`;
}

function formatTripDuration(durationSec: number) {
  if (!durationSec) {
    return '0 min';
  }

  const hours = Math.floor(durationSec / 3600);
  const minutes = Math.max(1, Math.round((durationSec % 3600) / 60));
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours}h ${minutes}m`;
}

