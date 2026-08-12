import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Incident,
  IncidentStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { EvidenceService } from '../evidence/evidence.service';
import type { IncidentEvidencePackResponse } from '../evidence/evidence.types';
import { FleetEvent } from '../events/events.types';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentStatusActionDto } from './dto/incident-status-action.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { FleetIncident } from './incidents.types';
import { NotificationOutboxService } from './notification-outbox.service';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly evidenceService: EvidenceService,
  ) {}

  // Creates one incident and notification outbox rows from an eligible CRASH event.
  async createIncidentFromCrashEvent(
    event: FleetEvent,
  ): Promise<FleetIncident | null> {
    const eventId = this.parseEventIdOrThrow(event.id);
    const createdResult = await this.prismaService.$transaction(
      async (tx) => {
        const existingIncident = await tx.incident.findUnique({
          where: { eventId },
        });
        if (existingIncident) {
          return {
            incident: null,
            notificationIds: [] as string[],
          };
        }

        const incident = await tx.incident.create({
          data: {
            fleetId: event.fleetId,
            bikeId: event.bikeId,
            deviceId: event.deviceId,
            eventId,
            status: IncidentStatus.OPEN,
          },
        });

        const activeContacts = await tx.emergencyContact.findMany({
          where: {
            fleetId: event.fleetId,
            active: true,
          },
          select: {
            id: true,
            phone: true,
          },
        });

        const activeUsers = await tx.user.findMany({
          where: {
            fleetId: event.fleetId,
            status: UserStatus.ACTIVE,
            notifCrashEvents: true,
          },
          select: {
            email: true,
            phone: true,
          },
        });

        const notificationIds: string[] = [];

        // 1. Dispatch to emergency contacts (SMS)
        for (const contact of activeContacts) {
          const notification = await tx.notification.create({
            data: {
              fleetId: event.fleetId,
              type: NotificationType.CRASH_ALERT,
              channel: NotificationChannel.SMS,
              to: contact.phone,
              payloadJson: this.buildCrashNotificationPayload(
                event,
                incident.id,
              ),
            },
            select: { id: true },
          });
          notificationIds.push(notification.id);
        }

        // 2. Dispatch to fleet operators (Email and SMS based on preferences)
        for (const user of activeUsers) {
          if (user.email) {
            const emailNotif = await tx.notification.create({
              data: {
                fleetId: event.fleetId,
                type: NotificationType.CRASH_ALERT,
                channel: NotificationChannel.EMAIL,
                to: user.email,
                payloadJson: this.buildCrashNotificationPayload(
                  event,
                  incident.id,
                ),
              },
              select: { id: true },
            });
            notificationIds.push(emailNotif.id);
          }

          if (user.phone) {
            const smsNotif = await tx.notification.create({
              data: {
                fleetId: event.fleetId,
                type: NotificationType.CRASH_ALERT,
                channel: NotificationChannel.SMS,
                to: user.phone,
                payloadJson: this.buildCrashNotificationPayload(
                  event,
                  incident.id,
                ),
              },
              select: { id: true },
            });
            notificationIds.push(smsNotif.id);
          }
        }

        return {
          incident,
          notificationIds,
        };
      },
      { timeout: 15_000 },
    );

    for (const notificationId of createdResult.notificationIds) {
      await this.notificationOutboxService.enqueueNotification(notificationId);
    }

    if (!createdResult.incident) {
      return null;
    }

    // Auto-generate evidence pack asynchronously for crash incidents
    const incidentBundle = await this.prismaService.incident.findUnique({
      where: { id: createdResult.incident.id },
      include: { event: true, bike: true, device: true },
    });
    if (incidentBundle && incidentBundle.event.type === 'CRASH') {
      this.evidenceService
        .getOrCreateEvidencePack(incidentBundle)
        .catch(() => {});
    }

    return this.toFleetIncident(createdResult.incident);
  }

  // Gets local evidence file contents if stored on disk.
  getEvidenceFile(key: string) {
    return this.evidenceService.getEvidenceFile(key);
  }

  // Creates one incident and notification outbox rows from an eligible SOS event.
  async createIncidentFromSosEvent(
    event: FleetEvent,
  ): Promise<FleetIncident | null> {
    const eventId = this.parseEventIdOrThrow(event.id);
    const createdResult = await this.prismaService.$transaction(
      async (tx) => {
        const existingIncident = await tx.incident.findUnique({
          where: { eventId },
        });
        if (existingIncident) {
          return {
            incident: null,
            notificationIds: [] as string[],
          };
        }

        const incident = await tx.incident.create({
          data: {
            fleetId: event.fleetId,
            bikeId: event.bikeId,
            deviceId: event.deviceId,
            eventId,
            status: IncidentStatus.OPEN,
          },
        });

        const activeContacts = await tx.emergencyContact.findMany({
          where: {
            fleetId: event.fleetId,
            active: true,
          },
          select: {
            id: true,
            phone: true,
          },
        });

        const activeUsers = await tx.user.findMany({
          where: {
            fleetId: event.fleetId,
            status: UserStatus.ACTIVE,
            notifSosAlerts: true,
          },
          select: {
            email: true,
            phone: true,
          },
        });

        const notificationIds: string[] = [];

        const sosPayload = {
          incidentId: incident.id,
          eventId: event.id,
          bikeId: event.bikeId,
          bikeLabel: event.bikeLabel ?? undefined,
          deviceId: event.deviceId,
          deviceUid: event.deviceUid ?? undefined,
          riderName: event.riderName ?? undefined,
          severity: event.severity,
          eventTs: event.ts.toISOString(),
          eventType: event.type,
        };

        // 1. Dispatch to emergency contacts (SMS)
        for (const contact of activeContacts) {
          const notification = await tx.notification.create({
            data: {
              fleetId: event.fleetId,
              type: NotificationType.SOS_ALERT,
              channel: NotificationChannel.SMS,
              to: contact.phone,
              payloadJson: sosPayload,
            },
            select: { id: true },
          });
          notificationIds.push(notification.id);
        }

        // 2. Dispatch to fleet operators (Email and SMS based on preferences)
        for (const user of activeUsers) {
          if (user.email) {
            const emailNotif = await tx.notification.create({
              data: {
                fleetId: event.fleetId,
                type: NotificationType.SOS_ALERT,
                channel: NotificationChannel.EMAIL,
                to: user.email,
                payloadJson: sosPayload,
              },
              select: { id: true },
            });
            notificationIds.push(emailNotif.id);
          }

          if (user.phone) {
            const smsNotif = await tx.notification.create({
              data: {
                fleetId: event.fleetId,
                type: NotificationType.SOS_ALERT,
                channel: NotificationChannel.SMS,
                to: user.phone,
                payloadJson: sosPayload,
              },
              select: { id: true },
            });
            notificationIds.push(smsNotif.id);
          }
        }

        return {
          incident,
          notificationIds,
        };
      },
      { timeout: 15_000 },
    );

    for (const notificationId of createdResult.notificationIds) {
      await this.notificationOutboxService.enqueueNotification(notificationId);
    }

    if (!createdResult.incident) {
      return null;
    }

    return this.toFleetIncident(createdResult.incident);
  }

  // Lists incidents for the caller fleet with optional status/time filters.
  async listIncidentsForUser(
    user: AuthenticatedUser,
    query: ListIncidentsDto,
  ): Promise<PaginatedResponse<FleetIncident>> {
    const where: Prisma.IncidentWhereInput = {};

    if (user.fleetPlan === 'INSURANCE') {
      where.bike = {
        insurerName: user.insurerName,
      };
    } else {
      where.fleetId = user.fleetId;
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const pagination = getPaginationParams(query);
    const [incidents, total] = await Promise.all([
      this.prismaService.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          event: true,
          bike: { select: { id: true, label: true, plate: true } },
          device: { select: { id: true, deviceUid: true } },
        },
      }),
      this.prismaService.incident.count({ where }),
    ]);

    return createPaginatedResponse(
      incidents.map((incident) => this.toFleetIncident(incident)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Gets the exact counts of incidents grouped by status for the caller fleet.
  async getIncidentStatsForUser(user: AuthenticatedUser) {
    const where: Prisma.IncidentWhereInput = {};

    if (user.fleetPlan === 'INSURANCE') {
      if (!user.insurerName) {
        return { open: 0, acknowledged: 0, resolved: 0, falseAlarm: 0 };
      }
      where.bike = {
        insurerName: user.insurerName,
      };
    } else if (user.fleetId) {
      where.fleetId = user.fleetId;
    } else {
      return { open: 0, acknowledged: 0, resolved: 0, falseAlarm: 0 };
    }

    try {
      const [open, acknowledged, resolved, falseAlarm] = await Promise.all([
        this.prismaService.incident.count({
          where: { ...where, status: IncidentStatus.OPEN },
        }),
        this.prismaService.incident.count({
          where: { ...where, status: IncidentStatus.ACKNOWLEDGED },
        }),
        this.prismaService.incident.count({
          where: { ...where, status: IncidentStatus.RESOLVED },
        }),
        this.prismaService.incident.count({
          where: { ...where, status: IncidentStatus.FALSE_ALARM },
        }),
      ]);
      return { open, acknowledged, resolved, falseAlarm };
    } catch {
      return { open: 0, acknowledged: 0, resolved: 0, falseAlarm: 0 };
    }
  }

  // Loads one incident record while enforcing fleet-level access restrictions.
  async getIncidentForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<FleetIncident> {
    const incident = await this.loadIncidentOrThrow(id);
    await this.assertIncidentAccess(incident, user);
    return this.toFleetIncident(incident);
  }

  // Generates or loads presigned evidence-pack links for one incident in caller fleet.
  async getIncidentEvidencePackForUser(
    user: AuthenticatedUser,
    id: string,
  ): Promise<IncidentEvidencePackResponse> {
    return this.evidenceService.getEvidencePackForFleetUser(user, id);
  }

  // Marks an incident as ACKNOWLEDGED by the authenticated fleet user.
  async acknowledgeIncidentForUser(
    user: AuthenticatedUser,
    id: string,
    dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    if (user.fleetPlan === 'INSURANCE') {
      throw new ForbiddenException(
        'Insurers have read-only access to incidents',
      );
    }
    const incident = await this.loadIncidentOrThrow(id);
    this.assertFleetAccess(incident.fleetId, user);

    const updatedIncident = await this.prismaService.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.ACKNOWLEDGED,
        acknowledgedByUserId: user.id,
        acknowledgedAt: new Date(),
        notes: dto.notes ?? incident.notes,
      },
    });

    return this.toFleetIncident(updatedIncident);
  }

  // Marks an incident as RESOLVED by the authenticated fleet user.
  async resolveIncidentForUser(
    user: AuthenticatedUser,
    id: string,
    dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    if (user.fleetPlan === 'INSURANCE') {
      throw new ForbiddenException(
        'Insurers have read-only access to incidents',
      );
    }
    const incident = await this.loadIncidentOrThrow(id);
    this.assertFleetAccess(incident.fleetId, user);

    const updatedIncident = await this.prismaService.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
        notes: dto.notes ?? incident.notes,
      },
    });

    return this.toFleetIncident(updatedIncident);
  }

  // Marks an incident as FALSE_ALARM by the authenticated fleet user.
  async markIncidentFalseAlarmForUser(
    user: AuthenticatedUser,
    id: string,
    dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    if (user.fleetPlan === 'INSURANCE') {
      throw new ForbiddenException(
        'Insurers have read-only access to incidents',
      );
    }
    const incident = await this.loadIncidentOrThrow(id);
    this.assertFleetAccess(incident.fleetId, user);

    const updatedIncident = await this.prismaService.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.FALSE_ALARM,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
        notes: dto.notes ?? incident.notes,
      },
    });

    return this.toFleetIncident(updatedIncident);
  }

  // Builds notification payload data for crash alerts.
  private buildCrashNotificationPayload(
    event: FleetEvent,
    incidentId: string,
  ): Prisma.InputJsonValue {
    return {
      incidentId,
      eventId: event.id,
      bikeId: event.bikeId,
      bikeLabel: event.bikeLabel ?? undefined,
      deviceId: event.deviceId,
      deviceUid: event.deviceUid ?? undefined,
      riderName: event.riderName ?? undefined,
      severity: event.severity,
      eventTs: event.ts.toISOString(),
      eventType: event.type,
    };
  }

  // Parses event ids to BigInt and fails fast when ids are malformed.
  private parseEventIdOrThrow(eventId: string): bigint {
    try {
      return BigInt(eventId);
    } catch {
      throw new NotFoundException('Invalid crash event id');
    }
  }

  // Loads one incident by id or raises 404 when not found.
  private async loadIncidentOrThrow(id: string) {
    const incident = await this.prismaService.incident.findUnique({
      where: { id },
      include: {
        event: true,
        bike: { select: { id: true, label: true, plate: true } },
        device: { select: { id: true, deviceUid: true } },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  // Validates incident visibility for insurers and normal fleets.
  private async assertIncidentAccess(
    incident: Incident,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.fleetPlan === 'INSURANCE') {
      if (!incident.bikeId) {
        throw new ForbiddenException('Access to this incident is denied');
      }
      const bike = await this.prismaService.bike.findUnique({
        where: { id: incident.bikeId },
      });
      if (!bike || bike.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this incident is denied');
      }
    } else {
      this.assertFleetAccess(incident.fleetId, user);
    }
  }

  // Validates fleet boundaries for incident operations.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Maps persisted incidents into API-safe response payloads.
  private toFleetIncident(
    incident: Incident & {
      event?: { type: string };
      bike?: { label: string; plate?: string | null } | null;
      device?: { deviceUid: string } | null;
    },
  ): FleetIncident {
    return {
      id: incident.id,
      fleetId: incident.fleetId,
      bikeId: incident.bikeId,
      deviceId: incident.deviceId,
      eventId: incident.eventId.toString(),
      status: incident.status,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      acknowledgedByUserId: incident.acknowledgedByUserId,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedByUserId: incident.resolvedByUserId,
      resolvedAt: incident.resolvedAt,
      notes: incident.notes,
      eventType: incident.event?.type,
      bikeLabel: incident.bike?.label,
      bikePlate: incident.bike?.plate ?? undefined,
      deviceUid: incident.device?.deviceUid,
    };
  }
}
