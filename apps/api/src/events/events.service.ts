import { Injectable } from '@nestjs/common';
import { Event, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ListEventsDto } from './dto/list-events.dto';
import { EventsGateway } from './events.gateway';
import { CreateFleetEventInput, FleetEvent } from './events.types';

@Injectable()
export class EventsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // Returns fleet-scoped events with optional time range and type filtering.
  async listEventsForUser(
    user: AuthenticatedUser,
    query: ListEventsDto,
  ): Promise<FleetEvent[]> {
    const where: Prisma.EventWhereInput = {
      fleetId: user.fleetId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.from || query.to) {
      where.ts = {};
      if (query.from) {
        where.ts.gte = new Date(query.from);
      }
      if (query.to) {
        where.ts.lte = new Date(query.to);
      }
    }

    const events = await this.prismaService.event.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: 1000,
    });

    return events.map((event) => this.toFleetEvent(event));
  }

  // Persists an event and broadcasts it to fleet websocket subscribers.
  async createFleetEvent(input: CreateFleetEventInput): Promise<FleetEvent> {
    const event = await this.prismaService.event.create({
      data: {
        fleetId: input.fleetId,
        bikeId: input.bikeId,
        deviceId: input.deviceId,
        ts: input.ts,
        type: input.type,
        severity: input.severity,
        metaJson: input.metaJson,
      },
    });

    const fleetEvent = this.toFleetEvent(event);
    this.eventsGateway.broadcastFleetEvent(input.fleetId, fleetEvent);
    return fleetEvent;
  }

  // Converts Prisma event entity into API-safe representation.
  private toFleetEvent(event: Event): FleetEvent {
    return {
      id: event.id.toString(),
      fleetId: event.fleetId,
      bikeId: event.bikeId,
      deviceId: event.deviceId,
      ts: event.ts,
      type: event.type,
      severity: event.severity,
      metaJson: event.metaJson,
      createdAt: event.createdAt,
    };
  }
}
