'use client';

import { io, type Socket } from 'socket.io-client';
import { readAuthToken } from '@/lib/auth/session';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

let fleetSocket: Socket | null = null;
let currentToken: string | null = null;

// Opens (or reuses) a Socket.IO fleet namespace connection with JWT handshake auth.
export function connectFleetSocket(): Socket | null {
  const token = readAuthToken();
  if (!token) {
    return null;
  }

  if (fleetSocket && currentToken === token) {
    return fleetSocket;
  }

  if (fleetSocket) {
    fleetSocket.disconnect();
    fleetSocket = null;
  }

  currentToken = token;
  fleetSocket = io(`${API_BASE_URL}/fleet-events`, {
    transports: ['polling', 'websocket'],
    timeout: 10_000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
    auth: {
      token,
    },
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
  currentToken = null;
}
