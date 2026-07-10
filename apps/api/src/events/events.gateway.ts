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
import { ConfigService } from '@nestjs/config';
import { DeviceCommandStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { IncidentBroadcastPayload } from '../incidents/incidents.types';
import { LiveBikeState } from '../ingestion/ingestion.types';
import { FleetEvent } from './events.types';
import { PrismaService } from '../prisma/prisma.service';

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
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow connections with no origin (e.g. server-to-server, mobile apps).
      if (!origin) {
        callback(null, true);
        return;
      }
      // In production, restrict to configured origins. In dev, allow all.
      const allowedRaw = process.env.CORS_ORIGINS;
      if (!allowedRaw) {
        callback(null, true);
        return;
      }
      const allowedOrigins = allowedRaw.split(',').map((o) => o.trim());
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(
          `WebSocket CORS rejected for origin: "${origin}". Allowed origins: "${allowedRaw}"`,
        );
        callback(new Error('WebSocket CORS rejected'));
      }
    },
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly lastBikeStateEmitAt = new Map<string, number>();

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  // Installs handshake middleware that authenticates websocket JWT tokens.
  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.logger.log(
        `WS connection attempt: ${socket.id} from origin: ${socket.handshake.headers.origin}`,
      );
      void this.authenticateSocket(socket)
        .then((user) => {
          this.logger.log(
            `WS connection authenticated: ${socket.id} (user: ${user.email}, role: ${user.role})`,
          );
          this.setSocketUser(socket, user);
          next();
        })
        .catch((error: unknown) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `WS connection auth failed: ${socket.id} - ${errMsg}`,
          );
          next(new Error('Unauthorized'));
        });
    });
  }

  // Tracks inbound client connections for observability.
  async handleConnection(client: Socket): Promise<void> {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect(true);
      return;
    }

    if (user.role === 'INSURER') {
      const bikes = await this.prismaService.bike.findMany({
        where: { insurerName: user.insurerName },
        select: { fleetId: true },
      });
      const uniqueFleetIds = Array.from(new Set(bikes.map((b) => b.fleetId)));
      for (const fleetId of uniqueFleetIds) {
        void client.join(this.roomForFleet(fleetId));
      }
    } else {
      void client.join(this.roomForFleet(user.fleetId));
    }
    this.logger.debug(`WS client connected: ${client.id}`);
  }

  // Confirms client subscription to the authenticated fleet live stream room.
  @SubscribeMessage('subscribe_live')
  async handleSubscribeLive(@ConnectedSocket() client: Socket): Promise<{
    subscribed: boolean;
    fleetId?: string;
    fleetIds?: string[];
  }> {
    const user = this.getSocketUser(client);
    if (!user) {
      throw new WsException('Unauthorized');
    }

    if (user.role === 'INSURER') {
      const bikes = await this.prismaService.bike.findMany({
        where: { insurerName: user.insurerName },
        select: { fleetId: true },
      });
      const uniqueFleetIds = Array.from(new Set(bikes.map((b) => b.fleetId)));
      for (const fleetId of uniqueFleetIds) {
        void client.join(this.roomForFleet(fleetId));
      }
      return { subscribed: true, fleetIds: uniqueFleetIds };
    } else {
      void client.join(this.roomForFleet(user.fleetId));
      return { subscribed: true, fleetId: user.fleetId };
    }
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

  // Emits fleet updates (plan, type, subscription changes) to fleet websocket subscribers.
  emitFleetUpdated(
    fleetId: string,
    payload: { plan?: string; type?: string; subscriptionStatus?: string },
  ): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.roomForFleet(fleetId)).emit('fleet_updated', payload);
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

    const headerToken = this.normalizeToken(
      socket.handshake.headers.authorization,
    );
    if (headerToken) {
      return headerToken;
    }

    const cookieToken = this.extractCookieToken(
      socket.handshake.headers.cookie,
    );
    if (cookieToken) {
      return cookieToken;
    }

    this.logger.warn(
      `No WS token found in handshake auth, authorization header, or cookies (cookies present: ${!!socket.handshake.headers.cookie})`,
    );
    return null;
  }

  // Extracts the access token from the httpOnly auth cookie for browser clients.
  private extractCookieToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
      return null;
    }
    const cookieName = this.configService.get<string>(
      'AUTH_COOKIE_NAME',
      'emoto_access_token',
    );
    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    for (const cookie of cookies) {
      if (!cookie.startsWith(`${cookieName}=`)) {
        continue;
      }
      const rawValue = cookie.slice(cookieName.length + 1).trim();
      return rawValue || null;
    }
    return null;
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
      fleetId: state.fleetId,
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
