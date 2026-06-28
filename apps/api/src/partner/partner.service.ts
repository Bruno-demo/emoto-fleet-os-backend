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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
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

    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    let bikeFilter: Prisma.BikeWhereInput | undefined = undefined;

    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      if (user?.fleet?.insurerName) {
        bikeFilter = { insurerName: user.fleet.insurerName };
      }
    }

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
            ...(bikeFilter ? { bike: bikeFilter } : {}),
          },
        }),
        this.prismaService.event.count({
          where: {
            fleetId,
            ts: {
              gte: range.from,
              lte: range.to,
            },
            ...(bikeFilter ? { bike: bikeFilter } : {}),
          },
        }),
        this.prismaService.incident.count({
          where: {
            fleetId,
            createdAt: {
              gte: range.from,
              lte: range.to,
            },
            ...(bikeFilter ? { bike: bikeFilter } : {}),
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
            ...(bikeFilter ? { bike: bikeFilter } : {}),
          },
        }),
        this.prismaService.trip.aggregate({
          where: {
            fleetId,
            startTs: {
              gte: range.from,
              lte: range.to,
            },
            ...(bikeFilter ? { bike: bikeFilter } : {}),
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
        insurerName: true,
      },
    });
    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    await this.assertFleetAccess(partner.partnerId, bike.fleetId);

    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      if (
        !user?.fleet?.insurerName ||
        bike.insurerName !== user.fleet.insurerName
      ) {
        throw new ForbiddenException('Access to this bike is denied');
      }
    }
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

  async listBikesForPartner(
    partner: AuthenticatedPartner,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<any>> {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    const partnerUser = await this.prismaService.user.findFirst({
      where: { id: partner.partnerId },
      select: { fleetId: true },
    });
    const fleetId = partnerUser?.fleetId;

    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    const where: Prisma.BikeWhereInput = {};

    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      if (user?.fleet?.insurerName) {
        where.insurerName = user.fleet.insurerName;
      } else {
        where.insurerName = '____non_existent_insurer____';
      }
    } else {
      const activeAccesses =
        await this.prismaService.partnerFleetAccess.findMany({
          where: {
            partnerId: partner.partnerId,
            active: true,
          },
          select: {
            fleetId: true,
          },
        });
      const fleetIds = activeAccesses.map((a) => a.fleetId);
      where.fleetId = { in: fleetIds };
    }

    const pagination = getPaginationParams(query);

    const [bikes, total] = await Promise.all([
      this.prismaService.bike.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          fleetId: true,
          label: true,
          plate: true,
          serial: true,
          model: true,
          status: true,
          insurerName: true,
          createdAt: true,
          fleet: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prismaService.bike.count({ where }),
    ]);

    if (fleetId) {
      await this.auditPartnerApiAccess(partner, fleetId, 'partner.list_bikes', {
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
    }

    return createPaginatedResponse(
      bikes.map((b) => ({
        id: b.id,
        fleetId: b.fleetId,
        fleetName: b.fleet?.name ?? 'No Fleet',
        label: b.label,
        plate: b.plate,
        serial: b.serial,
        model: b.model,
        status: b.status,
        insurerName: b.insurerName,
        createdAt: b.createdAt,
      })),
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
        bike: {
          select: {
            insurerName: true,
          },
        },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    await this.assertFleetAccess(partner.partnerId, incident.fleetId);

    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      if (
        !incident.bike ||
        !user?.fleet?.insurerName ||
        incident.bike.insurerName !== user.fleet.insurerName
      ) {
        throw new ForbiddenException('Access to this incident is denied');
      }
    }

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

    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    if (isInsurer) {
      const incident = await this.prismaService.incident.findUnique({
        where: { id: incidentId },
        select: {
          bike: {
            select: { insurerName: true },
          },
        },
      });
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      if (
        !incident.bike ||
        !user?.fleet?.insurerName ||
        incident.bike.insurerName !== user.fleet.insurerName
      ) {
        throw new ForbiddenException('Access to this evidence pack is denied');
      }
    }

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

    const bike = incident.bikeId
      ? await this.prismaService.bike.findUnique({
          where: { id: incident.bikeId },
          select: { insurerName: true },
        })
      : null;

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

    const partnerIds = webhooks.map((w) => w.partnerId);
    const insurers = await this.prismaService.user.findMany({
      where: {
        id: { in: partnerIds },
        fleet: { plan: 'INSURANCE' },
      },
      select: { id: true },
    });
    const insurerIds = new Set(insurers.map((u) => u.id));

    for (const webhook of webhooks) {
      const isInsurer = insurerIds.has(webhook.partnerId);
      if (isInsurer) {
        const user = await this.prismaService.user.findFirst({
          where: { id: webhook.partnerId },
          include: { fleet: true },
        });
        if (
          !bike ||
          !user?.fleet?.insurerName ||
          bike.insurerName !== user.fleet.insurerName
        ) {
          continue;
        }
      }
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
  async getRiderSafetyScore(
    partner: AuthenticatedPartner,
    riderId: string,
  ) {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    // 1. Find the rider and their profile
    const rider = await this.prismaService.user.findFirst({
      where: {
        id: riderId,
        role: 'RIDER',
      },
      include: {
        riderProfile: true,
      },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    // 2. If caller is an insurer, verify they insure the rider's bike
    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      const insurerName = user?.fleet?.insurerName;
      // Get rider's active bike assignment
      const assignedBike = await this.prismaService.bike.findFirst({
        where: {
          insurerName: insurerName,
          assignments: {
            some: {
              riderUserId: rider.id,
              active: true,
            },
          },
        },
      });
      if (!assignedBike) {
        throw new ForbiddenException('Access to this rider score is denied');
      }
    }

    // 3. Query the last 30 days of trips for this rider
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trips = await this.prismaService.trip.findMany({
      where: {
        riderId: rider.id,
        startTs: { gte: thirtyDaysAgo },
      },
      select: {
        score: true,
      },
    });

    const scores = trips
      .map((t) => Number(t.score))
      .filter((s) => !isNaN(s));
      
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 100; // Default to 100 if no trips recorded

    return {
      riderId: rider.id,
      riderName: rider.riderProfile?.fullName ?? rider.email,
      avgScore,
      tripCount: trips.length,
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

  async getBikeWeeklyMileage(
    partner: AuthenticatedPartner,
    bikeId: string,
  ) {
    this.assertScope(partner, PARTNER_SCOPE_INSURER_READ);

    // 1. Find the bike
    const bike = await this.prismaService.bike.findUnique({
      where: { id: bikeId },
    });
    if (!bike) throw new NotFoundException('Bike not found');

    // 2. If caller is an insurer, verify they insure this bike
    const isInsurer = await this.isInsurerPartner(partner.partnerId);
    if (isInsurer) {
      const user = await this.prismaService.user.findFirst({
        where: { id: partner.partnerId },
        include: { fleet: true },
      });
      const insurerName = user?.fleet?.insurerName;
      if (bike.insurerName !== insurerName) {
        throw new ForbiddenException('Access to this bike mileage is denied');
      }
    }

    // 3. Query trips in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trips = await this.prismaService.trip.findMany({
      where: {
        bikeId: bike.id,
        startTs: { gte: sevenDaysAgo },
      },
      select: {
        distanceKm: true,
      },
    });

    const weeklyMileageKm = trips.reduce(
      (sum, trip) => sum + Number(trip.distanceKm || 0),
      0,
    );

    return {
      bikeId: bike.id,
      bikeLabel: bike.label,
      weeklyMileageKm: Math.round(weeklyMileageKm * 100) / 100,
      tripCount: trips.length,
      periodStart: sevenDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

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
    const user = await this.prismaService.user.findFirst({
      where: { id: partnerId },
      include: { fleet: true },
    });

    if (user?.fleet?.plan === 'INSURANCE' && user.fleet.insurerName) {
      const hasInsuredBike = await this.prismaService.bike.findFirst({
        where: {
          fleetId,
          insurerName: user.fleet.insurerName,
        },
      });
      if (hasInsuredBike) {
        return;
      }
      throw new ForbiddenException(
        'Partner fleet access denied (no insured bikes in this fleet)',
      );
    }

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

  // Determines if the partner ID corresponds to an INSURER role or an insurance fleet.
  private async isInsurerPartner(partnerId: string): Promise<boolean> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: partnerId,
        fleet: {
          plan: 'INSURANCE',
        },
      },
      select: { id: true },
    });
    return !!user;
  }
}
