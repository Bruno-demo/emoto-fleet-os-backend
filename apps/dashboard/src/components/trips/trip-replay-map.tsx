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
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { formatTimestamp } from '@/lib/ui';

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

export function TripReplayMap({ route }: TripReplayMapProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier (1, 2, 5, 10)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pointsCount = route.length;
  const latLngs = route.map((p) => [p.lat, p.lng] as [number, number]);
  const activePoint = route[currentIndex];

  const handlePlayToggle = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
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
      <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-line bg-surface-muted shadow-inner">
        <MapContainer
          center={latLngs[0]}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Polyline Route Track */}
          <Polyline
            positions={latLngs}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.7,
              lineJoin: 'round',
            }}
          />

          {/* Animating Vehicle Marker */}
          {activePoint && (
            <Marker
              position={[activePoint.lat, activePoint.lng]}
              icon={bikeMarkerIcon}
            />
          )}

          <FitBounds polyline={latLngs} />
        </MapContainer>

        {/* Real-time Stats Overlay */}
        {activePoint && (
          <div className="absolute left-3 top-3 z-[400] flex flex-wrap gap-2 rounded-xl border border-line/50 bg-black/65 px-3 py-2 text-xs font-semibold backdrop-blur-md text-white shadow-lg max-w-[calc(100%-24px)]">
            <div className="flex items-center gap-1">
              <Gauge size={12} className="text-blue-400" />
              <span>{activePoint.speedKph.toFixed(1)} KM/H</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              <Battery size={12} className="text-emerald-400 fill-current" />
              <span>
                {activePoint.batteryPct !== null
                  ? `${activePoint.batteryPct.toFixed(0)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-amber-400" />
              <span>{formatTimestamp(activePoint.ts)}</span>
            </div>
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
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow transition-all hover:brightness-110"
                style={{ backgroundColor: '#3B82F6', color: '#FFFFFF' }}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-hover text-ink transition hover:bg-surface-muted"
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
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
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
