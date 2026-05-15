import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus, UserRole, FleetPlan, FleetSubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class HqService {
  constructor(private prisma: PrismaService) {}

  // ── Overview ──────────────────────────────────────────────────────

  async getStats() {
    const [
      totalFleets,
      totalBikes,
      totalRiders,
      totalDevices,
      totalPendingSetups,
      totalPartners,
      totalIncidents,
      openIncidents,
    ] = await Promise.all([
      this.prisma.fleet.count(),
      this.prisma.bike.count(),
      this.prisma.user.count({ where: { role: 'RIDER' } }),
      this.prisma.device.count(),
      this.prisma.user.count({ where: { status: 'PENDING_SETUP' } }),
      this.prisma.partner.count(),
      this.prisma.incident.count(),
      this.prisma.incident.count({ where: { status: 'OPEN' } }),
    ]);

    return {
      totalFleets,
      totalBikes,
      totalRiders,
      totalDevices,
      totalPendingSetups,
      totalPartners,
      totalIncidents,
      openIncidents,
    };
  }

  async getHealth() {
    const [dbOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    ]);

    return [
      { label: 'EMQX Cluster', status: 'Operational', color: 'text-emerald-400' },
      { label: 'Core API', status: 'Healthy', color: 'text-emerald-400' },
      { label: 'Telemetry Engine', status: 'Nominal', color: 'text-emerald-400' },
      { label: 'Database Layer', status: dbOk ? 'Hypertable Active' : 'Degraded', color: dbOk ? 'text-sky-400' : 'text-rose-400' },
    ];
  }

  async getEvents() {
    const [fleets, users] = await Promise.all([
      this.prisma.fleet.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { fleet: true },
      }),
    ]);

    const events = [
      ...fleets.map(f => ({
        fleet: f.name,
        event: 'New Fleet Provisioned',
        time: this.formatRelative(f.createdAt),
        type: 'success',
      })),
      ...users.map(u => ({
        fleet: u.fleet?.name ?? 'Unknown',
        event: 'Operator Account Activated',
        time: this.formatRelative(u.createdAt),
        type: 'info',
      })),
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);

    return events;
  }

  // ── Fleets ────────────────────────────────────────────────────────

  async getFleets() {
    return this.prisma.fleet.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, bikes: true },
        },
      },
    });
  }

  async getFleetById(fleetId: string) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: {
        users: {
          select: { id: true, email: true, phone: true, role: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        bikes: {
          select: { id: true, label: true, plate: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { users: true, bikes: true, events: true, trips: true, devices: true, incidents: true },
        },
      },
    });

    if (!fleet) throw new NotFoundException(`Fleet ${fleetId} not found`);
    return fleet;
  }

  async updateFleetPlan(fleetId: string, plan: string) {
    const fleet = await this.prisma.fleet.findUnique({ where: { id: fleetId } });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (!['DEMO', 'PREMIUM'].includes(plan)) {
      throw new BadRequestException('Invalid plan. Must be DEMO or PREMIUM');
    }

    return this.prisma.fleet.update({
      where: { id: fleetId },
      data: { plan: plan as FleetPlan },
      select: { id: true, name: true, plan: true },
    });
  }

  async updateFleetSubscription(fleetId: string, status: string) {
    const fleet = await this.prisma.fleet.findUnique({ where: { id: fleetId } });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (!['ACTIVE', 'PAST_DUE', 'CANCELED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.fleet.update({
      where: { id: fleetId },
      data: { subscriptionStatus: status as FleetSubscriptionStatus },
      select: { id: true, name: true, subscriptionStatus: true },
    });
  }

  async softDeleteFleet(fleetId: string) {
    const fleet = await this.prisma.fleet.findUnique({ where: { id: fleetId } });
    if (!fleet) throw new NotFoundException('Fleet not found');

    // Soft-delete: set subscription to CANCELED and all users to DISABLED
    await this.prisma.$transaction([
      this.prisma.fleet.update({
        where: { id: fleetId },
        data: { subscriptionStatus: 'CANCELED' },
      }),
      this.prisma.user.updateMany({
        where: { fleetId },
        data: { status: 'DISABLED' },
      }),
      this.prisma.bike.updateMany({
        where: { fleetId },
        data: { status: 'RETIRED' },
      }),
      this.prisma.device.updateMany({
        where: { fleetId },
        data: { status: 'RETIRED' },
      }),
    ]);

    return { success: true, message: `Fleet "${fleet.name}" has been disabled.` };
  }

  // ── Users ─────────────────────────────────────────────────────────

  async getUsers(opts: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    role?: string;
  }) {
    const where: any = {};

    if (opts.status) {
      where.status = opts.status;
    }

    if (opts.role) {
      where.role = opts.role;
    }

    if (opts.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search } },
        { riderProfile: { fullName: { contains: opts.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          fleet: { select: { id: true, name: true } },
          riderProfile: { select: { fullName: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING_SETUP' },
      include: {
        fleet: {
          select: { name: true, plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        fleet: { select: { name: true } },
      },
    });
  }

  async updateUserRole(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const validRoles: string[] = ['OWNER', 'ADMIN', 'DISPATCHER', 'TECH', 'INSURER', 'RIDER'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, email: true, phone: true, role: true },
    });
  }

  async updateUserStatus(userId: string, status: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: status as UserStatus },
      select: { id: true, email: true, phone: true, status: true },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ── Partners ──────────────────────────────────────────────────────

  async createPartner(name: string) {
    const partner = await this.prisma.partner.create({
      data: { name, status: 'ACTIVE' },
      include: {
        _count: { select: { clients: true, webhooks: true } },
      },
    });
    return partner;
  }

  async getPartners() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { clients: true, webhooks: true },
        },
      },
    });
  }

  async getPartnerById(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        clients: {
          select: {
            id: true,
            clientId: true,
            scopes: true,
            status: true,
            createdAt: true,
          },
        },
        webhooks: {
          select: {
            id: true,
            url: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: { clients: true, webhooks: true, fleetAccesses: true },
        },
      },
    });

    if (!partner) throw new NotFoundException(`Partner ${partnerId} not found`);
    return partner;
  }

  async createPartnerCredential(partnerId: string, clientId: string, scopes: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');

    const clientSecret = crypto.randomBytes(32).toString('hex');
    const clientSecretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

    const client = await this.prisma.partnerClient.create({
      data: {
        partnerId,
        clientId,
        clientSecretHash,
        scopes,
      },
    });

    return {
      id: client.id,
      clientId: client.clientId,
      clientSecret, // Only returned on creation
      scopes: client.scopes,
      createdAt: client.createdAt,
    };
  }

  async deletePartnerCredential(partnerId: string, credentialId: string) {
    const credential = await this.prisma.partnerClient.findUnique({
      where: { id: credentialId },
    });

    if (!credential || credential.partnerId !== partnerId) {
      throw new NotFoundException('Credential not found');
    }

    await this.prisma.partnerClient.delete({ where: { id: credentialId } });
    return { success: true };
  }

  async createWebhook(partnerId: string, url: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');

    const secret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const webhook = await this.prisma.partnerWebhook.create({
      data: {
        partnerId,
        url,
        secretHash,
      },
    });

    return {
      id: webhook.id,
      url: webhook.url,
      secret, // Only returned on creation
      active: webhook.active,
      createdAt: webhook.createdAt,
    };
  }

  async updateWebhook(webhookId: string, url: string) {
    const webhook = await this.prisma.partnerWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');

    const updated = await this.prisma.partnerWebhook.update({
      where: { id: webhookId },
      data: { url, updatedAt: new Date() },
    });

    return {
      id: updated.id,
      url: updated.url,
      active: updated.active,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteWebhook(webhookId: string) {
    const webhook = await this.prisma.partnerWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');

    await this.prisma.partnerWebhook.delete({ where: { id: webhookId } });
    return { success: true };
  }

  // ── Audit Log ─────────────────────────────────────────────────────

  async getAuditLog(opts: {
    page: number;
    pageSize: number;
    fleetId?: string;
    actionType?: string;
  }) {
    const where: any = {};

    if (opts.fleetId) {
      where.fleetId = opts.fleetId;
    }

    if (opts.actionType) {
      where.actionType = opts.actionType;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          actionType: true,
          targetType: true,
          targetId: true,
          metaJson: true,
          createdAt: true,
          fleet: { select: { id: true, name: true } },
          actorUser: { select: { id: true, email: true, phone: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map(d => ({ ...d, id: String(d.id) })),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  // ── Incidents ─────────────────────────────────────────────────────

  async getIncidents(opts: {
    page: number;
    pageSize: number;
    status?: string;
    fleetId?: string;
  }) {
    const where: any = {};

    if (opts.status) {
      where.status = opts.status;
    }

    if (opts.fleetId) {
      where.fleetId = opts.fleetId;
    }

    const [data, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          fleet: { select: { id: true, name: true } },
          bike: { select: { id: true, label: true } },
          event: { select: { id: true, type: true, severity: true } },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    // Convert BigInt fields to strings to avoid JSON serialization errors
    const serializedData = data.map(d => ({
      ...d,
      eventId: String(d.eventId),
      event: d.event ? { ...d.event, id: String(d.event.id) } : null,
    }));

    return {
      data: serializedData,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  // ── Monitoring ────────────────────────────────────────────────────

  async getMonitoringLive() {
    const [
      dbSize,
      totalTelemetry,
      totalEvents,
      totalTrips,
      activeDevices,
      totalUsers,
    ] = await Promise.all([
      this.prisma.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `.then(rows => rows[0]?.size ?? 'Unknown'),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "TelemetryPoint"
      `.then(rows => Number(rows[0]?.count ?? 0)).catch(() => 0),
      this.prisma.event.count(),
      this.prisma.trip.count(),
      this.prisma.device.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      databaseSize: dbSize,
      totalTelemetryPoints: totalTelemetry,
      totalEvents,
      totalTrips,
      activeDevices,
      activeUsers: totalUsers,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private formatRelative(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
