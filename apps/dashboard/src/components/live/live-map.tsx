'use client';

import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Bike,
  Crosshair,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Phone,
  Radio,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../i18n/LanguageProvider';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { PageShell } from '@/components/layout/page-shell';
import { useRealtime } from '@/components/realtime/realtime-provider';
import { canProvisionDevices, canViewAssignments } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ApiError, apiFetch } from '@/lib/api/client';
import { buildQueryString } from '@/lib/api/query-string';
import { canUseFeature } from '@/lib/subscription';
import {
  Assignment,
  Bike as FleetBike,
  CommandStatusEvent,
  DeviceCommand,
  FleetEvent,
  LiveBikeState,
  RoadFeature,
  PaginatedResponse,
} from '@/lib/types/dashboard';
import { cx, formatEnumLabel, formatTimeAgo, formatTimestamp } from '@/lib/ui';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DashboardCard } from '@/components/ui/dashboard-card';
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
const ROAD_LAYER_MIN_ZOOM = 13;
const ROAD_BOUNDS_EPSILON = 0.0001;

type CommandIntent = 'LOCK' | 'UNLOCK';

type RoadBounds = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export interface Poi {
  id: string;
  fleetId: string | null;
  type: 'GARAGE' | 'SWAP' | 'CLINIC' | 'OTHER';
  name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type MapViewport = {
  bounds: RoadBounds;
  zoom: number;
};

export function LiveMapPanel() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const { resolvedTheme } = useTheme();
  const { bikeStates, recentEvents, commandStatuses = [], recordCommandStatus } = useRealtime();
  const [selectedBikeId, setSelectedBikeId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandIntent, setCommandIntent] = useState<CommandIntent | null>(null);
  const [localCommandStatuses, setLocalCommandStatuses] = useState<CommandStatusEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [centerSignal, setCenterSignal] = useState(0);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drawerDismissed, setDrawerDismissed] = useState(false);
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false);
  const [showRoadFeatures, setShowRoadFeatures] = useState(true);
  const [showHelpPoints, setShowHelpPoints] = useState(true);
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const mapWrapperRef = useRef<HTMLDivElement>(null);
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

  const roadFeatureKey = mapViewport
    ? `${formatBounds(mapViewport.bounds)}:${mapViewport.zoom}`
    : 'none';
  const roadFeaturesQuery = useQuery({
    queryKey: ['roads', 'features', roadFeatureKey],
    queryFn: () => {
      if (!mapViewport) {
        return Promise.resolve([] as RoadFeature[]);
      }
      const bbox = formatBounds(mapViewport.bounds);
      return apiFetch<RoadFeature[]>(
        `/roads/features?bbox=${bbox}`,
      );
    },
    enabled: Boolean(mapViewport && mapViewport.zoom >= ROAD_LAYER_MIN_ZOOM),
    staleTime: 60_000,
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

  const poisQuery = useQuery({
    queryKey: ['pois', 'live-active'],
    queryFn: () =>
      apiFetch<PaginatedResponse<Poi>>('/poi?page=1&pageSize=200&active=true'),
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

  const commandFeatureEnabled = canUseFeature(currentUser, 'commands');
  const canSendCommands = currentUser
    ? commandFeatureEnabled && canProvisionDevices(currentUser.role)
    : false;
  const selectedCommandStream = useMemo(
    () => commandStream.filter((item) => item.bikeId === selectedBikeId).slice(0, 6),
    [commandStream, selectedBikeId],
  );

  const selectedBikeLockStatus = useMemo(() => {
    if (selectedCommandStream.length === 0) return 'UNLOCKED';
    const latest = selectedCommandStream[0];
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
  }, [selectedCommandStream]);

  const onlineCount = throttledStates.filter((state) => isFreshState(state.ts)).length;
  const movingCount = throttledStates.filter((state) => state.speedKph >= 5).length;
  const criticalCount = feedEvents.filter((event) => event.severity === 'CRITICAL').length;
  const highPriorityCount = feedEvents.filter(
    (event) => event.severity === 'HIGH' || event.severity === 'CRITICAL',
  ).length;

  const lockRule = evaluateLockRule(selectedState, t);
  const unlockRule = evaluateUnlockRule(selectedState, t);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedState) {
      return [selectedState.lat, selectedState.lng];
    }
    if (throttledStates[0]) {
      return [throttledStates[0].lat, throttledStates[0].lng];
    }
    return MAP_DEFAULT_CENTER;
  }, [selectedState, throttledStates]);

  // Tracks map bounds and zoom so road feature queries stay scoped to the viewport.
  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    setMapViewport((currentViewport) => {
      if (!currentViewport) {
        return nextViewport;
      }
      if (
        currentViewport.zoom === nextViewport.zoom &&
        areBoundsEqual(currentViewport.bounds, nextViewport.bounds)
      ) {
        return currentViewport;
      }
      return nextViewport;
    });
  }, []);

  // Applies the bikeId route hint so deep links can open a bike drawer directly.
  useEffect(() => {
    const bikeIdFromQuery = searchParams.get('bikeId');
    if (bikeIdFromQuery) {
      setSelectedBikeId(bikeIdFromQuery);
    }
  }, [searchParams]);

  // Keeps an initial selection in place once the map has live bikes to focus on.
  useEffect(() => {
    if (selectedBikeId || throttledStates.length === 0 || drawerDismissed) {
      return;
    }
    setSelectedBikeId(throttledStates[0]?.bikeId ?? null);
  }, [selectedBikeId, throttledStates, drawerDismissed]);

  // Batches bursty realtime events into grouped toasts so the operator feed stays readable.
  useEffect(() => {
    const unseenEvents = recentEvents
      .filter((event) => !seenEventIdsRef.current.has(event.id))
      .filter((event) => {
        if (event.type === 'SOS' && currentUser?.notifSosAlerts === false) return false;
        if (event.type === 'CRASH' && currentUser?.notifCrashEvents === false) return false;
        return true;
      });
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

      const toast = buildGroupedEventToast(batch, t);
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
    if (bikeId) {
      setDrawerDismissed(false);
    }
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
          setRequestError(t('Failed to send command'));
        }
      } finally {
        setIsSendingCommand(false);
      }
    },
    [recordCommandStatus, selectedBikeId],
  );

  const selectedCommandRule = commandIntent === 'LOCK' ? lockRule : unlockRule;
  const selectedBikeLabel = selectedAssignment?.riderFullName
    ? `${selectedAssignment.riderFullName}${selectedBike?.plate || selectedBike?.label ? ` (${selectedBike.plate || selectedBike.label})` : ''}`
    : selectedBike?.label || selectedBike?.plate || (selectedBikeId ? `Bike #${selectedBikeId.slice(0, 6).toUpperCase()}` : t('Bike detail'));

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Escape exits fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  return (
    <PageShell
      title={t("Live Command Center")}
      description={t("Monitor active bikes, triage new alerts, and dispatch lock or unlock commands without leaving the realtime map surface.")}
    >
      <ToastStack items={toasts} />
      <section className="relative w-full">
        {/* ── Map Card ── */}
        <div
          ref={mapWrapperRef}
          className={cx(
            'relative flex flex-col transition-all duration-300',
            isFullscreen
              ? 'fixed inset-0 z-[1000] bg-[var(--background)]'
              : 'overflow-hidden rounded-2xl border border-line bg-[var(--background-strong)] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-4px_rgba(0,0,0,0.08)]',
          )}
        >
          {/* Map header bar */}
          <div className={cx(
            'flex items-center justify-between gap-3 border-b border-line bg-[var(--background-strong)] px-5 py-3',
            isFullscreen && 'px-6 py-4',
          )}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Layers size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-ink">{t("Fleet Map")}</h2>
                <p className="text-[11px] text-ink-muted">{t("Real-time vehicle tracking")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapStatusBar
                onlineCount={onlineCount}
                movingCount={movingCount}
                highPriorityCount={highPriorityCount}
                centerDisabled={!selectedState}
                onCenter={() => setCenterSignal((currentSignal) => currentSignal + 1)}
              />
              <button
                type="button"
                onClick={() => setIsFeedCollapsed((prev) => !prev)}
                className={cx(
                  'inline-flex h-8 px-2.5 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition',
                  isFeedCollapsed
                    ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
                    : 'border-line bg-surface-muted text-ink-muted hover:bg-surface-hover hover:text-ink',
                )}
                title={isFeedCollapsed ? t('Show triage feed') : t('Hide triage feed')}
              >
                <Radio size={13} />
                <span>{isFeedCollapsed ? t('Show Feed') : t('Hide Feed')}</span>
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-muted transition hover:bg-surface-hover hover:text-ink"
                title={isFullscreen ? t('Exit fullscreen (Esc)') : t('Expand map')}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Map surface */}
          <div className="relative flex-1">
            {liveStatesQuery.isLoading ? (
              <div className={cx('p-4', isFullscreen ? 'h-full' : 'h-[80vh] min-h-[640px]')}>
                <Skeleton className="h-full w-full rounded-[calc(var(--radius-panel)-6px)]" />
              </div>
            ) : (
              <div className={cx(
                'relative overflow-hidden',
                isFullscreen ? 'h-full' : 'h-[80vh] min-h-[640px] rounded-b-[var(--radius-panel)]',
              )}>
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  className="h-full w-full"
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  {mapStyle === 'standard' && (
                    <TileLayer
                      key="standard"
                      attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url={resolvedTheme === 'light' 
                        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
                    />
                  )}
                  {mapStyle === 'satellite' && (
                    <TileLayer
                      key="satellite"
                      attribution='&copy; Google'
                      url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    />
                  )}
                  {mapStyle === 'hybrid' && (
                    <TileLayer
                      key="hybrid"
                      attribution='&copy; Google'
                      url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    />
                  )}
                  <MapSizeController />
                  <MapViewportController
                    centerSignal={centerSignal}
                    target={selectedState ? [selectedState.lat, selectedState.lng] : null}
                  />
                                  <MapBoundsTracker onViewportChange={handleViewportChange} />
                  {showRoadFeatures && (
                    <RoadFeatureLayer features={roadFeaturesQuery.data ?? []} />
                  )}
                  {showHelpPoints &&
                    poisQuery.data?.data.map((poi) => (
                      <PoiMarker key={poi.id} poi={poi} />
                    ))}
                  {throttledStates.map((state) => {
                    const bike = bikesById.get(state.bikeId);
                    const assignment = assignmentByBikeId.get(state.bikeId);
                    let label = 'Bike';

                    if (assignment?.riderFullName?.trim()) {
                      const bikePlateOrLabel = bike?.plate || bike?.label || assignment.bikeLabel;
                      label = bikePlateOrLabel
                        ? `${assignment.riderFullName} (${bikePlateOrLabel})`
                        : assignment.riderFullName;
                    } else if (bike?.label?.trim()) {
                      label = bike.label;
                    } else if (bike?.plate?.trim()) {
                      label = bike.plate;
                    } else if (assignment?.bikeLabel?.trim()) {
                      label = assignment.bikeLabel;
                    } else {
                      label = `Bike #${state.bikeId.slice(0, 6).toUpperCase()}`;
                    }

                    return (
                      <LiveBikeMarker
                        key={state.bikeId}
                        state={state}
                        label={label}
                        severity={latestEventByBike.get(state.bikeId)?.severity}
                        selected={state.bikeId === selectedBikeId}
                        onSelect={selectBikeContext}
                      />
                    );
                  })}
                  <MapZoomControls />
                </MapContainer>

                {/* Floating Map Layers Selector Control */}
                <div className="absolute top-4 left-12 md:left-16 right-4 sm:right-auto z-[500] pointer-events-auto">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border border-line bg-[var(--background-strong)]/90 px-2 py-1 sm:px-3 sm:py-1.5 shadow-sm backdrop-blur-md">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted flex items-center gap-1.5 border-r border-line pr-2.5">
                      <Layers size={12} className="text-accent" /> {t("Layers")}
                    </span>
                    
                    {/* Map Style Selector Buttons */}
                    <div className="flex items-center gap-1 border-r border-line pr-2.5">
                      <button
                        type="button"
                        onClick={() => setMapStyle('standard')}
                        className={cx(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold transition-all',
                          mapStyle === 'standard'
                            ? 'bg-accent/20 text-accent'
                            : 'text-ink-soft hover:text-ink hover:bg-surface-hover'
                        )}
                      >
                        {t("Map")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapStyle('satellite')}
                        className={cx(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold transition-all',
                          mapStyle === 'satellite'
                            ? 'bg-accent/20 text-accent'
                            : 'text-ink-soft hover:text-ink hover:bg-surface-hover'
                        )}
                      >
                        {t("Satellite")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapStyle('hybrid')}
                        className={cx(
                          'rounded-md px-2 py-0.5 text-[11px] font-bold transition-all',
                          mapStyle === 'hybrid'
                            ? 'bg-accent/20 text-accent'
                            : 'text-ink-soft hover:text-ink hover:bg-surface-hover'
                        )}
                      >
                        {t("Hybrid")}
                      </button>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-ink hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={showHelpPoints}
                        onChange={(e) => setShowHelpPoints(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-line bg-surface-strong text-accent focus:ring-accent"
                      />
                      <span>{t("Help Points")}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-ink hover:text-white transition-colors">
                      <input
                        type="checkbox"
                        checked={showRoadFeatures}
                        onChange={(e) => setShowRoadFeatures(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-line bg-surface-strong text-accent focus:ring-accent"
                      />
                      <span>{t("Road Context")}</span>
                    </label>
                  </div>
                </div>

                {/* Road legend */}
                {showRoadFeatures && (
                  <div className="pointer-events-none absolute bottom-4 left-4 z-[500]">
                    <RoadLegend
                      zoom={mapViewport?.zoom ?? 0}
                      featureCount={roadFeaturesQuery.data?.length ?? 0}
                    />
                  </div>
                )}

                {/* Fullscreen hint */}
                {isFullscreen && (
                  <div className="absolute left-4 top-20 z-[500]">
                    <div className="rounded-lg border border-line bg-[var(--background-strong)]/90 px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm backdrop-blur-md">
                      {t("Press")} <kbd className="mx-1 rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">Esc</kbd> {t("to exit")}
                    </div>
                  </div>
                )}

                {/* Triage Feed Floating Overlay */}
                <div
                  className={cx(
                    'absolute right-4 left-4 sm:left-auto sm:w-[22rem] top-4 bottom-4 z-[800] transition-all duration-300 ease-in-out pointer-events-auto flex flex-col',
                    isFeedCollapsed
                      ? 'opacity-0 translate-x-12 pointer-events-none'
                      : 'opacity-100 translate-x-0'
                  )}
                >
                  <div className="flex-1 overflow-hidden flex flex-col rounded-2xl border border-line bg-[var(--background-strong)]/85 backdrop-blur-md shadow-2xl p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-line pb-3 mb-3 shrink-0">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("Triage Feed")}</h4>
                        <h3 className="font-display text-sm font-bold text-ink mt-0.5">{t("Live queue")}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFeedCollapsed(true)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-ink-faint hover:bg-surface-hover hover:text-ink transition-colors"
                        title={t("Hide feed")}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    
                    {/* Scrollable Feed List */}
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 dashboard-scrollbar">
                      <section>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-display text-sm font-bold text-ink">{t("Recent alerts")}</h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {t("Click an alert to open bike context.")}
                            </p>
                          </div>
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            {t("Realtime")}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2">
                          {feedEvents.length ? (
                            feedEvents.map((event) => {
                              const linkedBike = event.bikeId ? bikesById.get(event.bikeId) : null;
                              const eventAssignment = event.bikeId ? assignmentByBikeId.get(event.bikeId) : null;
                              const eventLabel = eventAssignment?.riderFullName
                                ? `${eventAssignment.riderFullName}${linkedBike?.label || linkedBike?.plate ? ` (${linkedBike.label || linkedBike.plate})` : ''}`
                                : linkedBike?.label || linkedBike?.plate || (event.bikeId ? `Bike #${event.bikeId.slice(0, 6).toUpperCase()}` : t('Fleet event'));

                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  onClick={() => selectBikeContext(event.bikeId, true)}
                                  disabled={!event.bikeId}
                                  className="w-full rounded-[16px] border border-line bg-surface-muted/60 px-3.5 py-2.5 text-left transition hover:bg-surface-hover disabled:cursor-default disabled:opacity-70"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-ink truncate">{t(formatEnumLabel(event.type))}</p>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft truncate">
                                        {eventLabel}
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
                              <Skeleton className="h-16 w-full rounded-[16px]" />
                              <Skeleton className="h-16 w-full rounded-[16px]" />
                            </div>
                          ) : (
                            <InlineEmptyCard
                              icon={<AlertTriangle size={14} />}
                              title={t("No recent alerts")}
                              description={t("New events will appear here as they arrive.")}
                            />
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-display text-sm font-bold text-ink">{t("Command stream")}</h3>
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {t("Recent locks/unlocks across the fleet.")}
                            </p>
                          </div>
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            {t("Last")} {Math.min(commandStream.length, 6)}
                          </span>
                        </div>

                        <ul className="mt-2.5 space-y-2">
                          {commandStream.slice(0, 6).length ? (
                            commandStream.slice(0, 6).map((status) => {
                              const cmdAssignment = status.bikeId ? assignmentByBikeId.get(status.bikeId) : null;
                              const cmdBike = status.bikeId ? bikesById.get(status.bikeId) : null;
                              const cmdLabel = cmdAssignment?.riderFullName
                                ? `${cmdAssignment.riderFullName}${cmdBike?.label || cmdBike?.plate ? ` (${cmdBike.label || cmdBike.plate})` : ''}`
                                : cmdBike?.label || cmdBike?.plate || (status.bikeId ? `Bike #${status.bikeId.slice(0, 6).toUpperCase()}` : t('Fleet command'));

                              return (
                                <li
                                  key={`${status.commandId}-${status.ts}`}
                                  className="rounded-[16px] border border-line bg-surface-muted/60 px-3.5 py-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-ink truncate">{status.action ?? t('Command')}</p>
                                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft truncate">
                                        {cmdLabel} {' · '}
                                        {formatTimeAgo(status.ts)}
                                      </p>
                                    </div>
                                    <CommandBadge status={status.status} />
                                  </div>
                                  {status.message ? (
                                    <p className="mt-1 text-[11px] leading-relaxed text-ink-soft break-words">{status.message}</p>
                                  ) : null}
                                </li>
                              );
                            })
                          ) : (
                            <InlineEmptyCard
                              icon={<Lock size={14} />}
                              title={t("No activity yet")}
                              description={t("Command updates will appear here.")}
                            />
                          )}
                        </ul>
                      </section>
                    </div>
                  </div>
                </div>

                {throttledStates.length === 0 ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6">
                    <MapEmptyBanner />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      <Drawer
        open={!!selectedBikeId}
        title={selectedBike?.label ?? t('Bike detail')}
        description={t("Live bike context, rider assignment, recent events, and safe command controls.")}
        onClose={() => {
          setSelectedBikeId(null);
          setDrawerDismissed(true);
          setRequestError(null);
          setCommandIntent(null);
        }}
      >
        {!selectedBikeId ? null : bikesQuery.isLoading || liveStatesQuery.isLoading ? (
          <DrawerSkeleton />
        ) : !selectedBike && !selectedState ? (
          <EmptyState
            icon={<Bike size={18} />}
            title={t("Bike context unavailable")}
            description={t("This bike is no longer present in the loaded map or live-state cache.")}
          />
        ) : (
          <div className="space-y-5">
            {selectedState?.mainPowerCut && (
              <div className="flex items-center justify-between rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 text-xs font-bold text-rose-500 shadow-sm animate-pulse">
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>{t('MAIN POWER CUT DETECTED')}</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">{t('Backup Battery')}</span>
              </div>
            )}
            <section className="grid gap-3 sm:grid-cols-2">
              <KeyMetric
                label={t("Current speed")}
                value={selectedState ? `${selectedState.speedKph.toFixed(1)} ${t('kph')}` : '--'}
              />
              <KeyMetric
                label={t("Power supply")}
                value={
                  selectedState?.mainPowerCut
                    ? t('🔴 Main Power Cut (Backup Battery)')
                    : t('🟢 Main Power Active')
                }
              />
              <KeyMetric
                label={t("Last seen")}
                value={selectedState ? formatTimeAgo(selectedState.ts) : t('No live state')}
              />
              <KeyMetric
                label={t("Ignition")}
                value={
                  selectedState?.ignition === undefined
                    ? '--'
                    : selectedState.ignition
                      ? t('On')
                      : t('Off')
                }
              />
              <KeyMetric
                label={t("Assigned rider")}
                value={
                  selectedAssignment?.riderFullName ??
                  (assignmentsEnabled ? t('Unassigned') : t('Access limited'))
                }
              />
            </section>

            <DashboardCard
              eyebrow={t("Control")}
              title={t("Bike actions")}
              description={t("The UI mirrors backend safety rules before a command is sent.")}
              actions={
                <button
                  type="button"
                  onClick={() => setCenterSignal((currentSignal) => currentSignal + 1)}
                  disabled={!selectedState}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Crosshair size={16} />
                  {t("Center on map")}
                </button>
              }
            >
              <div className="space-y-3">
                <ActionButton
                  icon={<Lock size={16} />}
                  label={t('Lock bike (Coming Soon)')}
                  tone="danger"
                  disabled={true}
                  onClick={() => {}}
                />
                {!commandFeatureEnabled ? (
                  <ActionNotice message={t("Remote lock and unlock controls are available on Operations Plus.")} tone="warning" />
                ) : !canSendCommands ? (
                  <ActionNotice message={t("Your role cannot send device commands.")} tone="warning" />
                ) : !lockRule.allowed && lockRule.reason ? (
                  <ActionNotice message={lockRule.reason} tone="warning" />
                ) : null}

                <ActionButton
                  icon={<Unlock size={16} />}
                  label={
                    isSendingCommand && commandIntent === 'UNLOCK'
                      ? t('Sending unlock...')
                      : t('Unlock bike')
                  }
                  tone="default"
                  disabled={
                    !canSendCommands ||
                    !unlockRule.allowed ||
                    isSendingCommand ||
                    selectedBikeLockStatus === 'UNLOCKED' ||
                    selectedBikeLockStatus === 'UNLOCKING'
                  }
                  onClick={() => setCommandIntent('UNLOCK')}
                />
                {!canSendCommands ? null : !unlockRule.allowed && unlockRule.reason ? (
                  <ActionNotice message={unlockRule.reason} tone="warning" />
                ) : null}

                {requestError ? <ActionNotice message={requestError} tone="danger" /> : null}
              </div>
            </DashboardCard>

            <DashboardCard
              eyebrow={t("Bike Feed")}
              title={t("Last 5 events")}
              description={t("Recent alerts and scoring events tied to this bike.")}
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
                          <p className="font-semibold text-ink">{t(formatEnumLabel(event.type))}</p>
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
                  title={t("No recent bike events")}
                  description={t("This bike has no recent alerts in the current backend event window.")}
                />
              )}
            </DashboardCard>

            <DashboardCard
              eyebrow={t("Acknowledgements")}
              title={t("Command history")}
              description={t("Recent command status transitions for the selected bike.")}
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
                          <p className="font-semibold text-ink">{status.action ?? t('Command')}</p>
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
                <InlineEmptyCard
                  icon={<Radio size={16} />}
                  title={t("No bike-specific commands yet")}
                  description={t("Command acknowledgements for this bike will appear after the first lock or unlock request.")}
                />
              )}
            </DashboardCard>
          </div>
        )}
      </Drawer>

      <ConfirmModal
        open={!!commandIntent}
        title={commandIntent === 'LOCK' ? t('Confirm bike lock') : t('Confirm bike unlock')}
        description={
          commandIntent === 'LOCK'
            ? t("Lock {label}? The bike must be stopped for 15 seconds and have a fresh live state.").replace('{label}', selectedBikeLabel || '')
            : t("Unlock {label}? This will dispatch an unlock request to the assigned device.").replace('{label}', selectedBikeLabel || '')
        }
        confirmLabel={commandIntent === 'LOCK' ? t('Send lock request') : t('Send unlock request')}
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
  const { t } = useTranslation();

  const [animatedPos, setAnimatedPos] = useState<[number, number]>([state.lat, state.lng]);
  const lastPosRef = useRef<[number, number]>([state.lat, state.lng]);

  useEffect(() => {
    const startLat = lastPosRef.current[0];
    const startLng = lastPosRef.current[1];
    const endLat = state.lat;
    const endLng = state.lng;

    // Skip if coordinates are identical
    if (startLat === endLat && startLng === endLng) return;

    // Distance threshold: if jump is too large (e.g. > 2km / 0.02 degrees), snap immediately
    const distance = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (distance > 0.02) {
      lastPosRef.current = [endLat, endLng];
      requestAnimationFrame(() => {
        setAnimatedPos([endLat, endLng]);
      });
      return;
    }

    const duration = 5000; // Interpolate over 5 seconds (matching the GPS tracker report interval)
    const startTime = performance.now();
    let animFrameId: number;

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const currentLat = startLat + (endLat - startLat) * progress;
      const currentLng = startLng + (endLng - startLng) * progress;

      lastPosRef.current = [currentLat, currentLng];
      setAnimatedPos([currentLat, currentLng]);

      if (progress < 1) {
        animFrameId = requestAnimationFrame(animate);
      }
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [state.lat, state.lng]);

  const icon = useMemo(
    () =>
      createBikeMarkerIcon({
        selected,
        severity,
        moving: state.speedKph >= 5,
        label,
      }),
    [selected, severity, state.speedKph, label],
  );

  return (
    <Marker
      position={animatedPos}
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
          <p className="text-sm text-ink-soft">{t("Speed")} {state.speedKph.toFixed(1)} {t("kph")}</p>
          <p className="text-sm text-ink-soft">{t("Last seen")} {formatTimestamp(state.ts)}</p>
        </div>
      </Popup>
    </Marker>
  );
});

// Forces Leaflet to recalculate the viewport after client hydration and layout changes.
function MapSizeController() {
  const map = useMap();

  useEffect(() => {
    const syncMapSize = () => {
      map.invalidateSize({ animate: false });
    };

    const animationFrame = window.requestAnimationFrame(syncMapSize);
    const settleTimer = window.setTimeout(syncMapSize, 180);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        syncMapSize();
      });
      observer.observe(map.getContainer());
    }

    window.addEventListener('resize', syncMapSize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', syncMapSize);
    };
  }, [map]);

  return null;
}

// Custom zoom controls rendered inside the MapContainer so useMap() works.
function MapZoomControls() {
  const map = useMap();
  const { t } = useTranslation();
  return (
    <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-1">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[var(--background-strong)]/90 text-ink-soft shadow-sm backdrop-blur-md transition hover:bg-surface-hover hover:text-ink"
        aria-label={t("Zoom in")}
      >
        <span className="text-base font-bold leading-none">+</span>
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-[var(--background-strong)]/90 text-ink-soft shadow-sm backdrop-blur-md transition hover:bg-surface-hover hover:text-ink"
        aria-label={t("Zoom out")}
      >
        <span className="text-base font-bold leading-none">−</span>
      </button>
    </div>
  );
}

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

// Tracks map bounds and zoom so road feature queries stay anchored to the viewport.
function MapBoundsTracker({
  onViewportChange,
}: {
  onViewportChange: (viewport: MapViewport) => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      onViewportChange(buildViewport(map));
    },
    zoomend: () => {
      onViewportChange(buildViewport(map));
    },
  });

  useEffect(() => {
    onViewportChange(buildViewport(map));
  }, [map, onViewportChange]);

  return null;
}

// Renders road and safety features with lightweight markers.
function RoadFeatureLayer({ features }: { features: RoadFeature[] }) {
  const { t } = useTranslation();
  if (!features.length) {
    return null;
  }

  return (
    <>
      {features.map((feature) => {
        const style = getRoadFeatureStyle(feature);
        return (
          <CircleMarker
            key={feature.id}
            center={[feature.lat, feature.lng]}
            radius={style.radius}
            pathOptions={{
              color: style.stroke,
              fillColor: style.fill,
              fillOpacity: 0.85,
              weight: 1,
            }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold text-ink">{t(style.label)}</p>
                {feature.name ? (
                  <p className="text-sm text-ink-soft">{feature.name}</p>
                ) : null}
                {feature.speedLimitKph ? (
                  <p className="text-sm text-ink-soft">{t("Limit")} {feature.speedLimitKph} {t("kph")}</p>
                ) : null}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Summarizes which road safety overlays are active at the current zoom level.
function RoadLegend({
  zoom,
  featureCount,
}: {
  zoom: number;
  featureCount: number;
}) {
  const { t } = useTranslation();
  if (zoom < ROAD_LAYER_MIN_ZOOM) {
    return (
      <div className="rounded-lg border border-line bg-[var(--background-strong)]/90 px-3 py-2 text-xs font-semibold text-ink-muted shadow-sm backdrop-blur-md">
        {t("Zoom in to view road safety layers.")}
      </div>
    );
  }

  return (
    <div className="max-w-[240px] rounded-lg border border-line bg-[var(--background-strong)]/90 px-3 py-2 text-xs text-ink-soft shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {t("Road context")}
        </span>
        <span className="text-[11px] font-semibold text-ink">{featureCount} {t("points")}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-ink-soft">
        <LegendItem label={t("School")} tone="school" />
        <LegendItem label={t("Hospital")} tone="hospital" />
        <LegendItem label={t("Market")} tone="market" />
        <LegendItem label={t("Signs")} tone="sign" />
        <LegendItem label={t("Speed limit")} tone="speed" />
      </div>
    </div>
  );
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        tone === 'success'
          ? 'border-success-ink/20 bg-success-soft text-success-ink'
          : tone === 'danger'
            ? 'border-danger-ink/20 bg-danger-soft text-danger-ink'
            : 'border-accent/20 bg-accent-soft text-accent',
      )}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          tone === 'success'
            ? 'bg-success-ink'
            : tone === 'danger'
              ? 'bg-danger-ink'
              : 'bg-accent',
        )}
      />
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
        'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition border disabled:cursor-not-allowed',
        disabled
          ? 'bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-600 dark:border-zinc-800/50'
          : tone === 'danger'
            ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-500 dark:bg-rose-700/80 dark:border-rose-600/50 dark:hover:bg-rose-600'
            : 'bg-zinc-50 text-zinc-900 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800',
      )}
      style={
        !disabled && tone === 'danger'
          ? { backgroundColor: '#EF4444', color: '#FFFFFF', borderColor: '#EF4444' }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}

// Renders the compact map status bar in the card header.
function MapStatusBar({
  onlineCount,
  movingCount,
  highPriorityCount,
  centerDisabled,
  onCenter,
}: {
  onlineCount: number;
  movingCount: number;
  highPriorityCount: number;
  centerDisabled: boolean;
  onCenter: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <MapChip label={`${onlineCount} ${t('online')}`} tone="success" />
      <MapChip label={`${movingCount} ${t('moving')}`} tone="info" />
      <MapChip label={`${highPriorityCount} ${t('alerts')}`} tone="danger" />
      <button
        type="button"
        onClick={onCenter}
        disabled={centerDisabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Crosshair size={13} />
        {t("Center")}
      </button>
    </div>
  );
}

// Displays a compact inline empty state for side rail panels.
function InlineEmptyCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[18px] border border-dashed border-line bg-surface-muted px-4 py-4 text-center">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-strong text-accent">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-xs leading-5 text-ink-soft">{description}</p>
    </div>
  );
}

// Renders a small banner for when no live bike telemetry is available.
function MapEmptyBanner() {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-line bg-[var(--background-strong)]/90 px-4 py-3 text-center shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Bike size={16} />
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{t("No live bike states yet")}</p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        {t("The basemap is ready. Bike markers appear as soon as telemetry updates arrive.")}
      </p>
    </div>
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
          ? 'border-danger-ink/20 bg-danger-soft text-danger-ink'
          : 'border-warning-ink/20 bg-warning-soft text-warning-ink',
      )}
    >
      {message}
    </p>
  );
}

function SeverityBadge({ severity }: { severity: FleetEvent['severity'] }) {
  const { t } = useTranslation();
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
      {severity ? t(severity) : ''}
    </span>
  );
}

// Renders a compact legend row with a colored dot.
function LegendItem({
  label,
  tone,
}: {
  label: string;
  tone: 'school' | 'hospital' | 'market' | 'sign' | 'speed';
}) {
  const color =
    tone === 'school'
      ? '#f97316'
      : tone === 'hospital'
        ? '#ef4444'
        : tone === 'market'
          ? '#0ea5e9'
          : tone === 'speed'
            ? '#6366f1'
            : '#94a3b8';

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function CommandBadge({ status }: { status: CommandStatusEvent['status'] }) {
  const { t } = useTranslation();
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
      {status ? t(formatEnumLabel(status)) : ''}
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
      merged.set(state.bikeId, {
        ...current,
        ...state,
        batteryV: state.batteryV !== undefined ? state.batteryV : current?.batteryV,
        batteryPct: state.batteryPct !== undefined ? state.batteryPct : current?.batteryPct,
      });
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
  for (const status of [...(localStatuses ?? []), ...(realtimeStatuses ?? [])]) {
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
function buildGroupedEventToast(events: FleetEvent[], t: (key: string) => string): ToastItem {
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
        ? t("{count} new live alerts").replace("{count}", sortedEvents.length.toString())
        : t("{type} detected").replace("{type}", t(formatEnumLabel(latestEvent.type))),
    message:
      sortedEvents.length > 1
        ? `${labels.map(l => t(l)).join(', ')}${sortedEvents.length > labels.length ? t(", and more") : ''}`
        : t("{severity} severity at {time}")
            .replace("{severity}", t(latestEvent.severity))
            .replace("{time}", new Date(latestEvent.ts).toLocaleTimeString()),
    tone: criticalPresent ? 'danger' : 'warning',
    count: sortedEvents.length,
  };
}

// Mirrors backend command freshness checks so disabled actions explain themselves.
function evaluateUnlockRule(state: LiveBikeState | null, t: (key: string) => string) {
  if (!state) {
    return { allowed: false, reason: t('No live state available for this bike.') };
  }

  const ageMs = Date.now() - Date.parse(state.ts);
  if (ageMs > 86_400_000) {
    return { allowed: false, reason: t('No recent live state under 24 hours.') };
  }

  return { allowed: true, reason: null };
}

// Mirrors backend lock safety rules so the UI can explain why locking is currently blocked.
function evaluateLockRule(state: LiveBikeState | null, t: (key: string) => string) {
  const unlockRule = evaluateUnlockRule(state, t);
  if (!unlockRule.allowed) {
    return unlockRule;
  }

  if (!state) {
    return { allowed: false, reason: t('No live state available for this bike.') };
  }

  if (state.ignition === true) {
    return { allowed: false, reason: t('Cannot lock while ignition is ON') };
  }

  if (Math.abs(state.speedKph) > 0.1) {
    return { allowed: false, reason: t('Cannot lock while bike is moving') };
  }

  return { allowed: true, reason: null };
}

// Returns true when the live state is recent enough to count as online in the summary cards.
function isFreshState(ts: string) {
  return Date.now() - Date.parse(ts) <= FRESH_STATE_WINDOW_MS;
}

// Creates an emphasized marker icon without pulling additional map icon dependencies.
export function createBikeMarkerIcon({
  selected,
  severity,
  moving,
  label,
}: {
  selected: boolean;
  severity?: FleetEvent['severity'];
  moving: boolean;
  label: string;
}) {
  const fill =
    severity === 'CRITICAL'
      ? '#e11d48'
      : severity === 'HIGH'
        ? '#d97706'
        : moving
          ? '#2563eb'
          : '#059669';

  const size = selected ? 30 : 22;

  return L.divIcon({
    className: 'emoto-bike-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none;">
        <!-- Bike Circle Pin -->
        <div style="
          width: ${size}px;
          height: ${size}px;
          min-width: ${size}px;
          min-height: ${size}px;
          flex-shrink: 0;
          border-radius: 9999px;
          background: ${fill};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-sizing: border-box;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${selected ? 15 : 11}" height="${selected ? 15 : 11}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18.5" cy="17.5" r="3.5"/>
            <circle cx="5.5" cy="17.5" r="3.5"/>
            <circle cx="15" cy="5" r="1"/>
            <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
          </svg>
        </div>
        
        <!-- Floating Text Label -->
        <div style="
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #ffffff;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 5px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          letter-spacing: 0.02em;
          flex-shrink: 0;
        ">
          ${label}
        </div>
      </div>
    `,
  });
}

// Truncates identifiers for compact UI labels without exposing full IDs repeatedly.
function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return `${value.slice(0, 8)}...`;
}

// Formats Leaflet bounds into a normalized bbox string for the road feature endpoint.
function formatBounds(bounds: RoadBounds): string {
  const values = [
    roundBoundsValue(bounds.minLat),
    roundBoundsValue(bounds.minLng),
    roundBoundsValue(bounds.maxLat),
    roundBoundsValue(bounds.maxLng),
  ];
  return values.join(',');
}

// Builds a viewport descriptor from Leaflet's bounds and zoom.
function buildViewport(map: L.Map): MapViewport {
  const bounds = map.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  return {
    bounds: {
      minLat: southWest.lat,
      minLng: southWest.lng,
      maxLat: northEast.lat,
      maxLng: northEast.lng,
    },
    zoom: map.getZoom(),
  };
}

// Compares two bounds with a small epsilon to avoid redundant viewport updates.
function areBoundsEqual(left: RoadBounds, right: RoadBounds): boolean {
  return (
    Math.abs(left.minLat - right.minLat) <= ROAD_BOUNDS_EPSILON &&
    Math.abs(left.minLng - right.minLng) <= ROAD_BOUNDS_EPSILON &&
    Math.abs(left.maxLat - right.maxLat) <= ROAD_BOUNDS_EPSILON &&
    Math.abs(left.maxLng - right.maxLng) <= ROAD_BOUNDS_EPSILON
  );
}

// Rounds bounds values to reduce cache key churn for nearby map pans.
function roundBoundsValue(value: number): number {
  return Number(value.toFixed(4));
}

// Maps road feature types into consistent marker colors and radii.
function getRoadFeatureStyle(feature: RoadFeature): {
  label: string;
  fill: string;
  stroke: string;
  radius: number;
} {
  switch (feature.type) {
    case 'SCHOOL':
      return { label: 'School zone', fill: '#fb923c', stroke: '#c2410c', radius: 14 };
    case 'HOSPITAL':
      return { label: 'Hospital', fill: '#f87171', stroke: '#b91c1c', radius: 14 };
    case 'MARKET':
      return { label: 'Market', fill: '#38bdf8', stroke: '#0284c7', radius: 12 };
    case 'SPEED_LIMIT':
      return { label: 'Speed limit', fill: '#818cf8', stroke: '#4f46e5', radius: 12 };
    case 'TRAFFIC_SIGN':
      return { label: 'Traffic sign', fill: '#94a3b8', stroke: '#475569', radius: 10 };
    default:
      return { label: 'Road feature', fill: '#94a3b8', stroke: '#475569', radius: 10 };
  }
}

// Renders a Point of Interest (POI) marker with a premium dark-themed popup.
const PoiMarker = memo(function PoiMarker({ poi }: { poi: Poi }) {
  const { t } = useTranslation();
  const icon = useMemo(() => createPoiMarkerIcon(poi.type), [poi.type]);

  const typeColor = (t: string) => {
    if (t === 'GARAGE') return 'bg-indigo-400/15 text-indigo-400 border-indigo-400/20';
    if (t === 'SWAP') return 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20';
    if (t === 'CLINIC') return 'bg-rose-400/15 text-rose-400 border-rose-400/20';
    return 'bg-violet-400/15 text-violet-400 border-violet-400/20';
  };

  return (
    <Marker position={[poi.lat, poi.lng]} icon={icon}>
      <Popup className="emoto-poi-popup">
        <div className="p-1 space-y-2 min-w-[200px]">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
            <span className="font-semibold text-ink text-sm">{poi.name}</span>
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold ${typeColor(poi.type)}`}>
              {poi.type}
            </span>
          </div>
          {poi.address && (
            <div className="text-xs text-ink-soft">
              <span className="block font-medium text-ink-muted uppercase tracking-wider text-[9px] mb-0.5">{t("Address")}</span>
              <p className="leading-normal">{poi.address}</p>
            </div>
          )}
          {poi.phone && (
            <div className="text-xs">
              <span className="block font-medium text-ink-muted uppercase tracking-wider text-[9px] mb-0.5">{t("Contact")}</span>
              <a href={`tel:${poi.phone}`} className="inline-flex items-center gap-1 text-accent hover:underline font-semibold">
                <Phone size={10} />
                {poi.phone}
              </a>
            </div>
          )}
          <div className="text-[10px] text-ink-muted font-mono pt-0.5 flex justify-between border-t border-line">
            <span>{t("Lat:")} {poi.lat.toFixed(5)}</span>
            <span>{t("Lng:")} {poi.lng.toFixed(5)}</span>
          </div>
        </div>
      </Popup>
      <Tooltip
        permanent
        direction="bottom"
        offset={[0, 18]}
        className="!bg-zinc-950/90 !text-white !border-white/10 !shadow-lg backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded-md"
      >
        {poi.name}
      </Tooltip>
    </Marker>
  );
});

// Creates a custom, high-contrast Point of Interest (POI) marker icon.
function createPoiMarkerIcon(type: 'GARAGE' | 'SWAP' | 'CLINIC' | 'OTHER') {
  const emoji = {
    GARAGE: '🔧',
    SWAP: '🔋',
    CLINIC: '🏥',
    OTHER: '📍',
  }[type];

  const bgColor = {
    GARAGE: '#818cf8', // Indigo
    SWAP: '#34d399', // Emerald
    CLINIC: '#f87171', // Rose
    OTHER: '#a78bfa', // Violet
  }[type];

  return L.divIcon({
    className: 'emoto-poi-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 999px;
        background: ${bgColor}22;
        border: 2px solid ${bgColor};
        box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 10px ${bgColor}44;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: all 150ms ease;
      ">
        <span>${emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

