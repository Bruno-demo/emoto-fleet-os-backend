'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bike,
  Clock3,
  Cpu,
  Gauge,
  Lock,
  ShieldAlert,
  Unlock,
  UserRound,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { canViewAssignments } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
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

const PAGE_SIZE = 20;

export default function BikesPage() {
  const { data: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const { commandStatuses, recordCommandStatus } = useRealtime();
  const [page, setPage] = useState(1);
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

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

  const bikes = bikesQuery.data?.data ?? [];
  const totalAssignedDevices = bikes.filter((bike) => deviceByBikeId.has(bike.id)).length;
  const totalAssignedRiders = bikes.filter((bike) => assignmentByBikeId.has(bike.id)).length;
  const maintenanceCount = bikes.filter((bike) => bike.status === 'MAINTENANCE').length;

  // Sends a lock or unlock command and mirrors the first status in the websocket cache.
  const requestCommand = async (action: 'LOCK' | 'UNLOCK') => {
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

  return (
    <PageShell
      title="Bikes"
      description="Asset operations, rider assignment context, and remote control history for every bike in the fleet."
    >
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

      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Fleet Registry
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
              Bike inventory
            </h2>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search bike, plate, rider, or device..."
              className="min-w-[280px] rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
            />
            <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
              Showing {filteredBikes.length} of {bikes.length} bikes
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.16em] text-ink-soft">
                <th className="px-3 py-3">Bike</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Assigned Device</th>
                <th className="px-3 py-3">Assigned Rider</th>
                <th className="px-3 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredBikes.map((bike) => (
                <tr key={bike.id} className="border-b border-line/70 last:border-b-0">
                  <td className="px-3 py-4">
                    <div className="flex items-start gap-3">
                      <span className="rounded-2xl bg-accent-soft p-2 text-accent">
                        <Bike size={18} />
                      </span>
                      <div>
                        <p className="font-medium text-ink">{bike.label}</p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {bike.plate ?? bike.model ?? bike.serial ?? bike.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill label={bike.status} tone={bikeStatusTone(bike.status)} />
                  </td>
                  <td className="px-3 py-4 text-ink-soft">
                    {deviceByBikeId.get(bike.id)?.deviceUid ?? 'Unassigned'}
                  </td>
                  <td className="px-3 py-4 text-ink-soft">
                    {assignmentByBikeId.get(bike.id)?.riderFullName ?? 'Unassigned'}
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      className="rounded-2xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-muted"
                      onClick={() => setSelectedBikeId(bike.id)}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBikes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-soft">
                    No bikes match the current search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={bikesQuery.data?.page ?? page}
          totalPages={bikesQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </section>

      {activeBike ? (
        <section className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Bike Detail
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
                {activeBike.label}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill label={activeBike.status} tone={bikeStatusTone(activeBike.status)} />
                <StatusPill
                  label={deviceByBikeId.get(activeBike.id)?.deviceUid ?? 'No device'}
                  tone="info"
                />
                <StatusPill
                  label={assignmentByBikeId.get(activeBike.id)?.riderFullName ?? 'No rider'}
                  tone="neutral"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={() => requestCommand('LOCK')}
                disabled={isSendingCommand}
              >
                <Lock size={16} />
                {isSendingCommand ? 'Sending...' : 'Lock Bike'}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => requestCommand('UNLOCK')}
                disabled={isSendingCommand}
              >
                <Unlock size={16} />
                {isSendingCommand ? 'Sending...' : 'Unlock Bike'}
              </button>
            </div>
          </div>

          {commandError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {commandError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <DetailPanel
              title="Recent Trips"
              icon={<Gauge size={16} className="text-accent" />}
              emptyLabel="No trips recorded for this bike yet."
            >
              {(bikeTripsQuery.data?.data ?? []).map((trip) => (
                <li key={trip.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{formatTripDistance(trip.distanceKm)}</p>
                    <StatusPill
                      label={`Score ${trip.score.toFixed(1)}`}
                      tone={trip.score < 70 ? 'danger' : 'success'}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {formatTimestamp(trip.startTs)} · {formatTripDuration(trip.durationSec)}
                  </p>
                </li>
              ))}
            </DetailPanel>

            <DetailPanel
              title="Recent Events"
              icon={<ShieldAlert size={16} className="text-accent" />}
              emptyLabel="No recent events linked to this bike."
            >
              {(bikeEventsQuery.data?.data ?? []).map((event) => (
                <li key={event.id} className="rounded-2xl border border-line bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{formatLabel(event.type)}</p>
                    <StatusPill label={event.severity} tone={eventSeverityTone(event.severity)} />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{formatTimestamp(event.ts)}</p>
                </li>
              ))}
            </DetailPanel>

            <DetailPanel
              title="Command History"
              icon={<Activity size={16} className="text-accent" />}
              emptyLabel="No command activity for the selected bike."
            >
              {bikeCommandStatuses.slice(0, 10).map((status) => (
                <li
                  key={`${status.commandId}-${status.ts}`}
                  className="rounded-2xl border border-line bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-ink">{status.action ?? 'Command'}</p>
                    <StatusPill label={status.status} tone={commandStatusTone(status.status)} />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{formatTimestamp(status.ts)}</p>
                  {status.message ? (
                    <p className="mt-1 text-xs text-ink-soft">{status.message}</p>
                  ) : null}
                </li>
              ))}
            </DetailPanel>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <SummaryTile
              label="Assigned Device"
              value={deviceByBikeId.get(activeBike.id)?.deviceUid ?? 'Unassigned'}
              icon={<Cpu size={16} />}
            />
            <SummaryTile
              label="Assigned Rider"
              value={assignmentByBikeId.get(activeBike.id)?.riderFullName ?? 'Unassigned'}
              icon={<UserRound size={16} />}
            />
            <SummaryTile
              label="Last Trip Start"
              value={
                bikeTripsQuery.data?.data?.[0]?.startTs
                  ? formatTimestamp(bikeTripsQuery.data.data[0].startTs)
                  : 'No trips yet'
              }
              icon={<Clock3 size={16} />}
            />
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: 'info' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-700'
      : tone === 'warning'
        ? 'bg-warning-soft text-amber-700'
        : 'bg-accent-soft text-accent';

  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            {title}
          </p>
          <p className="mt-4 font-display text-4xl font-semibold text-ink">{value}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-soft">{hint}</p>
    </article>
  );
}

function DetailPanel({
  title,
  icon,
  emptyLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <article className="rounded-[28px] border border-line bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white p-2">{icon}</span>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      </div>
      <ul className="mt-4 space-y-3">
        {items.filter(Boolean).length > 0 ? (
          children
        ) : (
          <li className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-ink-soft">
            {emptyLabel}
          </li>
        )}
      </ul>
    </article>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-muted px-4 py-4">
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function bikeStatusTone(status: FleetBike['status']) {
  if (status === 'ACTIVE') {
    return 'success' as const;
  }
  if (status === 'MAINTENANCE') {
    return 'warning' as const;
  }
  return 'neutral' as const;
}

function eventSeverityTone(severity: FleetEvent['severity']) {
  if (severity === 'CRITICAL') {
    return 'danger' as const;
  }
  if (severity === 'HIGH') {
    return 'warning' as const;
  }
  if (severity === 'MEDIUM') {
    return 'info' as const;
  }
  return 'neutral' as const;
}

function commandStatusTone(status: CommandStatusEvent['status']) {
  if (status === 'ACKED') {
    return 'success' as const;
  }
  if (status === 'FAILED' || status === 'EXPIRED') {
    return 'danger' as const;
  }
  return 'info' as const;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
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

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
