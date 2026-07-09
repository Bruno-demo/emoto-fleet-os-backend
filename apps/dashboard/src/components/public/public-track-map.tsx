'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PublicTrackMapProps {
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  rider: { lat: number; lng: number; speedKph?: number; name?: string | null } | null;
}

// Custom icons using Leaflet's L.divIcon
function createPickupIcon() {
  return L.divIcon({
    className: 'custom-pickup-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.2);
          border: 2px solid #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        ">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981;"></div>
        </div>
        <div style="
          margin-top: 4px;
          background: #09090b;
          border: 1px solid #10b981;
          color: #10b981;
          font-family: sans-serif;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        ">Pickup</div>
      </div>
    `,
    iconSize: [80, 50],
    iconAnchor: [40, 22],
  });
}

function createDropoffIcon() {
  return L.divIcon({
    className: 'custom-dropoff-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        ">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: #ef4444;"></div>
        </div>
        <div style="
          margin-top: 4px;
          background: #09090b;
          border: 1px solid #ef4444;
          color: #ef4444;
          font-family: sans-serif;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        ">Destination</div>
      </div>
    `,
    iconSize: [80, 50],
    iconAnchor: [40, 22],
  });
}

function createRiderIcon(name: string | null, speedKph: number = 0) {
  const displayLabel = name ? name : 'Courier';
  const labelWithSpeed = speedKph > 0 ? `${displayLabel} (${speedKph} km/h)` : displayLabel;
  return L.divIcon({
    className: 'custom-rider-marker',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.2);
          border: 2px solid #0ea5e9;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(14, 165, 233, 0.6);
          position: relative;
        ">
          <!-- Animated pulse ring -->
          <div style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 2px solid #0ea5e9;
            opacity: 0.8;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <!-- Custom Bike Icon SVG -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
            <circle cx="18.5" cy="17.5" r="3.5" />
            <circle cx="5.5" cy="17.5" r="3.5" />
            <circle cx="15" cy="5" r="1" />
            <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
          </svg>
        </div>
        <div style="
          margin-top: 4px;
          background: #09090b;
          border: 1px solid #0ea5e9;
          color: #fff;
          font-family: sans-serif;
          font-size: 10px;
          font-weight: bold;
          padding: 2.5px 8px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.6);
        ">${labelWithSpeed}</div>
      </div>
    `,
    iconSize: [120, 60],
    iconAnchor: [60, 24],
  });
}

function MapAutoFit({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const validCoords = coords.filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
      }
    }
  }, [coords, map]);
  return null;
}

export function PublicTrackMap({ pickup, dropoff, rider }: PublicTrackMapProps) {
  const pickupIcon = useMemo(() => createPickupIcon(), []);
  const dropoffIcon = useMemo(() => createDropoffIcon(), []);
  const riderIcon = useMemo(() => createRiderIcon(rider?.name ?? null, rider?.speedKph ?? 0), [rider?.name, rider?.speedKph]);

  const fitCoords = useMemo(() => {
    const list: [number, number][] = [
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ];
    if (rider) {
      list.push([rider.lat, rider.lng]);
    }
    return list;
  }, [pickup, dropoff, rider]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-line bg-surface-card shadow-2xl">
      <MapContainer
        center={[pickup.lat, pickup.lng]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />

        {rider && (
          <Marker position={[rider.lat, rider.lng]} icon={riderIcon} />
        )}

        <Polyline
          positions={fitCoords}
          color="#0ea5e9"
          dashArray="5, 10"
          weight={3}
          opacity={0.8}
        />

        <MapAutoFit coords={fitCoords} />
      </MapContainer>

      {/* Styled animation helper */}
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
