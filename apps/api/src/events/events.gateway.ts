import {
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  SubscribeMessage,
  WsException,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { DeviceCommandStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { IncidentBroadcastPayload } from '../incidents/incidents.types';
import { LiveBikeState } from '../ingestion/ingestion.types';
import { FleetEvent } from './events.types';

const BIKE_STATE_EMIT_THROTTLE_MS = 1_000;

type CommandStatus = DeviceCommandStatus | 'QUEUED' | 'NOT_IMPLEMENTED';

export interface CommandStatusPayload {
  commandId: string;
  status: CommandStatus;
  ts: string;
  bikeId?: string;
  deviceId?: string;
  action?: string;
  message?: string;
}

@Public()
@WebSocketGateway({
  namespace: '/fleet-events',
  cors: {
    origin: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly lastBikeStateEmitAt = new Map<string, number>();

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly authService: AuthService) {}

  // Installs handshake middleware that authenticates websocket JWT tokens.
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then((user) => {
          this.setSocketUser(socket, user);
          next();
        })
        .catch(() => {
          next(new Error('Unauthorized'));
        });
    });
  }

  // Tracks inbound client connections for observability.
  handleConnection(client: Socket): void {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect(true);
      return;
    }

    void client.join(this.roomForFleet(user.fleetId));
    this.logger.debug(`WS client connected: ${client.id}`);
  }

  // Confirms client subscription to the authenticated fleet live stream room.
  @SubscribeMessage('subscribe_live')
  handleSubscribeLive(@ConnectedSocket() client: Socket): {
    subscribed: boolean;
    fleetId: string;
  } {
    const user = this.getSocketUser(client);
    if (!user) {
      throw new WsException('Unauthorized');
    }

    void client.join(this.roomForFleet(user.fleetId));
    return { subscribed: true, fleetId: user.fleetId };
  }

  // Emits live bike-state updates to the fleet room with per-bike throttling.
  emitBikeState(state: LiveBikeState): void {
    if (!this.server) {
      return;
    }

    const emitKey = `${state.fleetId}:${state.bikeId}`;
    const now = Date.now();
    const lastEmitAt = this.lastBikeStateEmitAt.get(emitKey) ?? 0;
    if (now - lastEmitAt < BIKE_STATE_EMIT_THROTTLE_MS) {
      return;
    }

    this.lastBikeStateEmitAt.set(emitKey, now);
    this.server
      .to(this.roomForFleet(state.fleetId))
      .emit('bike_state', this.toBikeStatePayload(state));
  }

  // Emits a newly created event to fleet-scoped websocket subscribers.
  emitNewEvent(fleetId: string, event: FleetEvent): void {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.roomForFleet(fleetId))
      .emit('new_event', this.toEventPayload(event));
  }

  // Emits command lifecycle status updates to the fleet room.
  emitCommandStatus(fleetId: string, payload: CommandStatusPayload): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.roomForFleet(fleetId)).emit('command_status', payload);
  }

  // Emits newly opened incidents to fleet websocket subscribers.
  emitNewIncident(fleetId: string, payload: IncidentBroadcastPayload): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.roomForFleet(fleetId)).emit('new_incident', payload);
  }

  // Authenticates a socket using bearer token from auth payload or headers.
  private async authenticateSocket(socket: Socket): Promise<AuthenticatedUser> {
    const token = this.extractBearerToken(socket);
    if (!token) {
      throw new WsException('Missing bearer token');
    }

    return this.authService.authenticateAccessToken(token);
  }

  // Extracts bearer token from socket handshake auth and headers.
  private extractBearerToken(socket: Socket): string | null {
    const handshakeAuth = socket.handshake.auth as
      | Record<string, unknown>
      | undefined;
    const fromAuthPayload = this.normalizeToken(
      handshakeAuth?.token ?? handshakeAuth?.authorization,
    );
    if (fromAuthPayload) {
      return fromAuthPayload;
    }

    return this.normalizeToken(socket.handshake.headers.authorization);
  }

  // Normalizes supported token formats into raw JWT token string.
  private normalizeToken(tokenCandidate: unknown): string | null {
    if (typeof tokenCandidate !== 'string') {
      return null;
    }

    const trimmed = tokenCandidate.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('Bearer ')) {
      const bearerToken = trimmed.slice('Bearer '.length).trim();
      return bearerToken || null;
    }

    return trimmed;
  }

  // Shapes live bike-state payload for websocket clients.
  private toBikeStatePayload(state: LiveBikeState): Record<string, unknown> {
    return {
      bikeId: state.bikeId,
      deviceId: state.deviceId,
      ts: state.ts,
      lat: state.lat,
      lng: state.lng,
      speedKph: state.speedKph,
      heading: state.heading,
      batteryV: state.batteryV,
      ignition: state.ignition,
    };
  }

  // Shapes event payload for websocket clients.
  private toEventPayload(event: FleetEvent): Record<string, unknown> {
    return {
      id: event.id,
      bikeId: event.bikeId,
      deviceId: event.deviceId,
      ts: event.ts.toISOString(),
      type: event.type,
      severity: event.severity,
      metaJson: event.metaJson,
      createdAt: event.createdAt.toISOString(),
    };
  }

  // Reads the authenticated websocket user from socket-scoped state.
  private getSocketUser(socket: Socket): AuthenticatedUser | null {
    const data = socket.data as { user?: AuthenticatedUser };
    return data.user ?? null;
  }

  // Stores authenticated websocket user context on socket-scoped state.
  private setSocketUser(socket: Socket, user: AuthenticatedUser): void {
    const data = socket.data as { user?: AuthenticatedUser };
    data.user = user;
  }

  // Builds Socket.IO room names scoped by fleet id.
  private roomForFleet(fleetId: string): string {
    return `fleet:${fleetId}`;
  }
}
