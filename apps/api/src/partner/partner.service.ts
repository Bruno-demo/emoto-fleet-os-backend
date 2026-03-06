import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import {
  encryptDeviceSecret,
  hashDeviceSecret,
} from '../crypto/device-secret.crypto';
import { EvidenceService } from '../evidence/evidence.service';
import type { FleetEvent } from '../events/events.types';
import { NotificationOutboxService } from '../incidents/notification-outbox.service';
import { FleetIncident } from '../incidents/incidents.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePartnerWebhookDto } from './dto/create-partner-webhook.dto';
import type { PartnerDateRangeDto } from './dto/partner-date-range.dto';
import type { PartnerListTripsDto } from './dto/partner-list-trips.dto';
import type {
  AuthenticatedPartner,
  PartnerEvidencePackSummary,
  PartnerIncidentDetails,
  PartnerIncidentTimelineEvent,
  PartnerTripSummary,
  PartnerWebhookRegistration,
  PartnerWeeklySummary,
} from './partner.types';
import { toPartnerTripSummary } from './partner.types';

const PARTNER_SCOPE_INSURER_READ = 'insurer:read';
const PARTNER_SCOPE_WEBHOOKS_WRITE = 'webhooks:write';
const INCIDENT_TIMELINE_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class PartnerService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly evidenceService: EvidenceService,
  ) {}

  // Builds fleet-level partner summary metrics for allowed insurer partners.
  async getWeeklySummaryForPartner(
    partner: AuthenticatedPartner,
    fleetId: string,
    query: PartnerDateRangeDto,
  ): Promise<PartnerWeeklySummary> {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);
    await this.assertFleetAccess(partner.partnerId, fleetId);

    const range = this.resolveTimeRange(query);
    const [tripCount, eventCount, incidentCount, crashCount, scoreAggregate] =
      await Promise.all([
        this.prismaService.trip.count({
          where: {
            fleetId,
            startTs: {
              gte: range.from,
              lte: range.to,
            },
          },
        }),
        this.prismaService.event.count({
          where: {
            fleetId,
            ts: {
              gte: range.from,
              lte: range.to,
            },
          },
        }),
        this.prismaService.incident.count({
          where: {
            fleetId,
            createdAt: {
              gte: range.from,
              lte: range.to,
            },
          },
        }),
        this.prismaService.event.count({
          where: {
            fleetId,
            type: 'CRASH',
            ts: {
              gte: range.from,
              lte: range.to,
            },
          },
        }),
        this.prismaService.trip.aggregate({
          where: {
            fleetId,
            startTs: {
              gte: range.from,
              lte: range.to,
            },
          },
          _avg: {
            score: true,
          },
        }),
      ]);

    await this.auditPartnerApiAccess(
      partner,
      fleetId,
      'partner.weekly_summary',
      {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    );

    return {
      fleetId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      tripCount,
      eventCount,
      incidentCount,
      crashCount,
      avgScore: Number(scoreAggregate._avg.score ?? 100),
    };
  }

  // Returns partner-safe trip summaries without point-level telemetry exposure.
  async listBikeTripsForPartner(
    partner: AuthenticatedPartner,
    bikeId: string,
    query: PartnerListTripsDto,
  ): Promise<PaginatedResponse<PartnerTripSummary>> {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
      select: {
        id: true,
        fleetId: true,
      },
    });
    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    await this.assertFleetAccess(partner.partnerId, bike.fleetId);
    const range = this.resolveTimeRange(query);
    const where: Prisma.TripWhereInput = {
      fleetId: bike.fleetId,
      bikeId: bike.id,
      startTs: {
        gte: range.from,
        lte: range.to,
      },
    };
    const pagination = getPaginationParams(query);
    const [trips, total] = await Promise.all([
      this.prismaService.trip.findMany({
        where,
        orderBy: {
          startTs: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.trip.count({ where }),
    ]);

    await this.auditPartnerApiAccess(
      partner,
      bike.fleetId,
      'partner.bike_trips',
      {
        bikeId,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    );

    return createPaginatedResponse(
      trips.map((trip) => toPartnerTripSummary(trip)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Returns incident metadata and nearby event timeline for partner workflows.
  async getIncidentForPartner(
    partner: AuthenticatedPartner,
    incidentId: string,
  ): Promise<PartnerIncidentDetails> {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    const incident = await this.prismaService.incident.findUnique({
      where: { id: incidentId },
      include: {
        event: {
          select: {
            id: true,
            ts: true,
          },
        },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    await this.assertFleetAccess(partner.partnerId, incident.fleetId);
    const timeline = await this.loadIncidentTimeline(incident);

    await this.auditPartnerApiAccess(
      partner,
      incident.fleetId,
      'partner.incident',
      {
        incidentId,
      },
    );

    return {
      incidentId: incident.id,
      fleetId: incident.fleetId,
      bikeId: incident.bikeId,
      deviceId: incident.deviceId,
      eventId: incident.eventId.toString(),
      status: incident.status,
      createdAt: incident.createdAt.toISOString(),
      acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      timeline,
    };
  }

  // Returns placeholder evidence-pack metadata for downstream retrieval workflows.
  async getIncidentEvidencePackForPartner(
    partner: AuthenticatedPartner,
    incidentId: string,
  ): Promise<PartnerEvidencePackSummary> {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    const evidencePack = await this.evidenceService.getEvidencePackForPartner(
      partner,
      incidentId,
    );
    await this.auditPartnerApiAccess(
      partner,
      evidencePack.fleetId,
      'partner.incident_evidence_pack',
      {
        incidentId,
      },
    );

    return evidencePack;
  }

  // Registers a partner webhook endpoint and returns its one-time signing secret.
  async createWebhookForPartner(
    partner: AuthenticatedPartner,
    dto: CreatePartnerWebhookDto,
  ): Promise<PartnerWebhookRegistration> {
    this.assertScope(partner, PARTNER_SCOPE_WEBHOOKS_WRITE);

    const webhookSecret = dto.secret?.trim() || randomBytes(24).toString('hex');
    const webhookSecretMasterKey = this.configService.get<string>(
      'PARTNER_WEBHOOK_SECRET_MASTER_KEY',
    )
      ? this.configService.getOrThrow<string>(
          'PARTNER_WEBHOOK_SECRET_MASTER_KEY',
        )
      : this.configService.getOrThrow<string>('DEVICE_SECRET_MASTER_KEY');

    const createdWebhook = await this.prismaService.partnerWebhook.create({
      data: {
        partnerId: partner.partnerId,
        url: dto.url.trim(),
        secretHash: hashDeviceSecret(webhookSecret),
        secretEncrypted: encryptDeviceSecret(
          webhookSecret,
          webhookSecretMasterKey,
        ),
        active: dto.active ?? true,
      },
    });

    const fleetAccesses = await this.prismaService.partnerFleetAccess.findMany({
      where: {
        partnerId: partner.partnerId,
        active: true,
      },
      select: {
        fleetId: true,
      },
    });

    await Promise.all(
      fleetAccesses.map((fleetAccess) =>
        this.auditService.createAuditLog({
          fleetId: fleetAccess.fleetId,
          actionType: 'PARTNER_WEBHOOK_REGISTERED',
          targetType: 'PartnerWebhook',
          targetId: createdWebhook.id,
          metaJson: {
            partnerId: partner.partnerId,
            webhookHost: this.safeUrlHost(createdWebhook.url),
            active: createdWebhook.active,
          },
        }),
      ),
    );

    return {
      id: createdWebhook.id,
      url: createdWebhook.url,
      active: createdWebhook.active,
      secret: webhookSecret,
    };
  }

  // Enqueues crash incident webhook deliveries for all active partner subscriptions.
  async enqueueCrashIncidentWebhooks(
    incident: FleetIncident,
    event: FleetEvent,
  ): Promise<void> {
    if (event.type !== 'CRASH') {
      return;
    }

    const webhooks = await this.prismaService.partnerWebhook.findMany({
      where: {
        active: true,
        partner: {
          status: 'ACTIVE',
          fleetAccesses: {
            some: {
              fleetId: incident.fleetId,
              active: true,
            },
          },
        },
      },
      select: {
        id: true,
        url: true,
        partnerId: true,
      },
    });

    for (const webhook of webhooks) {
      const notification = await this.prismaService.notification.create({
        data: {
          fleetId: incident.fleetId,
          type: NotificationType.CRASH_ALERT,
          channel: NotificationChannel.WEBHOOK,
          to: webhook.url,
          partnerWebhookId: webhook.id,
          payloadJson: {
            event: 'incident.crash.created',
            incident: {
              id: incident.id,
              fleetId: incident.fleetId,
              bikeId: incident.bikeId,
              deviceId: incident.deviceId,
              eventId: incident.eventId,
              status: incident.status,
              createdAt: incident.createdAt.toISOString(),
            },
            crash: {
              type: event.type,
              severity: event.severity,
              ts: event.ts.toISOString(),
            },
          },
        },
        select: {
          id: true,
        },
      });

      await this.notificationOutboxService.enqueueNotification(notification.id);
      await this.auditService.createAuditLog({
        fleetId: incident.fleetId,
        actionType: 'PARTNER_WEBHOOK_DELIVERY',
        targetType: 'Notification',
        targetId: notification.id,
        metaJson: {
          partnerId: webhook.partnerId,
          webhookId: webhook.id,
          webhookHost: this.safeUrlHost(webhook.url),
          status: 'PENDING',
        },
      });
    }
  }

  // Resolves date query ranges and defaults to the previous 7 days.
  private resolveTimeRange(query: { from?: string; to?: string }): {
    from: Date;
    to: Date;
  } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  // Loads surrounding events and rounds geo precision for partner-safe incident timelines.
  private async loadIncidentTimeline(incident: {
    fleetId: string;
    bikeId: string | null;
    deviceId: string;
    event: { ts: Date };
  }): Promise<PartnerIncidentTimelineEvent[]> {
    const from = new Date(
      incident.event.ts.getTime() - INCIDENT_TIMELINE_WINDOW_MS,
    );
    const to = new Date(
      incident.event.ts.getTime() + INCIDENT_TIMELINE_WINDOW_MS,
    );
    const events = await this.prismaService.event.findMany({
      where: {
        fleetId: incident.fleetId,
        ts: {
          gte: from,
          lte: to,
        },
        ...(incident.bikeId
          ? { bikeId: incident.bikeId }
          : { deviceId: incident.deviceId }),
      },
      orderBy: {
        ts: 'asc',
      },
      select: {
        id: true,
        ts: true,
        type: true,
        severity: true,
        metaJson: true,
      },
    });

    return events.map((event) => ({
      id: event.id.toString(),
      ts: event.ts.toISOString(),
      type: event.type,
      severity: event.severity,
      metaJson: this.roundLocationPrecision(event.metaJson),
    }));
  }

  // Recursively rounds location-like numeric fields to avoid exposing precise coordinates.
  private roundLocationPrecision(value: Prisma.JsonValue): Prisma.JsonValue {
    if (Array.isArray(value)) {
      return value.map((item) => this.roundLocationPrecision(item));
    }

    if (value && typeof value === 'object') {
      const roundedObject: Record<string, Prisma.JsonValue> = {};
      for (const [key, nested] of Object.entries(value)) {
        if (
          typeof nested === 'number' &&
          /(^lat$|^lng$|latitude|longitude)/i.test(key)
        ) {
          roundedObject[key] = Number(nested.toFixed(3));
          continue;
        }

        roundedObject[key] = this.roundLocationPrecision(
          nested as Prisma.JsonValue,
        );
      }

      return roundedObject;
    }

    return value;
  }

  // Records partner route access in fleet-scoped audit logs without sensitive fields.
  private async auditPartnerApiAccess(
    partner: AuthenticatedPartner,
    fleetId: string,
    endpoint: string,
    metaJson?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.auditService.createAuditLog({
      fleetId,
      actionType: 'PARTNER_API_ACCESS',
      targetType: endpoint,
      targetId: partner.partnerId,
      metaJson: {
        partnerId: partner.partnerId,
        partnerClientId: partner.partnerClientId,
        ...(metaJson && typeof metaJson === 'object' ? metaJson : {}),
      },
    });
  }

  // Ensures requested scope exists in authenticated partner token context.
  private assertScope(
    partner: AuthenticatedPartner,
    requiredScope: string,
  ): void {
    if (!partner.scopes.includes(requiredScope)) {
      throw new ForbiddenException('Partner scope not granted');
    }
  }

  // Verifies partner fleet authorization with active access grants.
  private async assertFleetAccess(
    partnerId: string,
    fleetId: string,
  ): Promise<void> {
    const access = await this.prismaService.partnerFleetAccess.findUnique({
      where: {
        partnerId_fleetId: {
          partnerId,
          fleetId,
        },
      },
      select: {
        active: true,
      },
    });

    if (!access || !access.active) {
      throw new ForbiddenException('Partner fleet access denied');
    }
  }

  // Extracts URL host safely for audit logging without exposing full callback paths.
  private safeUrlHost(urlValue: string): string {
    try {
      return new URL(urlValue).host;
    } catch {
      return 'invalid-url';
    }
  }
}
