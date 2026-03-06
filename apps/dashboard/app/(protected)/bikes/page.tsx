'use client';

import { useQuery } from '@tanstack/react-query';
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
  Bike,
  BikeTrip,
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
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  const bikesQuery = useQuery({
    queryKey: ['bikes', page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Bike>>(
        `/bikes${buildQueryString({ page, pageSize: PAGE_SIZE })}`,
      ),
  });

  const devicesQuery = useQuery({
    queryKey: ['devices', 'bike-join'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Device>>('/devices?page=1&pageSize=100'),
  });

  const assignmentsEnabled = !!currentUser && canViewAssignments(currentUser.role);
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'active'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Assignment>>(
        '/assignments?page=1&pageSize=100&active=true',
      ),
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
  }, [devicesQuery.data]);

  const assignmentByBikeId = useMemo(() => {
    const byBike = new Map<string, Assignment>();
    for (const assignment of assignmentsQuery.data?.data ?? []) {
      if (assignment.active) {
        byBike.set(assignment.bikeId, assignment);
      }
    }
    return byBike;
  }, [assignmentsQuery.data]);

  const selectedBike = useMemo(
    () => (bikesQuery.data?.data ?? []).find((bike) => bike.id === selectedBikeId) ?? null,
    [bikesQuery.data, selectedBikeId],
  );

  const selectedBikeDetailQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'detail'],
    queryFn: () => apiFetch<Bike>(`/bikes/${selectedBikeId}`),
    enabled: !!selectedBikeId && !selectedBike,
  });

  const activeBike = selectedBike ?? selectedBikeDetailQuery.data ?? null;

  const bikeTripsQuery = useQuery({
    queryKey: ['bikes', selectedBikeId, 'trips'],
    queryFn: () =>
      apiFetch<PaginatedResponse<BikeTrip>>(
        `/bikes/${selectedBikeId}/trips?page=1&pageSize=10`,
      ),
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

  // Sends lock/unlock command and keeps status stream synchronized in UI.
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
      recordCommandStatus({
        commandId: command.id,
        status: command.status,
        ts: command.updatedAt,
        bikeId: command.bikeId ?? undefined,
        deviceId: command.deviceId,
        action: command.type,
        message: command.errorMessage ?? undefined,
      });
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
      description="Fleet bike inventory with trip history, events and command stream."
    >
      <section className="overflow-x-auto rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft">
              <th className="px-2 py-2">Label</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Assigned Device</th>
              <th className="px-2 py-2">Assigned Rider</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(bikesQuery.data?.data ?? []).map((bike) => (
              <tr key={bike.id} className="border-t border-line">
                <td className="px-2 py-2 font-medium text-ink">{bike.label}</td>
                <td className="px-2 py-2">
                  <StatusPill
                    label={bike.status}
                    tone={
                      bike.status === 'ACTIVE'
                        ? 'success'
                        : bike.status === 'MAINTENANCE'
                          ? 'warning'
                          : 'neutral'
                    }
                  />
                </td>
                <td className="px-2 py-2 text-ink-soft">
                  {deviceByBikeId.get(bike.id)?.deviceUid ?? 'Unassigned'}
                </td>
                <td className="px-2 py-2 text-ink-soft">
                  {assignmentByBikeId.get(bike.id)?.riderFullName ?? 'Unassigned'}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-muted"
                    onClick={() => setSelectedBikeId(bike.id)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls
          page={bikesQuery.data?.page ?? page}
          totalPages={bikesQuery.data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </section>

      {activeBike ? (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-ink">
                {activeBike.label}
              </h2>
              <p className="text-sm text-ink-soft">Bike ID: {activeBike.id}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => requestCommand('LOCK')}
                disabled={isSendingCommand}
              >
                LOCK
              </button>
              <button
                type="button"
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                onClick={() => requestCommand('UNLOCK')}
                disabled={isSendingCommand}
              >
                UNLOCK
              </button>
            </div>
          </div>

          {commandError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {commandError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-line bg-surface-muted p-3">
              <h3 className="font-semibold text-ink">Recent Trips</h3>
              <ul className="mt-2 space-y-2">
                {(bikeTripsQuery.data?.data ?? []).map((trip) => (
                  <li key={trip.id} className="rounded-lg border border-line bg-white px-2 py-2">
                    <p className="text-xs text-ink-soft">
                      {new Date(trip.startTs).toLocaleString()}
                    </p>
                    <p className="text-sm text-ink">
                      {trip.distanceKm.toFixed(2)} km • {trip.score.toFixed(1)} score
                    </p>
                  </li>
                ))}
                {(bikeTripsQuery.data?.data ?? []).length === 0 ? (
                  <li className="text-sm text-ink-soft">No trips yet.</li>
                ) : null}
              </ul>
            </article>

            <article className="rounded-xl border border-line bg-surface-muted p-3">
              <h3 className="font-semibold text-ink">Recent Events</h3>
              <ul className="mt-2 space-y-2">
                {(bikeEventsQuery.data?.data ?? []).map((event) => (
                  <li key={event.id} className="rounded-lg border border-line bg-white px-2 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink">{event.type}</p>
                      <StatusPill label={event.severity} tone="warning" />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {new Date(event.ts).toLocaleString()}
                    </p>
                  </li>
                ))}
                {(bikeEventsQuery.data?.data ?? []).length === 0 ? (
                  <li className="text-sm text-ink-soft">No events in recent window.</li>
                ) : null}
              </ul>
            </article>

            <article className="rounded-xl border border-line bg-surface-muted p-3">
              <h3 className="font-semibold text-ink">Command History</h3>
              <ul className="mt-2 space-y-2">
                {bikeCommandStatuses.slice(0, 10).map((status) => (
                  <li
                    key={`${status.commandId}-${status.ts}`}
                    className="rounded-lg border border-line bg-white px-2 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink">{status.action ?? 'COMMAND'}</p>
                      <StatusPill
                        label={status.status}
                        tone={
                          status.status === 'ACKED'
                            ? 'success'
                            : status.status === 'FAILED'
                              ? 'danger'
                              : 'info'
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {new Date(status.ts).toLocaleString()}
                    </p>
                    {status.message ? (
                      <p className="mt-1 text-xs text-ink-soft">{status.message}</p>
                    ) : null}
                  </li>
                ))}
                {bikeCommandStatuses.length === 0 ? (
                  <li className="text-sm text-ink-soft">No command status for this bike yet.</li>
                ) : null}
              </ul>
            </article>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
