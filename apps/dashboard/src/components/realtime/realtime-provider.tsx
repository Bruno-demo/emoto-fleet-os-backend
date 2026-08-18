'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { connectFleetSocket, disconnectFleetSocket } from '@/lib/realtime/socket';
import type {
  CommandStatusEvent,
  FleetEvent,
  LiveBikeState,
} from '@/lib/types/dashboard';

const bikeStateSchema = z.object({
  fleetId: z.string().min(1),
  bikeId: z.string().uuid(),
  deviceId: z.string().uuid(),
  ts: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKph: z.number(),
  heading: z.number().optional(),
  batteryV: z.number().optional(),
  batteryPct: z.number().optional(),
  ignition: z.boolean().optional(),
  mainPowerCut: z.boolean().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  bikeId: z.string().uuid().nullable(),
  deviceId: z.string().uuid(),
  ts: z.string(),
  type: z.enum([
    'OVERSPEED',
    'SPEED_LIMIT_VIOLATION',
    'SCHOOL_ZONE_SPEED',
    'HOSPITAL_ZONE_SPEED',
    'MARKET_ZONE_SPEED',
    'HARSH_BRAKE',
    'HARSH_ACCEL',
    'HARSH_CORNER',
    'CRASH',
    'THEFT_SUSPECTED',
    'SOS',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  metaJson: z.unknown(),
  createdAt: z.string(),
});

const commandStatusSchema = z.object({
  commandId: z.string(),
  status: z.enum([
    'PENDING',
    'SENT',
    'ACKED',
    'FAILED',
    'EXPIRED',
    'QUEUED',
    'NOT_IMPLEMENTED',
  ]),
  ts: z.string(),
  bikeId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  action: z.string().optional(),
  message: z.string().optional(),
});

interface RealtimeContextValue {
  bikeStates: Record<string, LiveBikeState>;
  recentEvents: FleetEvent[];
  commandStatuses: CommandStatusEvent[];
  connectionState: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  recordCommandStatus: (status: CommandStatusEvent) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const MAX_RECENT_EVENTS = 60;
const MAX_COMMAND_STATUSES = 80;
const BIKE_STATE_BATCH_FLUSH_MS = 500;
const EVENT_BATCH_FLUSH_MS = 300;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [bikeStates, setBikeStates] = useState<Record<string, LiveBikeState>>({});
  const [recentEvents, setRecentEvents] = useState<FleetEvent[]>([]);
  const [commandStatuses, setCommandStatuses] = useState<CommandStatusEvent[]>([]);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'offline'
  >(() => {
    return typeof window === 'undefined' ? 'offline' : 'connecting';
  });

  // Mutable buffer refs to prevent React state flood on high-frequency telemetry bursts
  const bikeStatesBufferRef = useRef<Record<string, LiveBikeState>>({});
  const bikeStatesFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventsBufferRef = useRef<FleetEvent[]>([]);
  const eventsFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stores synthetic or websocket-delivered command updates in a capped local stream.
  const recordCommandStatus = useCallback((status: CommandStatusEvent) => {
    setCommandStatuses((currentStatuses) =>
      [status, ...currentStatuses].slice(0, MAX_COMMAND_STATUSES),
    );
  }, []);

  useEffect(() => {
    const socket = connectFleetSocket();
    if (!socket) {
      return;
    }
    socket.emit('subscribe_live', {}, () => undefined);

    const flushBikeStates = () => {
      const buffer = bikeStatesBufferRef.current;
      const keys = Object.keys(buffer);
      if (keys.length === 0) return;

      setBikeStates((currentStates) => {
        const next = { ...currentStates };
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          next[key] = buffer[key];
        }
        return next;
      });
      bikeStatesBufferRef.current = {};
    };

    const flushEvents = () => {
      const buffer = eventsBufferRef.current;
      if (buffer.length === 0) return;

      setRecentEvents((currentEvents) =>
        [...buffer, ...currentEvents].slice(0, MAX_RECENT_EVENTS),
      );
      eventsBufferRef.current = [];
    };

    // Buffers per-bike websocket state updates and flushes in batches to prevent UI freeze
    const onBikeState = (rawPayload: unknown) => {
      const parsed = bikeStateSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return;
      }
      bikeStatesBufferRef.current[parsed.data.bikeId] = parsed.data;

      if (!bikeStatesFlushTimerRef.current) {
        bikeStatesFlushTimerRef.current = setTimeout(() => {
          bikeStatesFlushTimerRef.current = null;
          flushBikeStates();
        }, BIKE_STATE_BATCH_FLUSH_MS);
      }
    };

    // Buffers recent fleet events for map feed and toast notifications.
    const onNewEvent = (rawPayload: unknown) => {
      const parsed = eventSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return;
      }
      eventsBufferRef.current.unshift(parsed.data);

      if (!eventsFlushTimerRef.current) {
        eventsFlushTimerRef.current = setTimeout(() => {
          eventsFlushTimerRef.current = null;
          flushEvents();
        }, EVENT_BATCH_FLUSH_MS);
      }
    };

    // Stores command status transitions for live command tracking UI.
    const onCommandStatus = (rawPayload: unknown) => {
      const parsed = commandStatusSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return;
      }
      recordCommandStatus(parsed.data);
    };

    // Listens for fleet updates (plan/type/subscription status) and invalidates query cache to trigger reload.
    const onFleetUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    };

    // Tracks websocket lifecycle so the shell can expose connection health clearly.
    const onConnect = () => {
      setConnectionState('connected');
    };

    // Reflects transport interruptions without disconnecting the rest of the UI.
    const onDisconnect = () => {
      setConnectionState('reconnecting');
    };

    // Reflects failed handshake or retry attempts without leaving the UI in a false connected state.
    const onConnectError = (error: Error) => {
      if (error.message === 'Unauthorized') {
        setConnectionState('offline');
        return;
      }
      setConnectionState('reconnecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('bike_state', onBikeState);
    socket.on('new_event', onNewEvent);
    socket.on('command_status', onCommandStatus);
    socket.on('fleet_updated', onFleetUpdated);

    return () => {
      if (bikeStatesFlushTimerRef.current) {
        clearTimeout(bikeStatesFlushTimerRef.current);
        bikeStatesFlushTimerRef.current = null;
      }
      if (eventsFlushTimerRef.current) {
        clearTimeout(eventsFlushTimerRef.current);
        eventsFlushTimerRef.current = null;
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('bike_state', onBikeState);
      socket.off('new_event', onNewEvent);
      socket.off('command_status', onCommandStatus);
      socket.off('fleet_updated', onFleetUpdated);
      disconnectFleetSocket();
    };
  }, [recordCommandStatus, queryClient]);

  const contextValue = useMemo(
    () => ({
      bikeStates,
      recentEvents,
      commandStatuses,
      connectionState,
      recordCommandStatus,
    }),
    [bikeStates, recentEvents, commandStatuses, connectionState, recordCommandStatus],
  );

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }

  return context;
}

