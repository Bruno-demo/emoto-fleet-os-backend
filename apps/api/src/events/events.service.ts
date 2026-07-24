import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, EventSeverity, Prisma, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import {
  FleetIncident,
  IncidentBroadcastPayload,
} from '../incidents/incidents.types';
import { IncidentsService } from '../incidents/incidents.service';
import { MetricsService } from '../metrics/metrics.service';
import { PartnerService } from '../partner/partner.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListEventsDto } from './dto/list-events.dto';
import { EventsGateway } from './events.gateway';
import { CreateFleetEventInput, FleetEvent } from './events.types';

const SEVERITY_ORDER: Record<EventSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

@Injectable()
export class EventsService {
  private readonly incidentCrashMinSeverity: EventSeverity;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly incidentsService: IncidentsService,
    private readonly partnerService: PartnerService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.incidentCrashMinSeverity = this.configService.get<EventSeverity>(
      'INCIDENT_CRASH_MIN_SEVERITY',
      EventSeverity.HIGH,
    );
  }

  // Returns fleet-scoped events with optional time range and type filtering.
  async listEventsForUser(
    user: AuthenticatedUser,
    query: ListEventsDto,
  ): Promise<PaginatedResponse<FleetEvent>> {
    const where: Prisma.EventWhereInput = {};

    if (user.role === UserRole.INSURER) {
      if (query.bikeId) {
        const bike = await this.prismaService.bike.findUnique({
          where: { id: query.bikeId },
          select: { insurerName: true },
        });
        if (!bike || bike.insurerName !== user.insurerName) {
          throw new ForbiddenException('Access to this bike is denied');
        }
      }
      where.bike = { insurerName: user.insurerName };
    } else {
      where.fleetId = user.fleetId;
    }

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

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.bikeId) {
      where.bikeId = query.bikeId;
    }

    if (query.deviceId) {
      where.deviceId = query.deviceId;
    }

    const pagination = getPaginationParams(query);

    const [events, total] = await Promise.all([
      this.prismaService.event.findMany({
        where,
        include: {
          bike: {
            select: {
              id: true,
              label: true,
              plate: true,
              assignments: {
                where: { active: true },
                take: 1,
                select: {
                  rider: {
                    select: {
                      id: true,
                      phone: true,
                      riderProfile: { select: { fullName: true } },
                    },
                  },
                },
              },
            },
          },
          device: {
            select: {
              id: true,
              deviceUid: true,
            },
          },
        },
        orderBy: { ts: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.event.count({ where }),
    ]);

    let enrichedEvents = events.map((event) => this.toFleetEvent(event));

    if (events.length > 0) {
      const telemetryPoints = await this.prismaService.telemetryPoint.findMany({
        where: {
          OR: events.map((e) => ({
            deviceId: e.deviceId,
            ts: e.ts,
          })),
        },
        select: {
          deviceId: true,
          ts: true,
          lat: true,
          lng: true,
        },
      });

      const coordsMap = new Map<string, { lat: number; lng: number }>();
      for (const point of telemetryPoints) {
        coordsMap.set(`${point.deviceId}_${point.ts.toISOString()}`, {
          lat: Number(point.lat),
          lng: Number(point.lng),
        });
      }

      enrichedEvents = enrichedEvents.map((fleetEvent) => {
        const coords = coordsMap.get(
          `${fleetEvent.deviceId}_${fleetEvent.ts.toISOString()}`,
        );
        if (coords) {
          const meta =
            fleetEvent.metaJson &&
            typeof fleetEvent.metaJson === 'object' &&
            !Array.isArray(fleetEvent.metaJson)
              ? (fleetEvent.metaJson as Record<string, unknown>)
              : {};
          fleetEvent.metaJson = { ...meta, lat: coords.lat, lng: coords.lng };
        }
        return fleetEvent;
      });
    }

    return createPaginatedResponse(
      enrichedEvents,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Persists an event and broadcasts it to fleet websocket subscribers.
  async createFleetEvent(input: CreateFleetEventInput): Promise<FleetEvent> {
    let dbLat = null;
    let dbLng = null;
    try {
      const tp = await this.prismaService.telemetryPoint.findFirst({
        where: {
          deviceId: input.deviceId,
          ts: input.ts,
        },
        select: {
          lat: true,
          lng: true,
        },
      });
      if (tp) {
        dbLat = Number(tp.lat);
        dbLng = Number(tp.lng);
      }
    } catch {
      // Ignore lookup errors
    }

    const inputMeta =
      input.metaJson &&
      typeof input.metaJson === 'object' &&
      !Array.isArray(input.metaJson)
        ? (input.metaJson as Record<string, unknown>)
        : {};
    const lat = typeof inputMeta.lat === 'number' ? inputMeta.lat : dbLat;
    const lng = typeof inputMeta.lng === 'number' ? inputMeta.lng : dbLng;

    const metaJson = { ...inputMeta, lat, lng } as Prisma.InputJsonValue;

    const event = await this.prismaService.event.create({
      data: {
        fleetId: input.fleetId,
        bikeId: input.bikeId,
        deviceId: input.deviceId,
        ts: input.ts,
        type: input.type,
        severity: input.severity,
        metaJson,
      },
    });

    const fleetEvent = this.toFleetEvent(event);
    this.eventsGateway.emitNewEvent(input.fleetId, fleetEvent);
    this.metricsService.incrementEventCreated(
      fleetEvent.type,
      fleetEvent.severity,
    );

    let incident = await this.tryCreateIncidentFromCrashEvent(fleetEvent);
    if (!incident && fleetEvent.type === 'SOS') {
      const fleet = await this.prismaService.fleet.findUnique({
        where: { id: fleetEvent.fleetId },
        select: { type: true },
      });
      if (fleet?.type === 'PERSONAL') {
        incident =
          await this.incidentsService.createIncidentFromSosEvent(fleetEvent);
      }
    }

    if (incident) {
      if (fleetEvent.type === 'CRASH') {
        await this.partnerService.enqueueCrashIncidentWebhooks(
          incident,
          fleetEvent,
        );
      }
      this.eventsGateway.emitNewIncident(
        input.fleetId,
        this.toIncidentBroadcastPayload(incident),
      );
    }

    return fleetEvent;
  }

  // Creates incidents only for crash events meeting minimum severity threshold.
  private async tryCreateIncidentFromCrashEvent(
    event: FleetEvent,
  ): Promise<FleetIncident | null> {
    if (event.type !== 'CRASH') {
      return null;
    }

    const eventSeverityRank = SEVERITY_ORDER[event.severity];
    const thresholdSeverityRank = SEVERITY_ORDER[this.incidentCrashMinSeverity];
    if (eventSeverityRank < thresholdSeverityRank) {
      return null;
    }

    return this.incidentsService.createIncidentFromCrashEvent(event);
  }

  // Projects incident records into websocket-safe payloads for fleet dashboards.
  private toIncidentBroadcastPayload(
    incident: FleetIncident,
  ): IncidentBroadcastPayload {
    return {
      id: incident.id,
      bikeId: incident.bikeId,
      deviceId: incident.deviceId,
      eventId: incident.eventId,
      status: incident.status,
      createdAt: incident.createdAt.toISOString(),
    };
  }

  // Converts Prisma event entity into API-safe representation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toFleetEvent(event: any): FleetEvent {
    const activeRider = event.bike?.assignments?.[0]?.rider;
    const riderName =
      activeRider?.riderProfile?.fullName || activeRider?.phone || null;

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
      bikeLabel: event.bike?.label ?? null,
      bikePlate: event.bike?.plate ?? null,
      deviceUid: event.device?.deviceUid ?? null,
      riderName,
    };
  }
}
