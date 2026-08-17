'use client';

import { useEffect, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useTheme } from 'next-themes';
import { Globe, Navigation, Trash2, Layers } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageProvider';
import { createBikeMarkerIcon } from '../live/live-map';
import { Bike, LiveBikeState } from '../../lib/types/dashboard';

function MapEvents({ onMapClick }: { onMapClick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function MapRecenter({ target }: { target: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView(target, map.getZoom());
    }
  }, [target, map]);
  return null;
}

function SearchControl({ onSelectLocation }: { onSelectLocation: (lat: number, lng: number) => void }) {
  const { t } = useTranslation();
  const map = useMap();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (lat: string, lon: string) => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    map.flyTo([latitude, longitude], 15);
    onSelectLocation(latitude, longitude);
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="absolute top-3 left-3 z-[500] w-64 bg-[#09090b]/90 backdrop-blur border border-line rounded-lg p-1.5 shadow-md flex flex-col gap-1.5">
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          placeholder={t("Search place...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }
          }}
          className="flex-1 bg-white/5 border border-line rounded px-2 py-1 text-xs text-zinc-100 outline-none focus:border-accent/50"
        />
        <button
          type="button"
          disabled={searching}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSearch();
          }}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded text-[10px] font-bold transition cursor-pointer"
        >
          {searching ? t("...") : t("Search")}
        </button>
      </div>
      {searchResults.length > 0 && (
        <div className="max-h-36 overflow-y-auto divide-y divide-line border-t border-line mt-1 dashboard-scrollbar" onClick={(e) => e.stopPropagation()}>
          {searchResults.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(result.lat, result.lon)}
              className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-300 hover:bg-white/10 truncate transition cursor-pointer"
              title={result.display_name}
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ZoneDrawMap({
  points,
  onChange,
  center,
  liveBikes,
  bikes,
  zoneType = 'WORK_BOUNDARY',
}: {
  points: Array<[number, number]>;
  onChange: (points: Array<[number, number]>) => void;
  center?: [number, number] | null;
  liveBikes?: LiveBikeState[];
  bikes?: Bike[];
  zoneType?: 'SLOW' | 'NO_GO' | 'PARK' | 'WORK_BOUNDARY';
}) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [mapType, setMapType] = useState<'road' | 'satellite' | 'hybrid'>('satellite');

  const bikeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bike of bikes ?? []) {
      map.set(bike.id, bike.label);
    }
    return map;
  }, [bikes]);

  const handleMapClick = (latlng: L.LatLng) => {
    // GeoJSON uses [longitude, latitude] order
    onChange([...points, [latlng.lng, latlng.lat]]);
  };

  const removePoint = (index: number) => {
    onChange(points.filter((_, i) => i !== index));
  };

  const undoLastPoint = () => {
    if (points.length > 0) {
      onChange(points.slice(0, -1));
    }
  };

  // Color coding per zone type
  const zoneColor = useMemo(() => {
    switch (zoneType) {
      case 'NO_GO':
        return { main: '#F43F5E', fill: '#F43F5E', bg: 'bg-rose-500' };
      case 'SLOW':
        return { main: '#F59E0B', fill: '#F59E0B', bg: 'bg-amber-500' };
      case 'PARK':
        return { main: '#10B981', fill: '#10B981', bg: 'bg-emerald-500' };
      case 'WORK_BOUNDARY':
      default:
        return { main: '#3B82F6', fill: '#3B82F6', bg: 'bg-blue-500' };
    }
  }, [zoneType]);

  // Center map on first coordinate, input center, or default Kigali coordinates
  const defaultCenter: [number, number] = [-1.944, 30.061];
  const mapCenter: [number, number] = center || (points.length > 0 ? [points[0][1], points[0][0]] : defaultCenter);

  return (
    <div className="relative rounded-2xl border border-line overflow-hidden h-80 w-full bg-[#09090b] shadow-inner group">
      <MapContainer
        center={mapCenter}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        {mapType === 'satellite' && (
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          />
        )}
        {mapType === 'road' && (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url={resolvedTheme === 'light'
              ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
          />
        )}
        {mapType === 'hybrid' && (
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          />
        )}

        <MapEvents onMapClick={handleMapClick} />
        <MapRecenter target={mapCenter} />
        <SearchControl onSelectLocation={() => {}} />

        {/* Draw Polygon shape if there are at least 3 points */}
        {points.length >= 3 && (
          <Polygon
            positions={points.map((p) => [p[1], p[0]])}
            pathOptions={{ color: zoneColor.main, fillColor: zoneColor.fill, fillOpacity: 0.25, weight: 3 }}
          />
        )}

        {/* Draw Polyline segments if there are only 2 points */}
        {points.length === 2 && (
          <Polyline
            positions={points.map((p) => [p[1], p[0]])}
            pathOptions={{ color: zoneColor.main, weight: 3, dashArray: '6, 6' }}
          />
        )}

        {/* Draggable Markers for Vertices */}
        {points.map((p, index) => (
          <Marker
            key={index}
            position={[p[1], p[0]]}
            draggable={true}
            icon={L.divIcon({
              className: 'custom-draggable-vertex',
              html: `<div class="h-4 w-4 rounded-full ${zoneColor.bg} border-2 border-white shadow-lg cursor-grab active:cursor-grabbing transition-all hover:scale-125 flex items-center justify-center text-[9px] font-bold text-white">${index + 1}</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
            eventHandlers={{
              dragend: (e: L.LeafletEvent) => {
                const marker = e.target as L.Marker;
                const position = marker.getLatLng();
                const updatedPoints = [...points];
                updatedPoints[index] = [position.lng, position.lat];
                onChange(updatedPoints);
              },
              click: (e: L.LeafletMouseEvent) => {
                L.DomEvent.stopPropagation(e);
                removePoint(index);
              }
            }}
          />
        ))}

        {/* Live Bike Markers for Geolocation Reference */}
        {liveBikes?.map((bikeState) => {
          const label = bikeLabelMap.get(bikeState.bikeId) || `Bike-${bikeState.bikeId.slice(0, 4)}`;
          const moving = bikeState.speedKph >= 5 || bikeState.ignition !== false;
          const icon = createBikeMarkerIcon({
            selected: false,
            moving,
            label,
          });
          return (
            <Marker
              key={bikeState.bikeId}
              position={[bikeState.lat, bikeState.lng]}
              icon={icon}
              eventHandlers={{
                click: (e) => {
                  const marker = e.target;
                  marker._map.setView(marker.getLatLng(), 16);
                }
              }}
            >
              <Popup className="emoto-poi-popup">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-white">{label}</p>
                  <p className="text-zinc-400">
                    {t('Status')}: {moving ? t('Moving') : t('Parked (Ignition Off)')}
                  </p>
                  <p className="text-zinc-400">
                    {t('Speed')}: {bikeState.speedKph.toFixed(1)} {t('kph')}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Style Selector */}
      <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-1 bg-[#09090b]/85 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-xl">
        <button
          type="button"
          onClick={() => setMapType('road')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
            mapType === 'road'
              ? 'bg-accent text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
          title={t('Map')}
        >
          <Navigation size={13} />
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
            mapType === 'satellite'
              ? 'bg-accent text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
          title={t('Satellite')}
        >
          <Globe size={13} />
        </button>
        <button
          type="button"
          onClick={() => setMapType('hybrid')}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
            mapType === 'hybrid'
              ? 'bg-accent text-white shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
          title={t('Hybrid')}
        >
          <Layers size={13} />
        </button>
      </div>

      {/* Interactive Control Overlay Bar */}
      <div className="absolute bottom-3 left-3 z-[500] pointer-events-auto bg-[#09090b]/85 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 shadow-xl flex items-center gap-3">
        {points.length === 0 ? (
          <span className="text-[11px] text-zinc-400 font-medium">📍 {t('Click on map to place boundary points')}</span>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-white text-[11px] flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${zoneColor.bg} animate-ping`} />
              {t('{count} points placed').replace('{count}', String(points.length))}
            </span>

            <div className="flex items-center gap-1 border-l border-white/15 pl-2.5">
              <button
                type="button"
                onClick={undoLastPoint}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-zinc-200 transition cursor-pointer"
              >
                {t('Undo')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[10px] font-bold transition cursor-pointer border border-rose-500/30"
              >
                <Trash2 size={10} />
                {t('Clear')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
