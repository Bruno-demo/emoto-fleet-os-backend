'use client';

import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import {
  Bike,
  Eye,
  Lock,
  Navigation,
  Radio,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
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
  Bike as FleetBike,
  CommandStatusEvent,
  DeviceCommand,
  FleetEvent,
  LiveBikeState,
  PaginatedResponse,
} from '@/lib/types/dashboard';

const COMMAND_STREAM_LIMIT = 40;
const FRESH_STATE_WINDOW_MS = 60_000;

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
    queryFn: () => apiFetch<PaginatedResponse<FleetBike>>('/bikes?page=1&pageSize=100'),
  });

  const liveStatesQuery = useQuery({
    queryKey: ['live', 'bikes', 'initial'],
    queryFn: () => apiFetch<PaginatedResponse<LiveBikeState>>('/live/bikes?page=1&pageSize=100'),
  });

  const bikesById = useMemo(() => {
    const map = new Map<string, FleetBike>();
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

  const latestEventByBike = useMemo(() => {
    const map = new Map<string, FleetEvent>();
    for (const event of recentEvents) {
      if (event.bikeId && !map.has(event.bikeId)) {
        map.set(event.bikeId, event);
      }
    }
    return map;
  }, [recentEvents]);

  useEffect(() => {
    const bikeIdFromQuery = searchParams.get('bikeId');
    if (bikeIdFromQuery) {
      setSelectedBikeId(bikeIdFromQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedBikeId || mergedStates.length === 0) {
      return;
    }
    setSelectedBikeId(mergedStates[0]?.bikeId ?? null);
  }, [mergedStates, selectedBikeId]);

  useEffect(() => {
    const latestEvent = recentEvents[0];
    if (!latestEvent || latestEvent.id === lastToastEventId.current) {
      return;
    }

    lastToastEventId.current = latestEvent.id;
    const toastId = `event-${latestEvent.id}-${Date.now()}`;
    setToasts((currentToasts) =>
      [
        {
          id: toastId,
          title: `New ${formatLabel(latestEvent.type)} event`,
          message: `Severity ${latestEvent.severity} at ${new Date(latestEvent.ts).toLocaleTimeString()}`,
          tone: latestEvent.severity === 'CRITICAL' ? ('danger' as const) : ('warning' as const),
        },
        ...currentToasts,
      ].slice(0, 4),
    );

    const timer = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentEvents]);

  const selectedBike = selectedBikeId ? bikesById.get(selectedBikeId) ?? null : null;
  const selectedState = mergedStates.find((state) => state.bikeId === selectedBikeId) ?? null;

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

  const onlineCount = mergedStates.filter((state) => isFreshState(state.ts)).length;
  const movingCount = mergedStates.filter((state) => state.speedKph >= 5).length;
  const alertCount = recentEvents.filter(
    (event) => event.severity === 'HIGH' || event.severity === 'CRITICAL',
  ).length;

  const lockRule = evaluateLockRule(selectedState);
  const unlockRule = evaluateUnlockRule(selectedState);

  // Sends lock or unlock request and stores the immediate status response locally.
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
      title="Live Operations"
      description="Track bikes in motion, inspect alerts, and issue lock or unlock commands from a single dispatcher surface."
    >
      <ToastStack items={toasts} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-white shadow-[var(--shadow)]">
          <div className="absolute left-4 top-4 z-[500] flex flex-wrap gap-3">
            <MapOverlayChip
              icon={<Navigation size={15} />}
              label="Kigali, Rwanda"
              tone="neutral"
            />
            <MapOverlayChip
              icon={<Bike size={15} />}
              label={`${onlineCount} bikes online`}
              tone="success"
            />
            <MapOverlayChip
              icon={<ShieldAlert size={15} />}
              label={`${alertCount} active alerts`}
              tone="danger"
            />
          </div>

          <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-line bg-white/96 p-4 shadow-lg backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Legend
            </p>
            <div className="mt-3 grid gap-2 text-xs text-ink-soft sm:grid-cols-2">
              <LegendItem color="bg-rose-500" label="Critical event" />
              <LegendItem color="bg-amber-500" label="High severity" />
              <LegendItem color="bg-accent" label="Moving bike" />
              <LegendItem color="bg-emerald-500" label="Online and stable" />
            </div>
          </div>

          <div className="h-[68vh] min-h-[540px]">
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {mergedStates.map((bikeState) => {
                const bike = bikesById.get(bikeState.bikeId);
                const latestEvent = latestEventByBike.get(bikeState.bikeId);

                return (
                  <Marker
                    key={bikeState.bikeId}
                    position={[bikeState.lat, bikeState.lng]}
                    icon={createBikeMarkerIcon({
                      selected: bikeState.bikeId === selectedBikeId,
                      severity: latestEvent?.severity,
                      moving: bikeState.speedKph >= 5,
                    })}
                    eventHandlers={{
                      click: () => {
                        setSelectedBikeId(bikeState.bikeId);
                      },
                    }}
                  >
                    <Popup>
                      <p className="font-semibold">
                        {bike?.label ?? bikeState.bikeId.slice(0, 8)}
                      </p>
                      <p>Speed: {bikeState.speedKph.toFixed(1)} kph</p>
                      <p>Last update: {new Date(bikeState.ts).toLocaleString()}</p>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        <aside className="flex h-[68vh] min-h-[540px] flex-col overflow-hidden rounded-[28px] border border-line bg-white shadow-[var(--shadow)]">
          <div className="border-b border-line bg-gradient-to-r from-surface-muted to-white px-5 py-4">
            <h2 className="font-display text-xl font-semibold text-ink">Live Feed</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Realtime alerts, bike context, and command actions.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <section className="rounded-3xl border border-line bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
                    Selected Bike
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold text-ink">
                    {selectedBike?.label ?? 'No bike selected'}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {selectedBike?.plate ?? selectedBike?.model ?? 'Select a bike marker on the map'}
                  </p>
                </div>
                {selectedState ? (
                  <StatusPill
                    label={selectedState.speedKph >= 5 ? 'MOVING' : 'ONLINE'}
                    tone={selectedState.speedKph >= 5 ? 'info' : 'success'}
                  />
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniMetric
                  label="Current Speed"
                  value={selectedState ? `${selectedState.speedKph.toFixed(1)} kph` : '--'}
                />
                <MiniMetric
                  label="Last Seen"
                  value={selectedState ? formatTimeAgo(selectedState.ts) : '--'}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Quick Actions</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Backend lock rules are mirrored here before dispatch.
                  </p>
                </div>
                <Radio size={16} className="text-accent" />
              </div>

              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  disabled={isSendingCommand || !lockRule.allowed}
                  onClick={() => sendCommand('LOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Lock size={16} />
                  {isSendingCommand ? 'Sending...' : 'Lock Bike'}
                </button>
                {!lockRule.allowed && lockRule.reason ? (
                  <p className="text-xs text-amber-700">{lockRule.reason}</p>
                ) : null}

                <button
                  type="button"
                  disabled={isSendingCommand || !unlockRule.allowed}
                  onClick={() => sendCommand('UNLOCK')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Unlock size={16} />
                  {isSendingCommand ? 'Sending...' : 'Unlock Bike'}
                </button>
                {!unlockRule.allowed && unlockRule.reason ? (
                  <p className="text-xs text-amber-700">{unlockRule.reason}</p>
                ) : null}

                {requestError ? (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {requestError}
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink">Recent Alerts</h3>
                <span className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                  Realtime
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {recentEvents.slice(0, 8).map((event) => {
                  const linkedBike = event.bikeId ? bikesById.get(event.bikeId) : null;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedBikeId(event.bikeId)}
                      className="w-full rounded-2xl border border-line bg-surface-muted p-4 text-left transition hover:bg-surface-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{formatLabel(event.type)}</p>
                          <p className="mt-1 text-xs text-ink-soft">
                            {linkedBike?.label ?? event.bikeId?.slice(0, 8) ?? 'Fleet event'} ·{' '}
                            {formatTimeAgo(event.ts)}
                          </p>
                        </div>
                        <StatusPill
                          label={event.severity}
                          tone={severityToTone(event.severity)}
                        />
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
                        <Eye size={13} />
                        View bike context
                      </div>
                    </button>
                  );
                })}
                {recentEvents.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-ink-soft">
                    Waiting for websocket events.
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink">Command Status</h3>
                <span className="text-xs uppercase tracking-[0.16em] text-ink-soft">Latest</span>
              </div>

              <ul className="mt-3 space-y-2">
                {bikeCommandStream.slice(0, 6).map((status) => (
                  <li
                    key={`${status.commandId}-${status.ts}`}
                    className="rounded-2xl border border-line bg-surface-muted px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {status.action ?? 'Command'}
                      </p>
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
                    <p className="mt-1 text-xs text-ink-soft">{formatTimeAgo(status.ts)}</p>
                    {status.message ? (
                      <p className="mt-1 text-xs text-ink-soft">{status.message}</p>
                    ) : null}
                  </li>
                ))}
                {bikeCommandStream.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">
                    No command activity for the current bike.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title="Fleet Coverage"
          metric={`${onlineCount}/${mergedStates.length || '--'}`}
          description="Bikes with a fresh live-state sample in the last minute."
        />
        <SummaryCard
          title="Bikes Moving"
          metric={String(movingCount)}
          description="Bikes currently reporting a speed of at least 5 kph."
        />
        <SummaryCard
          title="Recent High Risk"
          metric={String(alertCount)}
          description="High or critical alerts currently visible in the live feed."
        />
      </section>
    </PageShell>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-2 font-semibold text-ink">{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  metric,
  description,
}: {
  title: string;
  metric: string;
  description: string;
}) {
  return (
    <article className="rounded-[28px] border border-line bg-white p-5 shadow-[var(--shadow)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">{title}</p>
      <p className="mt-4 font-display text-4xl font-semibold text-ink">{metric}</p>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{description}</p>
    </article>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function MapOverlayChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'neutral' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success-soft text-emerald-800'
      : tone === 'danger'
        ? 'bg-danger-soft text-rose-800'
        : 'bg-white text-ink';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm font-medium shadow-lg ${toneClass}`}
    >
      {icon}
      {label}
    </div>
  );
}

function createBikeMarkerIcon({
  selected,
  severity,
  moving,
}: {
  selected: boolean;
  severity?: FleetEvent['severity'];
  moving: boolean;
}) {
  const color =
    severity === 'CRITICAL'
      ? '#ef4444'
      : severity === 'HIGH'
        ? '#f59e0b'
        : moving
          ? '#2563eb'
          : '#22c55e';

  return L.divIcon({
    className: 'emoto-bike-marker',
    html: `
      <div style="
        width: ${selected ? 28 : 22}px;
        height: ${selected ? 28 : 22}px;
        border-radius: 999px;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.22);
      "></div>
    `,
    iconSize: selected ? [28, 28] : [22, 22],
    iconAnchor: selected ? [14, 14] : [11, 11],
    popupAnchor: [0, -12],
  });
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function isFreshState(ts: string) {
  return Date.now() - Date.parse(ts) <= FRESH_STATE_WINDOW_MS;
}

function formatTimeAgo(ts: string) {
  const diffMs = Date.now() - Date.parse(ts);
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Date(ts).toLocaleString();
}

function severityToTone(severity: FleetEvent['severity']) {
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


