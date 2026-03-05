import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { FleetEvent } from './events.types';

interface SubscribeFleetPayload {
  fleetId: string;
}

@WebSocketGateway({
  namespace: '/fleet-events',
  cors: {
    origin: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  private server!: Server;

  // Tracks inbound client connections for observability.
  handleConnection(client: Socket): void {
    this.logger.debug(`WS client connected: ${client.id}`);
  }

  // Subscribes a socket connection to a fleet-specific room.
  @SubscribeMessage('subscribeFleet')
  handleSubscribeFleet(
    @MessageBody() payload: SubscribeFleetPayload,
    @ConnectedSocket() client: Socket,
  ): { subscribed: boolean; fleetId: string } {
    const fleetId = payload.fleetId?.trim();
    if (!fleetId) {
      return { subscribed: false, fleetId: '' };
    }

    void client.join(this.roomForFleet(fleetId));
    return { subscribed: true, fleetId };
  }

  // Emits newly created events to subscribed fleet dashboard clients.
  broadcastFleetEvent(fleetId: string, event: FleetEvent): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.roomForFleet(fleetId)).emit('event.created', event);
  }

  // Builds Socket.IO room names scoped by fleet id.
  private roomForFleet(fleetId: string): string {
    return `fleet:${fleetId}`;
  }
}
