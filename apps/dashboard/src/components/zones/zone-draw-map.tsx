'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import { useTheme } from 'next-themes';

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
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={resolvedTheme === 'light'
            ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
        />

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

        {/* Render Vertex markers (CircleMarkers are lightweight and avoid asset path resolution errors in Next.js) */}
        {points.map((p, index) => (
          <CircleMarker
            key={index}
            center={[p[1], p[0]]}
            radius={6}
            pathOptions={{
              color: '#1d4ed8',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              weight: 2,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                removePoint(index);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Control Overlay */}
      <div className="absolute bottom-3 left-3 z-[500] pointer-events-auto bg-[#09090b]/90 backdrop-blur border border-line rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-400 leading-tight">
        {points.length === 0 ? (
          <span>Click on the map above to start placing boundary corners.</span>
        ) : (
          <div className="flex items-center gap-2">
            <span>{points.length} corners placed. Click a corner marker to remove it.</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="text-red-400 hover:text-red-300 font-bold ml-1 border-l border-line pl-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
