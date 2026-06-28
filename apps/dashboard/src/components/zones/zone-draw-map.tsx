'use client';

import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useTheme } from 'next-themes';
import { Globe, Navigation, Trash2 } from 'lucide-react';

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

export default function ZoneDrawMap({
  points,
  onChange,
  center,
}: {
  points: Array<[number, number]>;
  onChange: (points: Array<[number, number]>) => void;
  center?: [number, number] | null;
}) {
  const { resolvedTheme } = useTheme();
  const [mapType, setMapType] = useState<'road' | 'satellite'>('satellite');

  const handleMapClick = (latlng: L.LatLng) => {
    // GeoJSON uses [longitude, latitude] order
    onChange([...points, [latlng.lng, latlng.lat]]);
  };

  const removePoint = (index: number) => {
    onChange(points.filter((_, i) => i !== index));
  };

  // Center map on first coordinate, input center, or default Kigali coordinates
  const defaultCenter: [number, number] = [-1.944, 30.061];
  const mapCenter: [number, number] = center || (points.length > 0 ? [points[0][1], points[0][0]] : defaultCenter);

  return (
    <div className="relative rounded-xl border border-line overflow-hidden h-72 w-full bg-[#09090b]">
      <MapContainer
        center={mapCenter}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        {mapType === 'satellite' ? (
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url={resolvedTheme === 'light'
              ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
          />
        )}

        <MapEvents onMapClick={handleMapClick} />
        <MapRecenter target={mapCenter} />

        {/* Draw Polygon shape if there are at least 3 points */}
        {points.length >= 3 && (
          <Polygon
            positions={points.map((p) => [p[1], p[0]])}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }}
          />
        )}

        {/* Draw Polyline segments if there are only 2 points */}
        {points.length === 2 && (
          <Polyline
            positions={points.map((p) => [p[1], p[0]])}
            pathOptions={{ color: '#3b82f6', weight: 2 }}
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
              html: `<div class="h-3.5 w-3.5 rounded-full bg-blue-500 hover:bg-blue-400 border-2 border-white shadow-md cursor-grab active:cursor-grabbing transition-all hover:scale-110"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
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
      </MapContainer>

      {/* Map Style Selector */}
      <div className="absolute top-3 right-3 z-[500] flex gap-1 bg-[#09090b]/90 backdrop-blur border border-line rounded-lg p-0.5 shadow-md">
        <button
          type="button"
          onClick={() => setMapType('road')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-md transition ${
            mapType === 'road'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Navigation size={10} />
          Road
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-md transition ${
            mapType === 'satellite'
              ? 'bg-white/10 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Globe size={10} />
          Satellite
        </button>
      </div>

      {/* Control Overlay */}
      <div className="absolute bottom-3 left-3 z-[500] pointer-events-auto bg-[#09090b]/90 backdrop-blur border border-line rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-400 leading-tight">
        {points.length === 0 ? (
          <span>Click on the map above to start placing boundary corners.</span>
        ) : (
          <div className="flex items-center gap-2">
            <span>{points.length} corners placed. Drag points to adjust or click to delete.</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold ml-1 border-l border-line pl-2"
            >
              <Trash2 size={10} />
              Clear & Start New
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
