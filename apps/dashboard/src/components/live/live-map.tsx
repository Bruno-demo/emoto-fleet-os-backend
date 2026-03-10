'use client';

import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import {
  AlertTriangle,
  Bike,
  Crosshair,
  Gauge,
  Lock,
  Radio,
  ShieldAlert,
  Siren,
  Unlock,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { PageShell } from '@/components/layout/page-shell';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { canProvisionDevices, canViewAssignments } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import {
  Assignment,
  Bike as FleetBike,
  CommandStatusEvent,
  DeviceCommand,
  FleetEvent,
  LiveBikeState,
  PaginatedResponse,
} from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo, formatTimestamp } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard, MetricCard } from '@/components/ui/dashboard-card';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { DrawerSkeleton, Skeleton } from '@/components/ui/skeleton';
import { ToastItem, ToastStack } from '@/components/ui/toast-stack';

const BIKE_EVENT_LIMIT = 5;
const COMMAND_STREAM_LIMIT = 40;
const EVENT_FEED_LIMIT = 10;
const FRESH_STATE_WINDOW_MS = 60_000;
const MAP_DEFAULT_CENTER: [number, number] = [-1.944, 30.061];
const MAP_REFRESH_THROTTLE_MS = 750;

type CommandIntent = 'LOCK' | 'UNLOCK';

export function LiveMapPanel() {
  const searchParams = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const { bikeStates, recentEvents, commandStatuses, recordCommandStatus } = useRealtime();
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandIntent, setCommandIntent] = useState<CommandIntent | null>(null);
  const [localCommandStatuses, setLocalCommandStatuses] = useState<CommandStatusEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [centerSignal, setCenterSignal] = useState(0);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const pendingToastEventsRef = useRef<FleetEvent[]>([]);
  const toastFlushTimerRef = useRef<number | null>(null);
  const toastDismissTimersRef = useRef<number[]>([]);

  const bikesQuery = useQuery({
    queryKey: ['bikes', 'live-index'],
    queryFn: () => apiFetch<PaginatedResponse<FleetBike>>('/bikes?page=1&pageSize=100'),
  });

  const liveStatesQuery = useQuery({
    queryKey: ['live', 'bikes', 'initial'],
    queryFn: () => apiFetch<PaginatedResponse<LiveBikeState>>('/live/bikes?page=1&pageSize=100'),
  });

  const initialEventsQuery = useQuery({
    queryKey: ['events', 'live-feed'],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetEvent>>(
        `/events${buildQueryString({ page: 1, pageSize: EVENT_FEED_LIMIT })}`,
      ),
  });

  const assignmentsEnabled = !!currentUser && canViewAssignments(currentUser.role);
  const assignmentsQuery = useQuery({
    queryKey: ['assignments', 'live-active'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Assignment>>('/assignments?page=1&pageSize=100&active=true'),
    enabled: assignmentsEnabled,
    retry: false,
  });

  const selectedBikeEventsQuery = useQuery({
    queryKey: ['events', 'bike-drawer', selectedBikeId],
    queryFn: () =>
      apiFetch<PaginatedResponse<FleetEvent>>(
        `/events${buildQueryString({
          bikeId: selectedBikeId,
          page: 1,
          pageSize: BIKE_EVENT_LIMIT,
        })}`,
      ),
    enabled: !!selectedBikeId,
  });

  const bikesById = useMemo(() => {
    const bikeMap = new Map<string, FleetBike>();
    for (const bike of bikesQuery.data?.data ?? []) {
      bikeMap.set(bike.id, bike);
    }
    return bikeMap;
  }, [bikesQuery.data?.data]);

  const assignmentByBikeId = useMemo(() => {
    const assignmentMap = new Map<string, Assignment>();
    for (const assignment of assignmentsQuery.data?.data ?? []) {
      if (assignment.active) {
        assignmentMap.set(assignment.bikeId, assignment);
      }
    }
    return assignmentMap;
  }, [assignmentsQuery.data?.data]);

  const mergedStates = useMemo(
    () => mergeLiveStates(liveStatesQuery.data?.data ?? [], Object.values(bikeStates)),
    [bikeStates, liveStatesQuery.data?.data],
  );

  const throttledStates = useThrottledValue(mergedStates, MAP_REFRESH_THROTTLE_MS);

  const feedEvents = useMemo(
    () => mergeEvents(initialEventsQuery.data?.data ?? [], recentEvents).slice(0, EVENT_FEED_LIMIT),
    [initialEventsQuery.data?.data, recentEvents],
  );

  const latestEventByBike = useMemo(() => {
    const eventMap = new Map<string, FleetEvent>();
    for (const event of feedEvents) {
      if (event.bikeId && !eventMap.has(event.bikeId)) {
        eventMap.set(event.bikeId, event);
      }
    }
    return eventMap;
  }, [feedEvents]);

  const commandStream = useMemo(
    () => mergeCommandStatuses(localCommandStatuses, commandStatuses).slice(0, COMMAND_STREAM_LIMIT),
    [commandStatuses, localCommandStatuses],
  );

  const selectedBike = selectedBikeId ? bikesById.get(selectedBikeId) ?? null : null;
  const selectedState = throttledStates.find((state) => state.bikeId === selectedBikeId) ?? null;
  const selectedAssignment = selectedBikeId ? assignmentByBikeId.get(selectedBikeId) ?? null : null;
  const selectedBikeEvents = selectedBikeEventsQuery.data?.data ?? [];

  const canSendCommands = currentUser ? canProvisionDevices(currentUser.role) : false;
  const selectedCommandStream = useMemo(
    () => commandStream.filter((item) => item.bikeId === selectedBikeId).slice(0, 6),
    [commandStream, selectedBikeId],
  );

  const onlineCount = throttledStates.filter((state) => isFreshState(state.ts)).length;
  const movingCount = throttledStates.filter((state) => state.speedKph >= 5).length;
  const criticalCount = feedEvents.filter((event) => event.severity === 'CRITICAL').length;
  const highPriorityCount = feedEvents.filter(
    (event) => event.severity === 'HIGH' || event.severity === 'CRITICAL',
  ).length;

  const lockRule = evaluateLockRule(selectedState);
  const unlockRule = evaluateUnlockRule(selectedState);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedState) {
      return [selectedState.lat, selectedState.lng];
    }
    if (throttledStates[0]) {
      return [throttledStates[0].lat, throttledStates[0].lng];
    }
    return MAP_DEFAULT_CENTER;
  }, [selectedState, throttledStates]);

  // Applies the bikeId route hint so deep links can open a bike drawer directly.
  useEffect(() => {
    const bikeIdFromQuery = searchParams.get('bikeId');
    if (bikeIdFromQuery) {
      setSelectedBikeId(bikeIdFromQuery);
    }
  }, [searchParams]);

  // Keeps an initial selection in place once the map has live bikes to focus on.
  useEffect(() => {
    if (selectedBikeId || throttledStates.length === 0) {
      return;
    }
    setSelectedBikeId(throttledStates[0]?.bikeId ?? null);
  }, [selectedBikeId, throttledStates]);

  // Batches bursty realtime events into grouped toasts so the operator feed stays readable.
  useEffect(() => {
    const unseenEvents = recentEvents.filter((event) => !seenEventIdsRef.current.has(event.id));
    if (!unseenEvents.length) {
      return;
    }

    for (const event of unseenEvents) {
      seenEventIdsRef.current.add(event.id);
    }

    pendingToastEventsRef.current = [
      ...unseenEvents.reverse(),
      ...pendingToastEventsRef.current,
    ].slice(0, EVENT_FEED_LIMIT);

    if (toastFlushTimerRef.current !== null) {
      return;
    }

    toastFlushTimerRef.current = window.setTimeout(() => {
      const batch = pendingToastEventsRef.current.splice(0, pendingToastEventsRef.current.length);
      toastFlushTimerRef.current = null;
      if (!batch.length) {
        return;
      }

      const toast = buildGroupedEventToast(batch);
      setToasts((currentToasts) => [toast, ...currentToasts].slice(0, 4));

      const dismissTimer = window.setTimeout(() => {
        setToasts((currentToasts) =>
          currentToasts.filter((currentToast) => currentToast.id !== toast.id),
        );
      }, 5000);
      toastDismissTimersRef.current.push(dismissTimer);
    }, 1200);
  }, [recentEvents]);

  // Clears grouped-toast timers when the live command center unmounts.
  useEffect(() => {
    const dismissTimers = toastDismissTimersRef.current;
    return () => {
      if (toastFlushTimerRef.current !== null) {
        window.clearTimeout(toastFlushTimerRef.current);
      }
      for (const dismissTimer of dismissTimers) {
        window.clearTimeout(dismissTimer);
      }
    };
  }, []);

  // Selects a bike and optionally recenters the map when the operator jumps from the feed.
  const selectBikeContext = useCallback((bikeId: string | null, shouldCenter = false) => {
    setSelectedBikeId(bikeId);
    if (bikeId && shouldCenter) {
      setCenterSignal((currentSignal) => currentSignal + 1);
    }
  }, []);

  // Sends a lock or unlock request while preserving the returned status in the realtime cache.
  const sendCommand = useCallback(
    async (action: CommandIntent) => {
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
        setCommandIntent(null);
      } catch (error: unknown) {
        if (error instanceof ApiError) {
          setRequestError(error.message);
        } else {
          setRequestError('Failed to send command');
        }
      } finally {
        setIsSendingCommand(false);
      }
    },
    [recordCommandStatus, selectedBikeId],
  );

  const selectedCommandRule = commandIntent === 'LOCK' ? lockRule : unlockRule;
  const selectedBikeLabel = selectedBike?.label ?? maskIdentifier(selectedBikeId);

  return (
    <PageShell
      title="Live Command Center"
      description="Monitor active bikes, triage new alerts, and dispatch lock or unlock commands without leaving the realtime map surface."
    >
      <ToastStack items={toasts} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Bikes Online"
          value={String(onlineCount)}
          hint="Bikes with a fresh state sample in the last minute."
          icon={<Radio size={18} />}
          tone="success"
        />
        <MetricCard
          title="Bikes Moving"
          value={String(movingCount)}
          hint="Bikes currently reporting at least 5 kph."
          icon={<Gauge size={18} />}
          tone="info"
        />
        <MetricCard
          title="High Priority"
          value={String(highPriorityCount)}
          hint="High and critical alerts visible in the live feed."
          icon={<ShieldAlert size={18} />}
          tone="warning"
        />
        <MetricCard
          title="Critical Alerts"
          value={String(criticalCount)}
          hint="Critical alerts needing immediate dispatcher review."
          icon={<Siren size={18} />}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_24rem]">
        <DashboardCard
          eyebrow="Realtime Map"
          title="Fleet position"
          description="The map refresh is throttled to keep marker movement smooth while websocket telemetry continues streaming in the background."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCenterSignal((currentSignal) => currentSignal + 1)}
                disabled={!selectedState}
                className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Crosshair size={16} />
                Center on bike
              </button>
              <div className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-4 py-2.5 text-sm text-ink-soft">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Stable
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                Moving
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Critical
              </div>
            </div>
          }
          contentClassName="p-0"
        >
          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-4 z-[500] flex flex-wrap gap-2">
              <MapChip label={`${onlineCount} online`} tone="success" />
              <MapChip label={`${movingCount} moving`} tone="info" />
              <MapChip label={`${highPriorityCount} alerts`} tone="danger" />
            </div>

            {liveStatesQuery.isLoading ? (
              <div className="h-[72vh] min-h-[560px] p-5">
                <Skeleton className="h-full w-full rounded-[calc(var(--radius-panel)-6px)]" />
              </div>
            ) : throttledStates.length === 0 ? (
              <div className="flex h-[72vh] min-h-[560px] items-center justify-center p-6">
                <EmptyState
                  icon={<Bike size={18} />}
                  title="No live bike states yet"
                  description="The map will populate as soon as telemetry updates or Redis live-state snapshots arrive for this fleet."
                />
              </div>
            ) : (
              <div className="h-[72vh] min-h-[560px] overflow-hidden rounded-b-[var(--radius-panel)]">
                <MapContainer center={mapCenter} zoom={13} className="h-full w-full" zoomControl>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapViewportController
                    centerSignal={centerSignal}
                    target={selectedState ? [selectedState.lat, selectedState.lng] : null}
                  />
                  {throttledStates.map((state) => (
                    <LiveBikeMarker
                      key={state.bikeId}
                      state={state}
                      label={bikesById.get(state.bikeId)?.label ?? maskIdentifier(state.bikeId) ?? 'Bike'}
                      severity={latestEventByBike.get(state.bikeId)?.severity}
                      selected={state.bikeId === selectedBikeId}
                      onSelect={selectBikeContext}
                    />
                  ))}
                </MapContainer>
              </div>
            )}
          </div>
        </DashboardCard>

        <DashboardCard
          eyebrow="Triage Feed"
          title="Live queue"
          description="Recent alerts and command acknowledgements stay visible even while the bike drawer is open."
          className="h-fit xl:sticky xl:top-6"
        >
          <div className="space-y-5">
            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Recent alerts</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Click an alert to open bike context in the drawer.
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Realtime
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {feedEvents.length ? (
                  feedEvents.map((event) => {
                    const linkedBike = event.bikeId ? bikesById.get(event.bikeId) : null;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => selectBikeContext(event.bikeId, true)}
                        disabled={!event.bikeId}
                        className="w-full rounded-[20px] border border-line bg-surface-muted px-4 py-3 text-left transition hover:bg-surface-hover disabled:cursor-default disabled:opacity-70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{formatEnumLabel(event.type)}</p>
                            <p className="mt-1 text-xs leading-5 text-ink-soft">
                              {linkedBike?.label ?? maskIdentifier(event.bikeId) ?? 'Fleet event'}
                              {' · '}
                              {formatTimeAgo(event.ts)}
                            </p>
                          </div>
                          <SeverityBadge severity={event.severity} />
                        </div>
                      </button>
                    );
                  })
                ) : initialEventsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded-[20px]" />
                    <Skeleton className="h-20 w-full rounded-[20px]" />
                  </div>
                ) : (
                  <EmptyState
                    icon={<AlertTriangle size={18} />}
                    title="No recent alerts"
                    description="New crash, theft, SOS, and scoring events will appear here as they arrive."
                  />
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Command stream</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Recent lock and unlock state changes across the fleet.
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Last {Math.min(commandStream.length, 6)}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {commandStream.slice(0, 6).length ? (
                  commandStream.slice(0, 6).map((status) => (
                    <li
                      key={`${status.commandId}-${status.ts}`}
                      className="rounded-[20px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{status.action ?? 'Command'}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {maskIdentifier(status.bikeId) || 'Fleet command'} {' · '}
                            {formatTimeAgo(status.ts)}
                          </p>
                        </div>
                        <CommandBadge status={status.status} />
                      </div>
                      {status.message ? (
                        <p className="mt-2 text-xs leading-5 text-ink-soft">{status.message}</p>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <EmptyState
                    icon={<Lock size={18} />}
                    title="No command activity yet"
                    description="Command acknowledgements will appear here after the first lock or unlock request is sent."
                  />
                )}
              </ul>
            </section>
          </div>
        </DashboardCard>
      </section>

      <Drawer
        open={!!selectedBikeId}
        title={selectedBike?.label ?? 'Bike detail'}
        description="Live bike context, rider assignment, recent events, and safe command controls."
        onClose={() => {
          setSelectedBikeId(null);
          setRequestError(null);
          setCommandIntent(null);
        }}
      >
        {!selectedBikeId ? null : bikesQuery.isLoading || liveStatesQuery.isLoading ? (
          <DrawerSkeleton />
        ) : !selectedBike && !selectedState ? (
          <EmptyState
            icon={<Bike size={18} />}
            title="Bike context unavailable"
            description="This bike is no longer present in the loaded map or live-state cache."
          />
        ) : (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric
                label="Current speed"
                value={selectedState ? `${selectedState.speedKph.toFixed(1)} kph` : '--'}
              />
              <KeyMetric
                label="Last seen"
                value={selectedState ? formatTimeAgo(selectedState.ts) : 'No live state'}
              />
              <KeyMetric
                label="Assigned rider"
                value={
                  selectedAssignment?.riderFullName ??
                  (assignmentsEnabled ? 'Unassigned' : 'Access limited')
                }
              />
              <KeyMetric
                label="Ignition"
                value={
                  selectedState?.ignition === undefined
                    ? '--'
                    : selectedState.ignition
                      ? 'On'
                      : 'Off'
                }
              />
            </section>

            <DashboardCard
              eyebrow="Control"
              title="Bike actions"
              description="The UI mirrors backend safety rules before a command is sent."
              actions={
                <button
                  type="button"
                  onClick={() => setCenterSignal((currentSignal) => currentSignal + 1)}
                  disabled={!selectedState}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Crosshair size={16} />
                  Center on map
                </button>
              }
            >
              <div className="space-y-3">
                <ActionButton
                  icon={<Lock size={16} />}
                  label={isSendingCommand && commandIntent === 'LOCK' ? 'Sending lock...' : 'Lock bike'}
                  tone="danger"
                  disabled={!canSendCommands || !lockRule.allowed || isSendingCommand}
                  onClick={() => setCommandIntent('LOCK')}
                />
                {!canSendCommands ? (
                  <ActionNotice message="Your role cannot send device commands." tone="warning" />
                ) : !lockRule.allowed && lockRule.reason ? (
                  <ActionNotice message={lockRule.reason} tone="warning" />
                ) : null}

                <ActionButton
                  icon={<Unlock size={16} />}
                  label={
                    isSendingCommand && commandIntent === 'UNLOCK'
                      ? 'Sending unlock...'
                      : 'Unlock bike'
                  }
                  tone="default"
                  disabled={!canSendCommands || !unlockRule.allowed || isSendingCommand}
                  onClick={() => setCommandIntent('UNLOCK')}
                />
                {!canSendCommands ? null : !unlockRule.allowed && unlockRule.reason ? (
                  <ActionNotice message={unlockRule.reason} tone="warning" />
                ) : null}

                {requestError ? <ActionNotice message={requestError} tone="danger" /> : null}
              </div>
            </DashboardCard>

            <DashboardCard
              eyebrow="Bike Feed"
              title="Last 5 events"
              description="Recent alerts and scoring events tied to this bike."
            >
              {selectedBikeEventsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-18 w-full rounded-[18px]" />
                  <Skeleton className="h-18 w-full rounded-[18px]" />
                </div>
              ) : selectedBikeEvents.length ? (
                <ul className="space-y-2">
                  {selectedBikeEvents.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-[18px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{formatEnumLabel(event.type)}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {formatTimestamp(event.ts)}
                          </p>
                        </div>
                        <SeverityBadge severity={event.severity} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<ShieldAlert size={18} />}
                  title="No recent bike events"
                  description="This bike has no recent alerts in the current backend event window."
                />
              )}
            </DashboardCard>

            <DashboardCard
              eyebrow="Acknowledgements"
              title="Command history"
              description="Recent command status transitions for the selected bike."
            >
              {selectedCommandStream.length ? (
                <ul className="space-y-2">
                  {selectedCommandStream.map((status) => (
                    <li
                      key={`${status.commandId}-${status.ts}`}
                      className="rounded-[18px] border border-line bg-surface-muted px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{status.action ?? 'Command'}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {formatTimeAgo(status.ts)}
                          </p>
                        </div>
                        <CommandBadge status={status.status} />
                      </div>
                      {status.message ? (
                        <p className="mt-2 text-xs leading-5 text-ink-soft">{status.message}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Radio size={18} />}
                  title="No bike-specific commands yet"
                  description="Command acknowledgements for this bike will appear after the first lock or unlock request."
                />
              )}
            </DashboardCard>
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={!!commandIntent}
        title={commandIntent === 'LOCK' ? 'Confirm bike lock' : 'Confirm bike unlock'}
        description={
          commandIntent === 'LOCK'
            ? `Lock ${selectedBikeLabel}? The bike must be stopped for 15 seconds and have a fresh live state.`
            : `Unlock ${selectedBikeLabel}? This will dispatch an unlock request to the assigned device.`
        }
        confirmLabel={commandIntent === 'LOCK' ? 'Send lock request' : 'Send unlock request'}
        tone={commandIntent === 'LOCK' ? 'danger' : 'default'}
        isSubmitting={isSendingCommand}
        onCancel={() => setCommandIntent(null)}
        onConfirm={() => {
          if (commandIntent) {
            void sendCommand(commandIntent);
          }
        }}
      />

      {commandIntent && !selectedCommandRule.allowed && selectedCommandRule.reason ? (
        <div className="hidden">{selectedCommandRule.reason}</div>
      ) : null}
    </PageShell>
  );
}

const LiveBikeMarker = memo(function LiveBikeMarker({
  state,
  label,
  severity,
  selected,
  onSelect,
}: {
  state: LiveBikeState;
  label: string;
  severity?: FleetEvent['severity'];
  selected: boolean;
  onSelect: (bikeId: string, shouldCenter?: boolean) => void;
}) {
  const icon = useMemo(
    () =>
      createBikeMarkerIcon({
        selected,
        severity,
        moving: state.speedKph >= 5,
      }),
    [selected, severity, state.speedKph],
  );

  return (
    <Marker
      position={[state.lat, state.lng]}
      icon={icon}
      eventHandlers={{
        click: () => {
          onSelect(state.bikeId);
        },
      }}
    >
      <Popup>
        <div className="space-y-1">
          <p className="font-semibold text-ink">{label}</p>
          <p className="text-sm text-ink-soft">Speed {state.speedKph.toFixed(1)} kph</p>
          <p className="text-sm text-ink-soft">Last seen {formatTimestamp(state.ts)}</p>
        </div>
      </Popup>
    </Marker>
  );
});

// Applies explicit center requests without forcing the map to refocus on every telemetry update.
function MapViewportController({
  target,
  centerSignal,
}: {
  target: [number, number] | null;
  centerSignal: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target || centerSignal === 0) {
      return;
    }
    map.flyTo(target, Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.65,
    });
  }, [centerSignal, map, target]);

  return null;
}

function KeyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function MapChip({ label, tone }: { label: string; tone: 'info' | 'success' | 'danger' }) {
  return (
    <span
      className={cx(
        'rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[var(--shadow-soft)] backdrop-blur',
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
          : tone === 'danger'
            ? 'border-rose-200 bg-rose-50/95 text-rose-700'
            : 'border-sky-200 bg-sky-50/95 text-sky-700',
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'danger' | 'default';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'bg-rose-600 text-white hover:bg-rose-700'
          : 'border border-line bg-surface-muted text-ink hover:bg-surface-hover',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionNotice({
  message,
  tone,
}: {
  message: string;
  tone: 'warning' | 'danger';
}) {
  return (
    <p
      className={cx(
        'rounded-[18px] border px-3 py-2 text-xs leading-5',
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
      )}
    >
      {message}
    </p>
  );
}

function SeverityBadge({ severity }: { severity: FleetEvent['severity'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        severity === 'CRITICAL'
          ? 'bg-critical-soft text-critical-ink'
          : severity === 'HIGH'
            ? 'bg-warning-soft text-warning-ink'
            : severity === 'MEDIUM'
              ? 'bg-accent-soft text-accent'
              : 'bg-low-soft text-low-ink',
      )}
    >
      {severity}
    </span>
  );
}

function CommandBadge({ status }: { status: CommandStatusEvent['status'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        status === 'ACKED'
          ? 'bg-success-soft text-success-ink'
          : status === 'FAILED' || status === 'EXPIRED'
            ? 'bg-danger-soft text-danger-ink'
            : 'bg-accent-soft text-accent',
      )}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

// Merges API bootstrap state and websocket state by bike so the newest sample always wins.
function mergeLiveStates(
  initialStates: LiveBikeState[],
  realtimeStates: LiveBikeState[],
): LiveBikeState[] {
  const merged = new Map<string, LiveBikeState>();
  for (const state of initialStates) {
    merged.set(state.bikeId, state);
  }
  for (const state of realtimeStates) {
    const current = merged.get(state.bikeId);
    if (!current || current.ts.localeCompare(state.ts) <= 0) {
      merged.set(state.bikeId, state);
    }
  }

  return Array.from(merged.values()).sort((left, right) => right.ts.localeCompare(left.ts));
}

// Deduplicates bootstrap and websocket events into a single operator-facing feed.
function mergeEvents(initialEvents: FleetEvent[], realtimeEvents: FleetEvent[]): FleetEvent[] {
  const merged = new Map<string, FleetEvent>();
  for (const event of [...realtimeEvents, ...initialEvents]) {
    merged.set(event.id, event);
  }

  return Array.from(merged.values()).sort((left, right) => right.ts.localeCompare(left.ts));
}

// Deduplicates command updates so repeated websocket transitions do not flood the status list.
function mergeCommandStatuses(
  localStatuses: CommandStatusEvent[],
  realtimeStatuses: CommandStatusEvent[],
): CommandStatusEvent[] {
  const merged = new Map<string, CommandStatusEvent>();
  for (const status of [...localStatuses, ...realtimeStatuses]) {
    const dedupeKey = `${status.commandId}-${status.status}-${status.ts}`;
    merged.set(dedupeKey, status);
  }

  return Array.from(merged.values()).sort((left, right) => right.ts.localeCompare(left.ts));
}

// Throttles volatile arrays so map marker updates stay smooth under bursty telemetry.
function useThrottledValue<T>(value: T, delayMs: number) {
  const [throttledValue, setThrottledValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setThrottledValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs, value]);

  return throttledValue;
}

// Builds a grouped toast summary from a burst of realtime events.
function buildGroupedEventToast(events: FleetEvent[]): ToastItem {
  const sortedEvents = [...events].sort((left, right) => right.ts.localeCompare(left.ts));
  const latestEvent = sortedEvents[0];
  const labels = Array.from(
    new Set(sortedEvents.slice(0, 3).map((event) => formatEnumLabel(event.type))),
  );
  const criticalPresent = sortedEvents.some((event) => event.severity === 'CRITICAL');

  return {
    id: `toast-${latestEvent.id}-${latestEvent.ts}`,
    title:
      sortedEvents.length > 1
        ? `${sortedEvents.length} new live alerts`
        : `${formatEnumLabel(latestEvent.type)} detected`,
    message:
      sortedEvents.length > 1
        ? `${labels.join(', ')}${sortedEvents.length > labels.length ? ', and more' : ''}`
        : `${latestEvent.severity} severity at ${new Date(latestEvent.ts).toLocaleTimeString()}`,
    tone: criticalPresent ? 'danger' : 'warning',
    count: sortedEvents.length,
  };
}

// Mirrors backend command freshness checks so disabled actions explain themselves.
function evaluateUnlockRule(state: LiveBikeState | null) {
  if (!state) {
    return { allowed: false, reason: 'No live state available for this bike.' };
  }

  const ageMs = Date.now() - Date.parse(state.ts);
  if (ageMs > 30_000) {
    return { allowed: false, reason: 'No recent live state under 30 seconds.' };
  }

  return { allowed: true, reason: null };
}

// Mirrors backend lock safety rules so the UI can explain why locking is currently blocked.
function evaluateLockRule(state: LiveBikeState | null) {
  const unlockRule = evaluateUnlockRule(state);
  if (!unlockRule.allowed) {
    return unlockRule;
  }

  if (!state) {
    return { allowed: false, reason: 'No live state available for this bike.' };
  }

  if (Math.abs(state.speedKph) > 0.01) {
    return { allowed: false, reason: 'Bike must be stopped for 15s before locking.' };
  }

  const stationaryMs = Date.now() - Date.parse(state.ts);
  if (stationaryMs < 15_000) {
    return { allowed: false, reason: 'Bike must be stopped for 15s before locking.' };
  }

  return { allowed: true, reason: null };
}

// Returns true when the live state is recent enough to count as online in the summary cards.
function isFreshState(ts: string) {
  return Date.now() - Date.parse(ts) <= FRESH_STATE_WINDOW_MS;
}

// Creates an emphasized marker icon without pulling additional map icon dependencies.
function createBikeMarkerIcon({
  selected,
  severity,
  moving,
}: {
  selected: boolean;
  severity?: FleetEvent['severity'];
  moving: boolean;
}) {
  const fill =
    severity === 'CRITICAL'
      ? '#e11d48'
      : severity === 'HIGH'
        ? '#d97706'
        : moving
          ? '#2563eb'
          : '#059669';

  return L.divIcon({
    className: 'emoto-bike-marker',
    html: `
      <div style="
        width: ${selected ? 32 : 24}px;
        height: ${selected ? 32 : 24}px;
        border-radius: 999px;
        background: ${fill};
        border: 3px solid white;
        box-shadow: 0 14px 22px rgba(15, 23, 42, 0.2);
        outline: ${selected ? '4px solid rgba(37, 99, 235, 0.18)' : 'none'};
      "></div>
    `,
    iconSize: selected ? [32, 32] : [24, 24],
    iconAnchor: selected ? [16, 16] : [12, 12],
    popupAnchor: [0, -12],
  });
}

// Truncates identifiers for compact UI labels without exposing full IDs repeatedly.
function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return `${value.slice(0, 8)}...`;
}

