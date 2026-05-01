'use client';

import { io, type Socket } from 'socket.io-client';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005').replace(
  /\/$/,
  '',
);

let fleetSocket: Socket | null = null;

// Opens (or reuses) a Socket.IO fleet namespace connection with JWT handshake auth.
export function connectFleetSocket(): Socket | null {
  if (fleetSocket) {
    return fleetSocket;
  }

  fleetSocket = io(`${API_BASE_URL}/fleet-events`, {
    transports: ['polling', 'websocket'],
    timeout: 10_000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    withCredentials: true,
  });

  return fleetSocket;
}

// Closes the active fleet websocket and resets singleton references.
export function disconnectFleetSocket(): void {
  if (!fleetSocket) {
    return;
  }
  fleetSocket.disconnect();
  fleetSocket = null;
}
