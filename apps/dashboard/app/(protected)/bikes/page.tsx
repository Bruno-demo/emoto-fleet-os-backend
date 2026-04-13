'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bike,
  Cpu,
  Gauge,
  Lock,
  ShieldAlert,
  Unlock,
  UserRound,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { Badge } from '@/components/ui/badge';
import { canProvisionDevices, canViewAssignments } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type {
  Assignment,
  Bike as FleetBike,
  BikeTrip,
  CommandStatusEvent,
  Device,
  DeviceCommand,
  FleetEvent,
  PaginatedResponse,
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

const PAGE_SIZE = 20;

type CommandIntent = 'LOCK' | 'UNLOCK';

export default function BikesPage() {
  const { data: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const { commandStatuses, recordCommandStatus } = useRealtime();
  const [page, setPage] = useState(1);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandIntent, setCommandIntent] = useState<CommandIntent | null>(null);

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

    return bikes.filter((bike) => {
      const device = deviceByBikeId.get(bike.id);
      const assignment = assignmentByBikeId.get(bike.id);
      return [bike.label, bike.plate, bike.model, device?.deviceUid, assignment?.riderFullName]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
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

  const columns = useMemo<Array<DataTableColumn<FleetBike>>>(
    () => [
      {
        header: 'Bike',
        render: (bike) => (
          <div>
            <p className="font-semibold text-ink">{bike.label}</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              {bike.plate ?? bike.model ?? bike.serial ?? bike.id.slice(0, 8)}
            </p>
          </div>
        ),
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
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-accent transition hover:bg-white/[0.08] hover:border-accent/30"
            onClick={() => setSelectedBikeId(bike.id)}
          >
            View detail
          </button>
        ),
      },
    ],
    [assignmentByBikeId, deviceByBikeId],
  );

  return (
    <div className="space-y-6">
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
            <TextField
              label="Search"
              placeholder="Search bike, plate, rider, or device"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
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
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric label="Bike status" value={<BikeStatusBadge status={activeBike.status} />} />
              <KeyMetric
                label="Assigned device"
                value={<span>{deviceByBikeId.get(activeBike.id)?.deviceUid ?? 'Unassigned'}</span>}
              />
              <KeyMetric
                label="Assigned rider"
                value={<span>{assignmentByBikeId.get(activeBike.id)?.riderFullName ?? 'Unassigned'}</span>}
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

            <DashboardCard
              eyebrow="Remote Control"
              title="Command actions"
              description="Send a lock or unlock request to the assigned device. Use the command history below to confirm acknowledgements."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!currentUser || !canProvisionDevices(currentUser.role) || isSendingCommand}
                  onClick={() => setCommandIntent('LOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger-ink px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Lock size={16} />
                  Lock bike
                </button>
                <button
                  type="button"
                  disabled={!currentUser || !canProvisionDevices(currentUser.role) || isSendingCommand}
                  onClick={() => setCommandIntent('UNLOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Unlock size={16} />
                  Unlock bike
                </button>
              </div>

              {commandError ? <InlineNotice message={commandError} /> : null}
            </DashboardCard>

            <section className="grid gap-4 lg:grid-cols-3">
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
