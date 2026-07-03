'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

const eventMarkerIcon = L.divIcon({
  className: 'event-marker',
  html: `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: #ef4444;
      border: 2px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.5);
      color: white;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

interface EventMapProps {
  lat: number;
  lng: number;
}

export function EventMap({ lat, lng }: EventMapProps) {
  return (
    <div className="relative h-60 w-full overflow-hidden rounded-2xl border border-line bg-surface-muted shadow-inner">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[lat, lng]} icon={eventMarkerIcon} />
      </MapContainer>
    </div>
  );
}
