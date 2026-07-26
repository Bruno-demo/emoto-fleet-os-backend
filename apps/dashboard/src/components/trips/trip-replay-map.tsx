'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Battery,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  LayersControl,
  Popup,
} from 'react-leaflet';
import { formatTimestamp, formatEnumLabel } from '@/lib/ui';
import { useTranslation } from '@/components/i18n/LanguageProvider';

// Custom motorcycle/bike marker icon
const bikeMarkerIcon = L.divIcon({
  className: 'trip-replay-marker',
  html: `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: #3b82f6;
      border: 2px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
      color: white;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="m12 8-4 4h8z"/>
      </svg>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const createEventMarkerIcon = (severity: string) => {
  const isCritical = severity === 'CRITICAL' || severity === 'HIGH';
  const color = isCritical ? '#ef4444' : '#f59e0b';
  return L.divIcon({
    className: 'custom-event-marker-icon',
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: ${color};
        border: 2px solid #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        color: white;
        cursor: pointer;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="19"/>
          <line x1="12" y1="5" x2="12" y2="15"/>
        </svg>
        <span style="
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 999px;
          background: ${color};
          opacity: 0.4;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          z-index: -1;
        "></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function getEventDescription(
  type: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any> | null | undefined,
  t: (key: string) => string
): string {
  switch (type) {
    case 'OVERSPEED':
      return t('The vehicle exceeded the speed limit of {limit} kph within the slow zone "{zone}" by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? 'N/A'))
        .replace('{zone}', String(meta?.zoneName ?? t('Unknown Zone')))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SPEED_LIMIT_VIOLATION':
      return t('The vehicle exceeded the road speed limit of {limit} kph by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? 'N/A'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SCHOOL_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a school zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '30'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'HOSPITAL_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a hospital zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '30'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'MARKET_ZONE_SPEED':
      return t('The vehicle exceeded the safety speed limit of {limit} kph inside a market zone by traveling at {speed} kph.')
        .replace('{limit}', String(meta?.speedLimitKph ?? '25'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'HARSH_BRAKE':
      return t('Harsh braking detected. G-force of {gforce} G recorded during a sudden speed drop of {delta} kph.')
        .replace('{gforce}', String(meta?.gpsGForce ?? meta?.accelX ?? 'N/A'))
        .replace('{delta}', String(meta?.speedDeltaKph ?? 'N/A'));
    case 'HARSH_ACCEL':
      return t('Harsh acceleration detected. G-force of {gforce} G recorded during a sudden speed increase of {delta} kph.')
        .replace('{gforce}', String(meta?.gpsGForce ?? meta?.accelX ?? 'N/A'))
        .replace('{delta}', String(meta?.speedDeltaKph ?? 'N/A'));
    case 'HARSH_CORNER':
      return t('Harsh cornering detected. Sudden lateral G-force of {gforce} G recorded.')
        .replace('{gforce}', String(meta?.gpsGForce ?? 'N/A'));
    case 'CRASH':
      return t('Severe crash alert! The vehicle experienced an impact G-force of {gforce} G with a speed drop of {delta} kph.')
        .replace('{gforce}', String(meta?.gForce ? Number(meta.gForce).toFixed(2) : 'N/A'))
        .replace('{delta}', String(meta?.speedDropKph ? Number(meta.speedDropKph).toFixed(2) : 'N/A'));
    case 'THEFT_SUSPECTED':
      return t('Suspicious movement alert: {reason} with a speed of {speed} kph.')
        .replace('{reason}', meta?.reason === 'movement_while_ignition_off' ? t('movement with ignition off') : t('outside park zone at night'))
        .replace('{speed}', String(meta?.speedKph ?? 'N/A'));
    case 'SOS':
      return t('Rider triggered the physical SOS button on the vehicle, indicating an emergency.');
    case 'TRACKER_OFFLINE':
      return t('Tracker offline alert! The device has not sent any data since {lastSeen}.')
        .replace('{lastSeen}', meta?.lastSeenAt ? new Date(String(meta.lastSeenAt)).toLocaleString() : t('Never'));
    default:
      return t('An unexpected fleet telemetry event was recorded.');
  }
}

interface RoutePoint {
  ts: string;
  lat: number;
  lng: number;
  speedKph: number;
  batteryPct: number | null;
  ignition: boolean | null;
}

interface TripReplayMapProps {
  route: RoutePoint[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events?: any[];
}

// Inner component to automatically center/zoom to the polyline route path
function FitBounds({ polyline }: { polyline: [number, number][] }) {
  const map = useMap();
  const fitRef = useRef(false);

  useEffect(() => {
    if (polyline.length > 0 && !fitRef.current) {
      map.fitBounds(polyline, { padding: [20, 20] });
      fitRef.current = true;
    }
  }, [map, polyline]);

  return null;
}

// Component to pan map to keep vehicle marker centered during replay
function FollowMarker({ position, isPlaying }: { position: [number, number]; isPlaying: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (isPlaying) {
      map.panTo(position);
    }
  }, [map, position, isPlaying]);
  return null;
}

export function TripReplayMap({ route, events = [] }: TripReplayMapProps) {
  const { t } = useTranslation();
  const [prevRoute, setPrevRoute] = useState(route);
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (route.length > 0) {
      const firstMovingIndex = route.findIndex(
        (p) => p.lat !== route[0].lat || p.lng !== route[0].lng || p.speedKph > 0.5
      );
      return firstMovingIndex !== -1 ? firstMovingIndex : 0;
    }
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier (1, 2, 5, 10)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [snappedCoords, setSnappedCoords] = useState<[number, number][]>([]);
  const [isSnapping, setIsSnapping] = useState(false);

  if (route !== prevRoute) {
    setPrevRoute(route);
    const firstMovingIndex = route.findIndex(
      (p) => p.lat !== route[0]?.lat || p.lng !== route[0]?.lng || p.speedKph > 0.5
    );
    setCurrentIndex(firstMovingIndex !== -1 ? firstMovingIndex : 0);
    setSnappedCoords([]); // Reset snapped coordinates on route change to prevent stale paths
  }

  const pointsCount = route.length;
  const latLngs = useMemo(() => route.map((p) => [p.lat, p.lng] as [number, number]), [route]);
  const activePoint = route[currentIndex];

  // Map Matching / Road Snapping from OpenStreetMap Router (OSRM)
  useEffect(() => {
    if (latLngs.length < 2) {
      return;
    }

    Promise.resolve().then(() => {
      if (active) {
        setIsSnapping(true);
      }
    });
    let active = true;

    // 1. Deduplicate consecutive stationary points to prevent OSRM 400 bad requests
    const uniquePoints: [number, number][] = [];
    for (const pt of latLngs) {
      if (uniquePoints.length === 0) {
        uniquePoints.push(pt);
      } else {
        const last = uniquePoints[uniquePoints.length - 1];
        const dist = Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]);
        if (dist > 0.0001) { // ~10m movement threshold
          uniquePoints.push(pt);
        }
      }
    }

    if (uniquePoints.length < 2) {
      setSnappedCoords(latLngs);
      return;
    }

    // 2. Downsample to max 25 distinct waypoints for OSRM URL length and stability
    const maxPoints = 25;
    const sampleRate = Math.max(1, Math.ceil(uniquePoints.length / maxPoints));
    const sampledPoints = uniquePoints.filter((_, idx) => idx % sampleRate === 0 || idx === uniquePoints.length - 1);
    const waypoints = sampledPoints.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');

    // Call API proxy to avoid browser CORS policy blocking on projectosrm.org
    apiFetch<{ routes?: Array<{ geometry?: { coordinates: [number, number][] } }> }>(
      `/trips/osrm-route?waypoints=${encodeURIComponent(waypoints)}`
    )
      .then((data) => {
        if (!active) return;
        if (data?.routes?.[0]?.geometry?.coordinates) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
          setSnappedCoords(coords);
        } else {
          setSnappedCoords(latLngs);
        }
      })
      .catch(() => {
        if (!active) return;
        setSnappedCoords(latLngs);
      })
      .finally(() => {
        if (active) {
          setIsSnapping(false);
        }
      });

    return () => {
      active = false;
    };
  }, [latLngs]);

  // Associate safety events with nearest route points for seeking
  const parsedEvents = useMemo(() => {
    if (!events || events.length === 0 || route.length === 0) return [];

    return events.map((e) => {
      const eventTime = new Date(e.ts).getTime();
      let closestIdx = 0;
      let minDiff = Infinity;

      route.forEach((pt, idx) => {
        const ptTime = new Date(pt.ts).getTime();
        const diff = Math.abs(ptTime - eventTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      const closestPoint = route[closestIdx];
      let lat = closestPoint.lat;
      let lng = closestPoint.lng;

      // Snap to closest OSRM snapped coordinate if available
      if (snappedCoords.length > 0) {
        let minDistance = Infinity;
        for (const pt of snappedCoords) {
          const dist = Math.pow(pt[0] - lat, 2) + Math.pow(pt[1] - lng, 2);
          if (dist < minDistance) {
            minDistance = dist;
            lat = pt[0];
            lng = pt[1];
          }
        }
      }

      return {
        ...e,
        lat,
        lng,
        routeIndex: closestIdx,
      };
    });
  }, [events, route, snappedCoords]);

  // Check if an event occurred at or near the current playback position
  const activeReplayEvent = useMemo(() => {
    return parsedEvents.find((e) => Math.abs(e.routeIndex - currentIndex) <= 1);
  }, [parsedEvents, currentIndex]);

  // Snap the animating vehicle position to the nearest coordinate on the snapped path (so it rides accurately on the road line)
  const activeSnappedPoint = useMemo(() => {
    if (!activePoint) return null;
    if (snappedCoords.length === 0) return [activePoint.lat, activePoint.lng] as [number, number];

    let closestPt = snappedCoords[0];
    let minDistance = Infinity;

    for (const pt of snappedCoords) {
      const dist = Math.pow(pt[0] - activePoint.lat, 2) + Math.pow(pt[1] - activePoint.lng, 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestPt = pt;
      }
    }
    return closestPt;
  }, [activePoint, snappedCoords]);

  // Calculate bearing to the next point (snapped or raw) for smooth marker rotation
  const bearing = useMemo(() => {
    if (snappedCoords.length >= 2 && activeSnappedPoint) {
      const idx = snappedCoords.findIndex(pt => pt[0] === activeSnappedPoint[0] && pt[1] === activeSnappedPoint[1]);
      if (idx !== -1 && idx < snappedCoords.length - 1) {
        const p1 = snappedCoords[idx];
        const p2 = snappedCoords[idx + 1];
        const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
        return (angle + 360) % 360;
      }
    }

    // Fallback: raw bearing
    if (currentIndex >= route.length - 1) {
      if (route.length < 2) return 0;
      const p1 = route[route.length - 2];
      const p2 = route[route.length - 1];
      return (Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * 180 / Math.PI + 360) % 360;
    }
    const p1 = route[currentIndex];
    const p2 = route[currentIndex + 1];
    return (Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * 180 / Math.PI + 360) % 360;
  }, [currentIndex, route, activeSnappedPoint, snappedCoords]);

  const dynamicBikeIcon = useMemo(() => {
    return L.divIcon({
      className: 'trip-replay-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: #3b82f6;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
          color: white;
          transform: rotate(${bearing}deg);
          transition: transform 0.15s ease-out;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" opacity="0.2"/>
            <path d="m12 7-5 7h10z" fill="currentColor"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }, [bearing]);

  const handlePlayToggle = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    const firstMovingIndex = route.findIndex(
      (p) => p.lat !== route[0].lat || p.lng !== route[0].lng || p.speedKph > 0.5
    );
    setCurrentIndex(firstMovingIndex !== -1 ? firstMovingIndex : 0);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(Number(e.target.value));
  };

  // Playback timer loop
  useEffect(() => {
    if (isPlaying) {
      const intervalDuration = Math.max(50, Math.round(1000 / playbackSpeed));
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= pointsCount - 1) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return prev;
          }
          const next = prev + 1; // Always advance by 1 point for smooth playback
          return next >= pointsCount ? pointsCount - 1 : next;
        });
      }, intervalDuration);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, pointsCount, playbackSpeed]);

  if (pointsCount === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-surface-hover text-sm text-ink-soft">
        No route telemetry found for this trip.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Leaflet Map Panel */}
      <div className="relative h-96 w-full overflow-hidden rounded-2xl border border-line bg-surface-muted shadow-inner">
        <MapContainer
          center={latLngs[0]}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution='&copy; Google'
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Hybrid">
              <TileLayer
                attribution='&copy; Google'
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Polyline Route Track (Snapped to roads if fetched successfully, otherwise raw) */}
          <Polyline
            positions={snappedCoords.length > 0 ? snappedCoords : latLngs}
            pathOptions={{
              color: '#3b82f6',
              weight: 5,
              opacity: 0.85,
              lineJoin: 'round',
            }}
          />

          {/* Thin background dotted line showing original GPS pings in case of severe OSRM variance */}
          {snappedCoords.length > 0 && snappedCoords !== latLngs && (
            <Polyline
              positions={latLngs}
              pathOptions={{
                color: '#3b82f6',
                weight: 1.5,
                opacity: 0.3,
                dashArray: '5, 8',
              }}
            />
          )}

          {/* Safety Event Markers */}
          {parsedEvents.map((e) => (
            <Marker
              key={e.id}
              position={[e.lat, e.lng]}
              icon={createEventMarkerIcon(e.severity)}
              eventHandlers={{
                click: () => {
                  setCurrentIndex(e.routeIndex);
                  setIsPlaying(false);
                },
              }}
            >
              <Popup>
                <div className="p-1 font-sans text-xs max-w-[200px]">
                  <p className="font-bold text-rose-500 uppercase tracking-wide">
                    {t(formatEnumLabel(e.type))}
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed">
                    {getEventDescription(e.type, e.metaJson, t)}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 font-medium italic">
                    {t('Click to seek replay here')}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Animating Vehicle Marker */}
          {activePoint && (
            <Marker
              position={activeSnappedPoint || [activePoint.lat, activePoint.lng]}
              icon={dynamicBikeIcon}
            />
          )}

          {/* Follow Active Marker */}
          {activePoint && (
            <FollowMarker
              position={activeSnappedPoint || [activePoint.lat, activePoint.lng]}
              isPlaying={isPlaying}
            />
          )}

          <FitBounds polyline={latLngs} />
        </MapContainer>

        {/* Real-time Safety Incident Alert Overlay */}
        {activeReplayEvent && (() => {
          const isCritical = activeReplayEvent.severity === 'CRITICAL' || activeReplayEvent.severity === 'HIGH';
          const borderColor = isCritical ? 'border-rose-500' : 'border-amber-500';
          const shadowColor = isCritical ? 'shadow-[0_12px_40px_rgba(244,63,94,0.35)]' : 'shadow-[0_12px_40px_rgba(245,158,11,0.35)]';
          const headerTextColor = isCritical ? 'text-rose-400' : 'text-amber-400';
          const badgeBgColor = isCritical ? 'bg-rose-500' : 'bg-amber-500';
          const buttonBgColor = isCritical ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600';

          return (
            <div className={`absolute bottom-4 left-3 right-3 md:right-auto md:max-w-md z-[400] rounded-2xl border-2 ${borderColor} bg-[#16161a] px-5 py-4 text-white ${shadowColor} flex items-center justify-between animate-in slide-in-from-bottom duration-300`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeBgColor} text-white animate-pulse`}>
                  <ShieldAlert size={18} />
                </span>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${headerTextColor}`}>
                    {t(formatEnumLabel(activeReplayEvent.type))} {t('detected')}
                  </p>
                  <p className="text-[11px] text-zinc-200 mt-1 leading-relaxed font-medium">
                    {getEventDescription(activeReplayEvent.type, activeReplayEvent.metaJson, t)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPlaying(false);
                }}
                className={`text-[10px] font-bold uppercase ${buttonBgColor} px-3 py-2 rounded-xl text-white ml-3 shrink-0 cursor-pointer shadow-md transition-all active:scale-95`}
              >
                {t('Pause')}
              </button>
            </div>
          );
        })()}

        {/* Real-time Stats Overlay */}
        {activePoint && (
          <div className="absolute left-3 top-3 z-[400] flex flex-wrap gap-2 rounded-xl border border-line/50 bg-black/75 px-3 py-2 text-xs font-semibold backdrop-blur-md text-white shadow-lg max-w-[calc(100%-24px)]">
            <div className="flex items-center gap-1">
              <Gauge size={12} className="text-blue-400" />
              <span>{activePoint.speedKph.toFixed(1)} KM/H</span>
            </div>
            {/* <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              <Battery size={12} className="text-emerald-400 fill-current" />
              <span>
                {activePoint.batteryPct !== null
                  ? `${activePoint.batteryPct.toFixed(0)}%`
                  : 'N/A'}
              </span>
            </div> */}
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-amber-400" />
              <span>{formatTimestamp(activePoint.ts)}</span>
            </div>
            {isSnapping && (
              <>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[10px] text-zinc-400 animate-pulse">{t('snapping road...')}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Playback Controls & scrub slider bar */}
      <div className="rounded-2xl border border-line bg-surface-muted p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Slider bar */}
          <div className="w-full sm:flex-1 order-1 sm:order-2">
            <input
              type="range"
              min="0"
              max={pointsCount - 1}
              value={currentIndex}
              onChange={handleSliderChange}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-hover accent-accent border border-line"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto order-2 sm:order-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePlayToggle}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow transition-all hover:bg-accent-strong cursor-pointer"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-hover text-ink transition hover:bg-surface-muted cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            {/* Playback Speed selector */}
            <div className="flex gap-1">
              {[1, 2, 5, 10].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'border border-line bg-surface-hover text-ink-soft hover:bg-surface-muted'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
