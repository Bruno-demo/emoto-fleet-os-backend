'use client';

import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { PageShell } from '@/components/layout/page-shell';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { StatusPill } from '@/components/ui/status-pill';
import { ToastItem, ToastStack } from '@/components/ui/toast-stack';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import type {
  Bike,
  CommandStatusEvent,
  DeviceCommand,
  LiveBikeState,
  PaginatedResponse,
} from '@/lib/types/dashboard';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const COMMAND_STREAM_LIMIT = 40;

export function LiveMapPanel() {
  const searchParams = useSearchParams();
  const { bikeStates, recentEvents, commandStatuses, recordCommandStatus } = useRealtime();
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [localCommandStatuses, setLocalCommandStatuses] = useState<CommandStatusEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastToastEventId = useRef<string | null>(null);

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'live-index'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Bike>>('/bikes?page=1&pageSize=100'),
  });

  const liveStatesQuery = useQuery({
    queryKey: ['live', 'bikes', 'initial'],
    queryFn: () =>
      apiFetch<PaginatedResponse<LiveBikeState>>('/live/bikes?page=1&pageSize=100'),
  });

  const bikesById = useMemo(() => {
    const map = new Map<string, Bike>();
    for (const bike of bikesQuery.data?.data ?? []) {
      map.set(bike.id, bike);
    }
    return map;
  }, [bikesQuery.data]);

  const mergedStates = useMemo(() => {
    const merged = new Map<string, LiveBikeState>();
    for (const state of liveStatesQuery.data?.data ?? []) {
      merged.set(state.bikeId, state);
    }
    for (const state of Object.values(bikeStates)) {
      merged.set(state.bikeId, state);
    }

    return Array.from(merged.values()).sort((left, right) =>
      right.ts.localeCompare(left.ts),
    );
  }, [bikeStates, liveStatesQuery.data]);

  useEffect(() => {
    const bikeIdFromQuery = searchParams.get('bikeId');
    if (!bikeIdFromQuery) {
      return;
    }
    setSelectedBikeId(bikeIdFromQuery);
  }, [searchParams]);

  useEffect(() => {
    const latestEvent = recentEvents[0];
    if (!latestEvent || latestEvent.id === lastToastEventId.current) {
      return;
    }

    lastToastEventId.current = latestEvent.id;
    const toastId = `event-${latestEvent.id}-${Date.now()}`;
    setToasts((currentToasts) => [
      {
        id: toastId,
        title: `New ${latestEvent.type} event`,
        message: `Severity ${latestEvent.severity} at ${new Date(latestEvent.ts).toLocaleTimeString()}`,
        tone: latestEvent.severity === 'CRITICAL' ? ('danger' as const) : ('warning' as const),
      },
      ...currentToasts,
    ].slice(0, 4));

    const timer = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentEvents]);

  const selectedBike = selectedBikeId ? bikesById.get(selectedBikeId) ?? null : null;
  const selectedState =
    mergedStates.find((state) => state.bikeId === selectedBikeId) ?? null;

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedState) {
      return [selectedState.lat, selectedState.lng];
    }
    if (mergedStates.length > 0) {
      return [mergedStates[0].lat, mergedStates[0].lng];
    }
    return [-1.944, 30.061];
  }, [mergedStates, selectedState]);

  const commandStream = useMemo(
    () =>
      [...localCommandStatuses, ...commandStatuses]
        .slice(0, COMMAND_STREAM_LIMIT)
        .sort((left, right) => right.ts.localeCompare(left.ts)),
    [localCommandStatuses, commandStatuses],
  );

  const bikeCommandStream = useMemo(
    () => commandStream.filter((item) => item.bikeId === selectedBikeId),
    [commandStream, selectedBikeId],
  );

  const lockRule = evaluateLockRule(selectedState);
  const unlockRule = evaluateUnlockRule(selectedState);

  // Sends lock/unlock request and records immediate response in command timeline.
  const sendCommand = async (action: 'LOCK' | 'UNLOCK') => {
    if (!selectedBikeId) {
      return;
    }

    setRequestError(null);
    try {
      setIsSendingCommand(true);
      const command = await apiFetch<DeviceCommand>(
        `/commands/${action.toLowerCase()}${buildQueryString({ bikeId: selectedBikeId })}`,
        { method: 'POST' },
      );

      const commandEvent: CommandStatusEvent = {
        commandId: command.id,
        status: command.status,
        ts: command.updatedAt,
        bikeId: command.bikeId ?? undefined,
        deviceId: command.deviceId,
        action: command.type,
        message: command.errorMessage ?? undefined,
      };

      recordCommandStatus(commandEvent);
      setLocalCommandStatuses((currentStatuses) => [commandEvent, ...currentStatuses]);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else {
        setRequestError('Failed to send command');
      }
    } finally {
      setIsSendingCommand(false);
    }
  };

  return (
    <PageShell
      title="Live Map"
      description="Realtime map updates, event feed, and command controls."
    >
      <ToastStack items={toasts} />

      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="h-[65vh] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mergedStates.map((bikeState) => {
              const bike = bikesById.get(bikeState.bikeId);
              return (
                <Marker
                  key={bikeState.bikeId}
                  position={[bikeState.lat, bikeState.lng]}
                  icon={markerIcon}
                  eventHandlers={{
                    click: () => {
                      setSelectedBikeId(bikeState.bikeId);
                    },
                  }}
                >
                  <Popup>
                    <p className="font-semibold">{bike?.label ?? bikeState.bikeId.slice(0, 8)}</p>
                    <p>Speed: {bikeState.speedKph.toFixed(1)} kph</p>
                    <p>Last update: {new Date(bikeState.ts).toLocaleString()}</p>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <aside className="h-[65vh] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-ink">Bike Control</h2>
          {!selectedBikeId ? (
            <p className="mt-3 text-sm text-ink-soft">
              Click a bike marker to open control actions.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              <section className="rounded-xl border border-line bg-surface-muted p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">Bike</p>
                <p className="mt-1 font-medium text-ink">
                  {selectedBike?.label ?? selectedBikeId.slice(0, 8)}
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  Speed: {selectedState ? `${selectedState.speedKph.toFixed(1)} kph` : '--'}
                </p>
                <p className="text-sm text-ink-soft">
                  Last seen:{' '}
                  {selectedState ? new Date(selectedState.ts).toLocaleTimeString() : 'No live state'}
                </p>
              </section>

              <section className="rounded-xl border border-line bg-surface-muted p-3">
                <p className="text-sm font-medium text-ink">Quick Actions</p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    disabled={isSendingCommand || !lockRule.allowed}
                    onClick={() => sendCommand('LOCK')}
                    className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSendingCommand ? 'Sending...' : 'LOCK'}
                  </button>
                  {!lockRule.allowed && lockRule.reason ? (
                    <p className="text-xs text-amber-700">{lockRule.reason}</p>
                  ) : null}

                  <button
                    type="button"
                    disabled={isSendingCommand || !unlockRule.allowed}
                    onClick={() => sendCommand('UNLOCK')}
                    className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSendingCommand ? 'Sending...' : 'UNLOCK'}
                  </button>
                  {!unlockRule.allowed && unlockRule.reason ? (
                    <p className="text-xs text-amber-700">{unlockRule.reason}</p>
                  ) : null}

                  {requestError ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                      {requestError}
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <p className="text-sm font-medium text-ink">Command Status</p>
                <ul className="mt-2 space-y-2">
                  {bikeCommandStream.slice(0, 8).map((status) => (
                    <li
                      key={`${status.commandId}-${status.ts}`}
                      className="rounded-lg border border-line bg-surface-muted px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-ink-soft">{status.action ?? 'COMMAND'}</p>
                        <StatusPill
                          label={status.status}
                          tone={
                            status.status === 'ACKED'
                              ? 'success'
                              : status.status === 'FAILED' || status.status === 'EXPIRED'
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
                  {bikeCommandStream.length === 0 ? (
                    <li className="text-sm text-ink-soft">No commands yet for this bike.</li>
                  ) : null}
                </ul>
              </section>
            </div>
          )}
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-ink">Recent Events</h3>
          <ul className="mt-3 space-y-2">
            {recentEvents.slice(0, 8).map((event) => (
              <li key={event.id} className="rounded-lg border border-line bg-surface-muted p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{event.type}</p>
                  <StatusPill
                    label={event.severity}
                    tone={
                      event.severity === 'CRITICAL'
                        ? 'danger'
                        : event.severity === 'HIGH'
                          ? 'warning'
                          : 'info'
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  Bike {event.bikeId?.slice(0, 8) ?? 'N/A'} at{' '}
                  {new Date(event.ts).toLocaleString()}
                </p>
              </li>
            ))}
            {recentEvents.length === 0 ? (
              <li className="text-sm text-ink-soft">Waiting for websocket events...</li>
            ) : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h3 className="font-display text-lg font-semibold text-ink">Live Bikes</h3>
          <ul className="mt-3 space-y-2">
            {mergedStates.slice(0, 10).map((state) => (
              <li
                key={state.bikeId}
                className="cursor-pointer rounded-lg border border-line bg-surface-muted px-3 py-2"
                onClick={() => setSelectedBikeId(state.bikeId)}
              >
                <p className="font-medium text-ink">
                  {bikesById.get(state.bikeId)?.label ?? state.bikeId.slice(0, 8)}
                </p>
                <p className="text-xs text-ink-soft">
                  {state.speedKph.toFixed(1)} kph | {new Date(state.ts).toLocaleTimeString()}
                </p>
              </li>
            ))}
            {mergedStates.length === 0 ? (
              <li className="text-sm text-ink-soft">No bike state available.</li>
            ) : null}
          </ul>
        </article>
      </section>
    </PageShell>
  );
}

function evaluateUnlockRule(state: LiveBikeState | null): {
  allowed: boolean;
  reason: string | null;
} {
  // Allows unlock only when there is a fresh state sample to avoid stale control actions.
  if (!state) {
    return {
      allowed: false,
      reason: 'No live state available for this bike',
    };
  }

  const ageMs = Date.now() - Date.parse(state.ts);
  if (ageMs > 30_000) {
    return {
      allowed: false,
      reason: 'No recent live state (<30s)',
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}

function evaluateLockRule(state: LiveBikeState | null): {
  allowed: boolean;
  reason: string | null;
} {
  // Mirrors backend lock safety gates to explain why lock is currently blocked.
  const unlockRule = evaluateUnlockRule(state);
  if (!unlockRule.allowed) {
    return unlockRule;
  }
  if (!state) {
    return {
      allowed: false,
      reason: 'No live state available for this bike',
    };
  }

  if (Math.abs(state.speedKph) > 0.01) {
    return {
      allowed: false,
      reason: 'Cannot lock while bike is moving',
    };
  }

  const stationaryMs = Date.now() - Date.parse(state.ts);
  if (stationaryMs < 15_000) {
    return {
      allowed: false,
      reason: 'Bike must remain at speed 0 for at least 15 seconds',
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}
