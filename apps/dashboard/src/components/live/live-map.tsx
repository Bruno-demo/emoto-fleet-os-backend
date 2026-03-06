'use client';

import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { z } from 'zod';
import { connectFleetSocket } from '@/lib/realtime/socket';

const bikeStateSchema = z.object({
  bikeId: z.string().uuid(),
  ts: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKph: z.number(),
  deviceId: z.string().uuid().optional(),
  deviceUid: z.string().optional(),
});

type BikeState = z.infer<typeof bikeStateSchema>;

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function LiveMapPanel() {
  const [statesByBike, setStatesByBike] = useState<Record<string, BikeState>>({});

  useEffect(() => {
    const socket = connectFleetSocket();
    if (!socket) {
      return;
    }

    socket.emit('subscribe_live', {}, () => undefined);

    // Parses websocket payloads and keeps the freshest state per bike.
    const onBikeState = (rawPayload: unknown) => {
      const parsed = bikeStateSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return;
      }

      setStatesByBike((currentState) => ({
        ...currentState,
        [parsed.data.bikeId]: parsed.data,
      }));
    };

    socket.on('bike_state', onBikeState);
    return () => {
      socket.off('bike_state', onBikeState);
    };
  }, []);

  const bikeStates = useMemo(() => Object.values(statesByBike), [statesByBike]);
  const mapCenter = useMemo<[number, number]>(() => {
    if (bikeStates.length === 0) {
      return [-1.944, 30.061];
    }
    return [bikeStates[0].lat, bikeStates[0].lng];
  }, [bikeStates]);

  return (
    <section className="space-y-4">
      <div className="h-[65vh] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <MapContainer center={mapCenter} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {bikeStates.map((bikeState) => (
            <Marker
              key={bikeState.bikeId}
              position={[bikeState.lat, bikeState.lng]}
              icon={markerIcon}
            >
              <Popup>
                <p className="font-semibold">Bike: {bikeState.bikeId.slice(0, 8)}...</p>
                <p>Speed: {bikeState.speedKph.toFixed(1)} kph</p>
                <p>Last update: {new Date(bikeState.ts).toLocaleString()}</p>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-ink">Live Bike States</h2>
        {bikeStates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Waiting for realtime `bike_state` events from Socket.IO.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {bikeStates.map((bikeState) => (
              <li
                key={bikeState.bikeId}
                className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">{bikeState.bikeId.slice(0, 8)}...</span>
                <span className="ml-2 text-ink-soft">
                  ({bikeState.lat.toFixed(5)}, {bikeState.lng.toFixed(5)}) at{' '}
                  {bikeState.speedKph.toFixed(1)} kph
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
