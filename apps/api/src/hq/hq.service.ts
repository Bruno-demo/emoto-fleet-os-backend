import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UserStatus,
  UserRole,
  FleetPlan,
  FleetSubscriptionStatus,
  BikeStatus,
  Prisma,
  AuditActionType,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  encryptDeviceSecret,
  hashDeviceSecret,
} from '../crypto/device-secret.crypto';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class HqService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
  ) {}

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
      totalInsurers,
      unassignedDevices,
    ] = await Promise.all([
      this.prisma.fleet.count({ where: { plan: { not: 'INSURANCE' } } }),
      this.prisma.bike.count(),
      this.prisma.user.count({ where: { role: 'RIDER' } }),
      this.prisma.device.count(),
      this.prisma.user.count({ where: { status: 'PENDING_SETUP' } }),
      this.prisma.partner.count(),
      this.prisma.incident.count(),
      this.prisma.incident.count({ where: { status: 'OPEN' } }),
      this.prisma.user.count({ where: { role: 'INSURER' } }),
      this.prisma.device.count({ where: { bikeId: null, status: 'ACTIVE' } }),
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const trips = await this.prisma.trip.findMany({
      where: {
        startTs: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        startTs: true,
      },
    });

    const dailyMap = new Map<string, number>();
    for (const trip of trips) {
      const dateKey = trip.startTs.toISOString().slice(5, 10);
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1);
    }

    const dailyTripTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(5, 10);
      dailyTripTrend.push({
        date: dateKey,
        count: dailyMap.get(dateKey) ?? 0,
      });
    }

    return {
      totalFleets,
      totalBikes,
      totalRiders,
      totalDevices,
      totalPendingSetups,
      totalPartners,
      totalIncidents,
      openIncidents,
      totalInsurers,
      unassignedDevices,
      dailyTripTrend,
    };
  }

  async getHealth() {
    const [dbOk] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    ]);

    return [
      {
        label: 'EMQX Cluster',
        status: 'Operational',
        color: 'text-emerald-400',
      },
      { label: 'Core API', status: 'Healthy', color: 'text-emerald-400' },
      {
        label: 'Telemetry Engine',
        status: 'Nominal',
        color: 'text-emerald-400',
      },
      {
        label: 'Database Layer',
        status: dbOk ? 'Hypertable Active' : 'Degraded',
        color: dbOk ? 'text-sky-400' : 'text-rose-400',
      },
    ];
  }

  async getEvents() {
    const [fleets, users] = await Promise.all([
      this.prisma.fleet.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          fleet: { select: { id: true, name: true } },
        },
      }),
    ]);

    const events = [
      ...fleets.map((f) => ({
        fleet: f.name,
        event: 'New Fleet Provisioned',
        time: this.formatRelative(f.createdAt),
        type: 'success',
      })),
      ...users.map((u) => ({
        fleet: u.fleet?.name ?? 'Unknown',
        event: 'Operator Account Activated',
        time: this.formatRelative(u.createdAt),
        type: 'info',
      })),
    ]
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 8);

    return events;
  }

  // ── Fleets ────────────────────────────────────────────────────────

  async getFleets() {
    try {
      return await this.prisma.fleet.findMany({
        where: { plan: { not: FleetPlan.INSURANCE } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          plan: true,
          insurerName: true,
          subscriptionStatus: true,
          installationPaid: true,
          upgradeRequested: true,
          upgradeRequestedAt: true,
          monthlyRatePerBike: true,
          bikeRange: true,
          createdAt: true,
          trialStartedAt: true,
          trialEndsAt: true,
          billingStartedAt: true,
          momoPhoneNumber: true,
          autoPayEnabled: true,
          _count: {
            select: { users: true, bikes: true },
          },
        },
      });
    } catch (error) {
      console.error('[HqService.getFleets] Failed to query fleets:', error);
      throw error;
    }
  }

  async getFleetById(fleetId: string) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            updatedAt: true,
            riderProfile: {
              select: {
                fullName: true,
                licenceNumber: true,
                identityNumber: true,
                passportPhoto: true,
                licencePhoto: true,
                identityCardPhoto: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        bikes: {
          select: {
            id: true,
            label: true,
            plate: true,
            serial: true,
            model: true,
            status: true,
            type: true,
            imageUrl: true,
            updatedAt: true,
            devices: {
              select: {
                id: true,
                deviceUid: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: {
            users: true,
            bikes: true,
            events: true,
            trips: true,
            devices: true,
            incidents: true,
          },
        },
      },
    });

    if (!fleet) throw new NotFoundException(`Fleet ${fleetId} not found`);

    const bikesWithLockState = await Promise.all(
      fleet.bikes.map(async (bike) => {
        if (!bike.devices || bike.devices.length === 0) {
          return {
            ...bike,
            lockState: 'UNLOCKED' as const,
          };
        }

        const lastCommand = await this.prisma.deviceCommand.findFirst({
          where: {
            deviceId: { in: bike.devices.map((d) => d.id) },
            type: { in: ['LOCK', 'UNLOCK'] },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        let lockState: 'LOCKED' | 'UNLOCKED' | 'LOCKING' | 'UNLOCKING' =
          'UNLOCKED';
        if (lastCommand) {
          if (lastCommand.type === 'LOCK') {
            if (lastCommand.status === 'ACKED') {
              lockState = 'LOCKED';
            } else if (
              lastCommand.status === 'PENDING' ||
              lastCommand.status === 'SENT'
            ) {
              lockState = 'LOCKING';
            } else {
              lockState = 'UNLOCKED';
            }
          } else if (lastCommand.type === 'UNLOCK') {
            if (lastCommand.status === 'ACKED') {
              lockState = 'UNLOCKED';
            } else if (
              lastCommand.status === 'PENDING' ||
              lastCommand.status === 'SENT'
            ) {
              lockState = 'UNLOCKING';
            } else {
              lockState = 'LOCKED';
            }
          }
        }

        return {
          ...bike,
          lockState,
        };
      }),
    );

    return {
      ...fleet,
      bikes: bikesWithLockState,
    };
  }

  async updateFleetPlan(
    fleetId: string,
    plan: string,
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (!['DEMO', 'PREMIUM'].includes(plan)) {
      throw new BadRequestException('Invalid plan. Must be DEMO or PREMIUM');
    }

    const tier = await this.prisma.pricingTier.findUnique({
      where: { planCode: plan as FleetPlan },
    });
    const monthlyRatePerBike = tier
      ? tier.monthlyRatePerBike
      : plan === 'PREMIUM'
        ? 10000
        : 5000;

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        plan: plan as FleetPlan,
        monthlyRatePerBike,
      },
      select: { id: true, name: true, plan: true },
    });

    this.eventsGateway.emitFleetUpdated(fleetId, { plan: updated.plan });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        oldPlan: fleet.plan,
        newPlan: plan,
      },
    });

    return updated;
  }

  async updateFleetType(
    fleetId: string,
    type: 'COOP' | 'DELIVERY',
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (!['COOP', 'DELIVERY'].includes(type)) {
      throw new BadRequestException(
        'Invalid fleet type. Must be COOP or DELIVERY',
      );
    }

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        type: type as FleetType,
      },
      select: { id: true, name: true, type: true },
    });

    this.eventsGateway.emitFleetUpdated(fleetId, { type: updated.type });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        oldType: fleet.type,
        newType: type,
      },
    });

    return updated;
  }

  async updateFleetSubscription(
    fleetId: string,
    status: string,
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (!['ACTIVE', 'PAST_DUE', 'CANCELED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: { subscriptionStatus: status as FleetSubscriptionStatus },
      select: { id: true, name: true, subscriptionStatus: true },
    });

    this.eventsGateway.emitFleetUpdated(fleetId, {
      subscriptionStatus: updated.subscriptionStatus,
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_SUBSCRIPTION_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        oldStatus: fleet.subscriptionStatus,
        newStatus: status,
      },
    });

    return updated;
  }

  async softDeleteFleet(fleetId: string, actor: AuthenticatedUser) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
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

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_DELETED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        softDelete: true,
      },
    });

    return {
      success: true,
      message: `Fleet "${fleet.name}" has been disabled.`,
    };
  }

  async permanentDeleteFleet(fleetId: string, actor: AuthenticatedUser) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_DELETED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        permanentDelete: true,
        name: fleet.name,
      },
    });

    // Use a transaction to delete dependent records that may lack DB-level cascades
    await this.prisma.$transaction(async (tx) => {
      // Delete billing payments first (references billingCycle + fleet)
      await tx.billingPayment.deleteMany({ where: { fleetId } });
      // Delete billing cycles (references fleet)
      await tx.billingCycle.deleteMany({ where: { fleetId } });
      // Nullify fleet reference on discounts (optional FK)
      await tx.discount.updateMany({
        where: { fleetId },
        data: { fleetId: null },
      });
      // Delete the fleet itself (cascades to users, bikes, devices, events, etc.)
      await tx.fleet.delete({ where: { id: fleetId } });
    });

    return {
      success: true,
      message: `Fleet "${fleet.name}" has been permanently deleted.`,
    };
  }

  async updateBikeStatus(
    bikeId: string,
    status: string,
    actor: AuthenticatedUser,
  ) {
    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike) throw new NotFoundException('Bike not found');

    if (!['ACTIVE', 'MAINTENANCE', 'RETIRED'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const updated = await this.prisma.bike.update({
      where: { id: bikeId },
      data: { status: status as BikeStatus },
      select: { id: true, label: true, status: true },
    });

    await this.auditService.createAuditLog({
      fleetId: bike.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.BIKE_STATUS_CHANGED,
      targetType: 'BIKE',
      targetId: bikeId,
      metaJson: {
        oldStatus: bike.status,
        newStatus: status,
      },
    });

    return updated;
  }

  // ── Users ─────────────────────────────────────────────────────────

  async getUsers(opts: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    role?: string;
  }) {
    const where: Prisma.UserWhereInput = {};

    if (opts.status) {
      where.status = opts.status as UserStatus;
    }

    if (opts.role) {
      where.role = opts.role as UserRole;
    }

    if (opts.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search } },
        {
          riderProfile: {
            fullName: { contains: opts.search, mode: 'insensitive' },
          },
        },
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
          riderProfile: {
            select: {
              fullName: true,
              licenceNumber: true,
              identityNumber: true,
              passportPhoto: true,
              licencePhoto: true,
              identityCardPhoto: true,
              leaseToOwn: true,
              leasePrincipal: true,
              leaseDailyRate: true,
            },
          },
          bikeAssignments: {
            where: { active: true },
            select: {
              id: true,
              bikeId: true,
              bike: {
                select: {
                  id: true,
                  label: true,
                  status: true,
                },
              },
            },
          },
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

  async getPendingBikes() {
    return this.prisma.bike.findMany({
      where: {
        devices: {
          none: {},
        },
      },
      include: {
        fleet: {
          select: { name: true, plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingSetupsCount() {
    const [pendingUsers, pendingBikes] = await Promise.all([
      this.prisma.user.count({ where: { status: 'PENDING_SETUP' } }),
      this.prisma.bike.count({ where: { devices: { none: {} } } }),
    ]);
    return { pendingUsers, pendingBikes };
  }

  async activateUser(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
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

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: userId,
      metaJson: {
        activated: true,
        email: user.email,
        phone: user.phone,
      },
    });

    return updated;
  }

  async updateUserRole(userId: string, role: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const validRoles: string[] = [
      'OWNER',
      'ADMIN',
      'DISPATCHER',
      'TECH',
      'INSURER',
      'RIDER',
    ];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, email: true, phone: true, role: true },
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: userId,
      metaJson: {
        oldRole: user.role,
        newRole: role,
        email: user.email,
        phone: user.phone,
      },
    });

    return updated;
  }

  async updateUserStatus(
    userId: string,
    status: string,
    actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: status as UserStatus },
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          role: true,
        },
      });

      if (user.role === 'INSURER') {
        const partnerExists = await tx.partner.findUnique({
          where: { id: userId },
        });
        if (partnerExists) {
          await tx.partner.update({
            where: { id: userId },
            data: { status: status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED' },
          });
        }
      }

      return updated;
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: userId,
      metaJson: {
        oldStatus: user.status,
        newStatus: status,
        email: user.email,
        phone: user.phone,
      },
    });

    return updatedUser;
  }

  async deleteUser(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      if (user.role === 'INSURER') {
        const partnerExists = await tx.partner.findUnique({
          where: { id: userId },
        });
        if (partnerExists) {
          await tx.partner.delete({ where: { id: userId } });
        }
      }
      await tx.user.delete({ where: { id: userId } });
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: userId,
      metaJson: {
        deleted: true,
        email: user.email,
        phone: user.phone,
      },
    });

    return { success: true };
  }

  // ── Partners ──────────────────────────────────────────────────────

  async createPartner(name: string, actor: AuthenticatedUser) {
    const partner = await this.prisma.partner.create({
      data: { name, status: 'ACTIVE' },
      include: {
        _count: { select: { clients: true, webhooks: true } },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_CREATED,
      targetType: 'PARTNER',
      targetId: partner.id,
      metaJson: { name },
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

  async createPartnerCredential(
    partnerId: string,
    clientId: string,
    scopes: string,
    actor: AuthenticatedUser,
  ) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) throw new NotFoundException('Partner not found');

    const clientSecret = crypto.randomBytes(32).toString('hex');
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    const client = await this.prisma.partnerClient.create({
      data: {
        partnerId,
        clientId,
        clientSecretHash,
        scopes,
      },
    });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_TOKEN_ISSUED,
      targetType: 'PARTNER_CLIENT',
      targetId: client.id,
      metaJson: { clientId, scopes },
    });

    return {
      id: client.id,
      clientId: client.clientId,
      clientSecret, // Only returned on creation
      scopes: client.scopes,
      createdAt: client.createdAt,
    };
  }

  async permanentDeletePartner(partnerId: string, actor: AuthenticatedUser) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) throw new NotFoundException('Partner not found');

    // All child records (PartnerClient, PartnerFleetAccess, PartnerWebhook) have onDelete: Cascade
    await this.prisma.partner.delete({ where: { id: partnerId } });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_DELETED,
      targetType: 'PARTNER',
      targetId: partnerId,
      metaJson: {
        permanentDelete: true,
        name: partner.name,
      },
    });

    return {
      success: true,
      message: `Partner "${partner.name}" has been permanently deleted.`,
    };
  }

  async permanentDeleteInsurer(insurerId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: insurerId },
      include: { fleet: true, riderProfile: true },
    });
    if (!user) throw new NotFoundException('Insurer not found');
    if (user.role !== 'INSURER')
      throw new BadRequestException('User is not an insurer');

    // Clear insurerName from any bikes this insurer covers
    if (user.fleet?.insurerName) {
      await this.prisma.bike.updateMany({
        where: { insurerName: user.fleet.insurerName },
        data: { insurerName: null },
      });
    }

    if (user.fleetId) {
      await this.prisma.fleet.delete({ where: { id: user.fleetId } });
    } else {
      await this.prisma.user.delete({ where: { id: insurerId } });
    }

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.INSURER_DELETED,
      targetType: 'USER',
      targetId: insurerId,
      metaJson: {
        permanentDelete: true,
        email: user.email,
        phone: user.phone,
        role: 'INSURER',
        name: user.riderProfile?.fullName ?? user.email,
      },
    });

    return {
      success: true,
      message: `Insurer has been permanently deleted.`,
    };
  }

  async permanentDeleteDevice(deviceId: string, actor: AuthenticatedUser) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Device not found');

    await this.prisma.device.delete({ where: { id: deviceId } });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DEVICE_DELETED,
      targetType: 'DEVICE',
      targetId: deviceId,
      metaJson: {
        permanentDelete: true,
        deviceUid: device.deviceUid,
        imei: device.imei,
      },
    });

    return {
      success: true,
      message: `Device "${device.deviceUid}" has been permanently deleted.`,
    };
  }

  async deletePartnerCredential(
    partnerId: string,
    credentialId: string,
    actor: AuthenticatedUser,
  ) {
    const credential = await this.prisma.partnerClient.findUnique({
      where: { id: credentialId },
    });

    if (!credential || credential.partnerId !== partnerId) {
      throw new NotFoundException('Credential not found');
    }

    await this.prisma.partnerClient.delete({ where: { id: credentialId } });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_TOKEN_ISSUED,
      targetType: 'PARTNER_CLIENT',
      targetId: credentialId,
      metaJson: { clientId: credential.clientId, revoked: true },
    });

    return { success: true };
  }

  async createWebhook(
    partnerId: string,
    url: string,
    actor: AuthenticatedUser,
  ) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
    });
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

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_WEBHOOK_REGISTERED,
      targetType: 'PARTNER_WEBHOOK',
      targetId: webhook.id,
      metaJson: { url },
    });

    return {
      id: webhook.id,
      url: webhook.url,
      secret, // Only returned on creation
      active: webhook.active,
      createdAt: webhook.createdAt,
    };
  }

  async updateWebhook(
    webhookId: string,
    url: string,
    actor: AuthenticatedUser,
  ) {
    const webhook = await this.prisma.partnerWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');

    const updated = await this.prisma.partnerWebhook.update({
      where: { id: webhookId },
      data: { url, updatedAt: new Date() },
    });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_WEBHOOK_REGISTERED,
      targetType: 'PARTNER_WEBHOOK',
      targetId: webhookId,
      metaJson: { oldUrl: webhook.url, newUrl: url, updated: true },
    });

    return {
      id: updated.id,
      url: updated.url,
      active: updated.active,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteWebhook(webhookId: string, actor: AuthenticatedUser) {
    const webhook = await this.prisma.partnerWebhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');

    await this.prisma.partnerWebhook.delete({ where: { id: webhookId } });

    await this.auditService.createAuditLog({
      fleetId: actor.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.PARTNER_WEBHOOK_REGISTERED,
      targetType: 'PARTNER_WEBHOOK',
      targetId: webhookId,
      metaJson: { url: webhook.url, deleted: true },
    });

    return { success: true };
  }

  // ── Audit Log ─────────────────────────────────────────────────────

  async getAuditLog(opts: {
    page: number;
    pageSize: number;
    fleetId?: string;
    actionType?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};

    if (opts.fleetId) {
      where.fleetId = opts.fleetId;
    }

    if (opts.actionType) {
      where.actionType =
        opts.actionType as Prisma.AuditLogWhereInput['actionType'];
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
      data: data.map((d) => ({ ...d, id: String(d.id) })),
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
    const where: Prisma.IncidentWhereInput = {};

    if (opts.status) {
      where.status = opts.status as Prisma.IncidentWhereInput['status'];
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
    const serializedData = data.map((d) => ({
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
      telemetryDays,
      auditDays,
    ] = await Promise.all([
      this.prisma.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `.then((rows) => rows[0]?.size ?? 'Unknown'),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "TelemetryPoint"
      `
        .then((rows) => Number(rows[0]?.count ?? 0))
        .catch(() => 0),
      this.prisma.event.count(),
      this.prisma.trip.count(),
      this.prisma.device.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.$queryRaw<Array<{ day: Date; active_hours: bigint }>>`
        SELECT date_trunc('day', ts) as day, count(distinct date_trunc('hour', ts)) as active_hours
        FROM "TelemetryPoint"
        WHERE ts > now() - interval '30 days'
        GROUP BY day
      `.catch(() => []),
      this.prisma.$queryRaw<Array<{ day: Date; active_hours: bigint }>>`
        SELECT date_trunc('day', "createdAt") as day, count(distinct date_trunc('hour', "createdAt")) as active_hours
        FROM "AuditLog"
        WHERE "createdAt" > now() - interval '30 days'
        GROUP BY day
      `.catch(() => []),
    ]);

    const dailyUptime: number[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const targetDateStr = targetDate.toISOString().slice(0, 10);

      const telemetryMatch = telemetryDays.find(
        (t) => new Date(t.day).toISOString().slice(0, 10) === targetDateStr,
      );
      const telemetryHours = telemetryMatch
        ? Number(telemetryMatch.active_hours)
        : 0;

      const auditMatch = auditDays.find(
        (a) => new Date(a.day).toISOString().slice(0, 10) === targetDateStr,
      );
      const auditHours = auditMatch ? Number(auditMatch.active_hours) : 0;

      const maxActiveHours = Math.max(telemetryHours, auditHours);

      // If active hours exist, scale from 95% to 100%. If idle, default to 99.9% uptime.
      let uptime = 99.9;
      if (maxActiveHours > 0) {
        uptime = 95.0 + (maxActiveHours / 24) * 5.0;
      }

      dailyUptime.push(Number(uptime.toFixed(2)));
    }

    return {
      databaseSize: dbSize,
      totalTelemetryPoints: totalTelemetry,
      totalEvents,
      totalTrips,
      activeDevices,
      activeUsers: totalUsers,
      uptimeSeconds: Math.floor(process.uptime()),
      dailyUptime,
    };
  }

  // ── Devices ────────────────────────────────────────────────────────

  async getDevices(opts: {
    page: number;
    pageSize: number;
    fleetId?: string;
    status?: string;
    assigned?: string;
  }) {
    const where: Prisma.DeviceWhereInput = {};

    if (opts.fleetId) {
      where.fleetId = opts.fleetId;
    }

    if (opts.status) {
      where.status = opts.status as Prisma.DeviceWhereInput['status'];
    }

    if (opts.assigned === 'true') {
      where.bikeId = { not: null };
    } else if (opts.assigned === 'false') {
      where.bikeId = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          bike: {
            select: { id: true, label: true, plate: true, status: true },
          },
          fleet: { select: { id: true, name: true } },
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  async assignBikeToDevice(
    deviceId: string,
    bikeId: string,
    actor: AuthenticatedUser,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Device not found');

    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike) throw new NotFoundException('Bike not found');

    if (device.fleetId !== bike.fleetId) {
      throw new BadRequestException(
        'Device and bike must belong to the same fleet',
      );
    }

    const existingDevice = await this.prisma.device.findFirst({
      where: {
        bikeId,
        id: { not: deviceId },
      },
    });
    if (existingDevice) {
      throw new ConflictException('Bike is already assigned to another device');
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: { bikeId },
      include: {
        bike: { select: { id: true, label: true, plate: true, status: true } },
        fleet: { select: { id: true, name: true } },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: device.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DEVICE_BIKE_ASSIGNMENT_CHANGED,
      targetType: 'DEVICE',
      targetId: deviceId,
      metaJson: { bikeId },
    });

    return updated;
  }

  async unassignBikeFromDevice(deviceId: string, actor: AuthenticatedUser) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) throw new NotFoundException('Device not found');

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: { bikeId: null },
      include: {
        bike: { select: { id: true, label: true, plate: true, status: true } },
        fleet: { select: { id: true, name: true } },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: device.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DEVICE_BIKE_ASSIGNMENT_CHANGED,
      targetType: 'DEVICE',
      targetId: deviceId,
      metaJson: { bikeId: null },
    });

    return updated;
  }

  async createDevice(
    body: {
      deviceUid: string;
      imei?: string;
      fleetId: string;
    },
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: body.fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    const masterKey = process.env.DEVICE_SECRET_MASTER_KEY;
    if (!masterKey) {
      throw new Error('DEVICE_SECRET_MASTER_KEY is not defined in environment');
    }

    const deviceSecret = crypto.randomBytes(32).toString('base64url');
    const secretHash = hashDeviceSecret(deviceSecret);
    const secretEncrypted = encryptDeviceSecret(deviceSecret, masterKey);

    try {
      const device = await this.prisma.device.create({
        data: {
          fleetId: body.fleetId,
          deviceUid: body.deviceUid,
          imei: body.imei || null,
          secretHash,
          secretEncrypted,
          status: 'ACTIVE',
        },
        include: {
          bike: {
            select: { id: true, label: true, plate: true, status: true },
          },
          fleet: { select: { id: true, name: true } },
        },
      });

      await this.auditService.createAuditLog({
        fleetId: body.fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.DEVICE_CREATED,
        targetType: 'DEVICE',
        targetId: device.id,
        metaJson: { deviceUid: body.deviceUid, imei: body.imei },
      });

      return {
        device,
        deviceSecret,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('deviceUid or imei already exists');
      }
      throw error;
    }
  }

  async rotateDeviceSecret(deviceId: string, actor: AuthenticatedUser) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, deviceUid: true, fleetId: true },
    });
    if (!device) throw new NotFoundException('Device not found');

    const masterKey = process.env.DEVICE_SECRET_MASTER_KEY;
    if (!masterKey) {
      throw new Error('DEVICE_SECRET_MASTER_KEY is not defined in environment');
    }

    const deviceSecret = crypto.randomBytes(32).toString('base64url');
    const secretHash = hashDeviceSecret(deviceSecret);
    const secretEncrypted = encryptDeviceSecret(deviceSecret, masterKey);

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        secretHash,
        secretEncrypted,
      },
    });

    await this.auditService.createAuditLog({
      fleetId: device.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DEVICE_SECRET_ROTATED,
      targetType: 'DEVICE',
      targetId: deviceId,
      metaJson: { deviceUid: device.deviceUid },
    });

    return {
      deviceId: device.id,
      deviceUid: device.deviceUid,
      deviceSecret,
    };
  }

  // ── Insurers ──────────────────────────────────────────────────────

  async getInsurers(opts: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.UserWhereInput = { role: UserRole.INSURER };

    if (opts.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { phone: { contains: opts.search } },
        {
          riderProfile: {
            fullName: { contains: opts.search, mode: 'insensitive' },
          },
        },
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
          fleet: { select: { id: true, name: true, insurerName: true } },
          riderProfile: { select: { fullName: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const insurerNames = data
      .map((u) => u.fleet?.insurerName)
      .filter((name): name is string => !!name);

    const bikes = insurerNames.length
      ? await this.prisma.bike.findMany({
          where: {
            insurerName: { in: insurerNames },
          },
          select: {
            id: true,
            label: true,
            plate: true,
            status: true,
            insurerName: true,
          },
        })
      : [];

    const bikesMap = new Map<string, typeof bikes>();
    for (const b of bikes) {
      if (b.insurerName) {
        const list = bikesMap.get(b.insurerName) ?? [];
        list.push(b);
        bikesMap.set(b.insurerName, list);
      }
    }

    const mappedData = data.map((insurer) => {
      const insurerName = insurer.fleet?.insurerName;
      const assignedBikes = insurerName
        ? (bikesMap.get(insurerName) ?? [])
        : [];
      return {
        id: insurer.id,
        email: insurer.email,
        phone: insurer.phone,
        role: insurer.role,
        status: insurer.status,
        createdAt: insurer.createdAt,
        fleet: insurer.fleet,
        riderProfile: insurer.riderProfile,
        assignedBikes,
        _count: {
          assignedBikes: assignedBikes.length,
        },
      };
    });

    return {
      data: mappedData,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  async getInsurerById(insurerId: string) {
    const insurer = await this.prisma.user.findUnique({
      where: { id: insurerId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        fleetId: true,
        fleet: { select: { id: true, name: true, insurerName: true } },
        riderProfile: { select: { fullName: true } },
      },
    });

    if (!insurer) throw new NotFoundException('Insurer not found');
    if (insurer.role !== 'INSURER')
      throw new BadRequestException('User is not an insurer');

    const insurerName = insurer.fleet?.insurerName;
    const insuredBikes = insurerName
      ? await this.prisma.bike.findMany({
          where: { insurerName },
          select: {
            id: true,
            label: true,
            plate: true,
            status: true,
            fleet: { select: { name: true } },
          },
        })
      : [];

    return {
      id: insurer.id,
      email: insurer.email,
      phone: insurer.phone,
      role: insurer.role,
      status: insurer.status,
      createdAt: insurer.createdAt,
      fleetId: insurer.fleetId,
      fleet: insurer.fleet,
      riderProfile: insurer.riderProfile,
      insuredBikes,
    };
  }

  async createInsurer(
    body: {
      email?: string;
      phone?: string;
      password: string;
      fullName: string;
      fleetId: string;
    },
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: body.fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      // Ensure the fleet is updated to have the INSURANCE plan and insurerName
      const tier = await tx.pricingTier.findUnique({
        where: { planCode: 'INSURANCE' },
      });
      const monthlyRatePerBike = tier ? tier.monthlyRatePerBike : 0;

      await tx.fleet.update({
        where: { id: body.fleetId },
        data: {
          plan: 'INSURANCE',
          insurerName: body.fullName,
          monthlyRatePerBike,
        },
      });

      const u = await tx.user.create({
        data: {
          email: body.email,
          phone: body.phone,
          passwordHash: hashedPassword,
          role: 'INSURER',
          status: 'ACTIVE',
          fleetId: body.fleetId,
          riderProfile: {
            create: {
              fullName: body.fullName,
            },
          },
        },
        include: {
          fleet: { select: { id: true, name: true } },
          riderProfile: { select: { fullName: true } },
        },
      });

      // Synchronize creation with a matching Partner record using the same UUID
      await tx.partner.create({
        data: {
          id: u.id,
          name: body.fullName,
          status: 'ACTIVE',
        },
      });

      // Grant fleet access to this partner
      await tx.partnerFleetAccess.create({
        data: {
          partnerId: u.id,
          fleetId: body.fleetId,
          active: true,
        },
      });

      // Provision a default API client credential for this partner
      const clientId = `client_${u.id.slice(0, 8)}`;
      const clientSecret = crypto.randomBytes(16).toString('hex');
      const clientSecretHash = await bcrypt.hash(clientSecret, 10);

      await tx.partnerClient.create({
        data: {
          partnerId: u.id,
          clientId,
          clientSecretHash,
          scopes: 'insurer:read webhooks:write',
          status: 'ACTIVE',
        },
      });

      return u;
    });

    await this.auditService.createAuditLog({
      fleetId: body.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_INVITED,
      targetType: 'USER',
      targetId: user.id,
      metaJson: { email: body.email, role: 'INSURER' },
    });

    await this.auditService.createAuditLog({
      fleetId: body.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: body.fleetId,
      metaJson: { oldPlan: fleet.plan, newPlan: 'INSURANCE' },
    });

    return user;
  }

  async assignBikeToInsurer(
    insurerId: string,
    bikeId: string,
    actor: AuthenticatedUser,
  ) {
    const insurer = await this.prisma.user.findUnique({
      where: { id: insurerId },
      include: { fleet: true },
    });
    if (!insurer) throw new NotFoundException('Insurer not found');
    if (insurer.role !== 'INSURER')
      throw new BadRequestException('User is not an insurer');

    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike) throw new NotFoundException('Bike not found');

    const updated = await this.prisma.bike.update({
      where: { id: bikeId },
      data: { insurerName: insurer.fleet?.insurerName },
      include: {
        fleet: { select: { id: true, name: true } },
      },
    });

    await this.auditService.createAuditLog({
      fleetId: bike.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.BIKE_ASSIGNMENT_CHANGED,
      targetType: 'BIKE',
      targetId: bikeId,
      metaJson: { insurerId, insurerName: insurer.fleet?.insurerName },
    });

    return updated;
  }

  async unassignBikeFromInsurer(
    insurerId: string,
    bikeId: string,
    actor: AuthenticatedUser,
  ) {
    const insurer = await this.prisma.user.findUnique({
      where: { id: insurerId },
      include: { fleet: true },
    });
    if (!insurer) throw new NotFoundException('Insurer not found');

    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId } });
    if (!bike) throw new NotFoundException('Bike not found');

    if (bike.insurerName !== insurer.fleet?.insurerName) {
      throw new BadRequestException('Bike is not assigned to this insurer');
    }

    await this.prisma.bike.update({
      where: { id: bikeId },
      data: { insurerName: null },
    });

    await this.auditService.createAuditLog({
      fleetId: bike.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.BIKE_ASSIGNMENT_CHANGED,
      targetType: 'BIKE',
      targetId: bikeId,
      metaJson: { insurerId, insurerName: null },
    });

    return { success: true };
  }

  // ── Telemetry Events ────────────────────────────────────────────

  async getTelemetryEvents(opts: {
    page: number;
    pageSize: number;
    fleetId?: string;
    type?: string;
    severity?: string;
  }) {
    const where: Prisma.EventWhereInput = {};

    if (opts.fleetId) {
      where.fleetId = opts.fleetId;
    }

    if (opts.type) {
      where.type = opts.type as Prisma.EventWhereInput['type'];
    }

    if (opts.severity) {
      where.severity = opts.severity as Prisma.EventWhereInput['severity'];
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        orderBy: { ts: 'desc' },
        include: {
          fleet: { select: { id: true, name: true } },
          bike: { select: { id: true, label: true } },
          device: { select: { id: true, deviceUid: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    // Convert BigInt IDs to strings for JSON serialization
    const serializedData = data.map((e) => ({
      ...e,
      id: String(e.id),
    }));

    return {
      data: serializedData,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  // ── HQ Node CRUD Actions ──────────────────────────────────────────

  async createBikeForFleet(
    fleetId: string,
    dto: {
      label: string;
      plate?: string;
      serial?: string;
      model?: string;
      status?: BikeStatus;
      type?: string;
      imageUrl?: string;
      leaseToOwn?: boolean;
    },
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    try {
      const bike = await this.prisma.$transaction(async (tx) => {
        const b = await tx.bike.create({
          data: {
            fleetId,
            label: dto.label,
            plate: dto.plate || null,
            serial: dto.serial || null,
            model: dto.model || null,
            status: dto.status ?? 'ACTIVE',
            type: dto.type || null,
            imageUrl: dto.imageUrl || null,
            leaseToOwn: dto.leaseToOwn ?? false,
          },
        });

        // If this is a PERSONAL fleet, automatically assign the bike to the rider(s) in the fleet!
        if (fleet.type === 'PERSONAL') {
          const rider = await tx.user.findFirst({
            where: { fleetId, role: 'RIDER' },
          });
          if (rider) {
            // Deactivate any existing active assignments
            await tx.bikeAssignment.updateMany({
              where: { fleetId, riderUserId: rider.id, active: true },
              data: { active: false, unassignedAt: new Date() },
            });

            // Create new assignment
            await tx.bikeAssignment.create({
              data: {
                fleetId,
                bikeId: b.id,
                riderUserId: rider.id,
                active: true,
              },
            });
          }
        }

        return b;
      });

      await this.auditService.createAuditLog({
        fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.BIKE_CREATED,
        targetType: 'BIKE',
        targetId: bike.id,
        metaJson: {
          label: dto.label,
          plate: dto.plate,
          serial: dto.serial,
          model: dto.model,
        },
      });

      return bike;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Bike label, plate, or serial already exists',
        );
      }
      throw error;
    }
  }

  async updateBikeHq(
    id: string,
    dto: {
      label?: string;
      plate?: string;
      serial?: string;
      model?: string;
      status?: BikeStatus;
      type?: string;
      imageUrl?: string;
      leaseToOwn?: boolean;
    },
    actor: AuthenticatedUser,
  ) {
    const bike = await this.prisma.bike.findUnique({ where: { id } });
    if (!bike) throw new NotFoundException('Bike not found');

    try {
      const updated = await this.prisma.bike.update({
        where: { id },
        data: {
          label: dto.label,
          plate: dto.plate !== undefined ? dto.plate || null : undefined,
          serial: dto.serial !== undefined ? dto.serial || null : undefined,
          model: dto.model !== undefined ? dto.model || null : undefined,
          status: dto.status,
          type: dto.type !== undefined ? dto.type || null : undefined,
          imageUrl:
            dto.imageUrl !== undefined ? dto.imageUrl || null : undefined,
          leaseToOwn: dto.leaseToOwn,
        },
      });

      await this.auditService.createAuditLog({
        fleetId: bike.fleetId,
        actorUserId: actor.id,
        actionType: AuditActionType.BIKE_UPDATED,
        targetType: 'BIKE',
        targetId: id,
        metaJson: {
          changes: dto,
        },
      });

      return updated;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Bike label, plate, or serial already exists',
        );
      }
      throw error;
    }
  }

  async deleteBikeHq(id: string, actor: AuthenticatedUser) {
    const bike = await this.prisma.bike.findUnique({ where: { id } });
    if (!bike) throw new NotFoundException('Bike not found');

    await this.prisma.bike.delete({ where: { id } });

    await this.auditService.createAuditLog({
      fleetId: bike.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.BIKE_DELETED,
      targetType: 'BIKE',
      targetId: id,
      metaJson: {
        label: bike.label,
        plate: bike.plate,
        serial: bike.serial,
      },
    });

    return { success: true };
  }

  async createUserForFleet(
    fleetId: string,
    body: {
      email?: string;
      phone?: string;
      role: UserRole;
      status?: UserStatus;
      password?: string;
      fullName?: string;
      licenceNumber?: string;
      identityNumber?: string;
      passportPhoto?: string;
      licencePhoto?: string;
      identityCardPhoto?: string;
      leaseToOwn?: boolean;
      leasePrincipal?: number;
      leaseDailyRate?: number;
    },
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    const normalizedEmail = body.email?.toLowerCase();
    if (normalizedEmail) {
      const existing = await this.prisma.user.findFirst({
        where: { fleetId, email: normalizedEmail },
      });
      if (existing) {
        throw new BadRequestException('Email already exists in this fleet');
      }
    }
    if (body.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { fleetId, phone: body.phone },
      });
      if (existing) {
        throw new BadRequestException(
          'Phone number already exists in this fleet',
        );
      }
    }

    const passwordHash = body.password
      ? await bcrypt.hash(body.password, 10)
      : await bcrypt.hash('DefaultPass123!', 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          fleetId,
          email: normalizedEmail || null,
          phone: body.phone || null,
          role: body.role,
          status: body.status ?? 'ACTIVE',
          passwordHash,
        },
      });

      if (
        body.fullName ||
        body.licenceNumber ||
        body.identityNumber ||
        body.passportPhoto ||
        body.licencePhoto ||
        body.identityCardPhoto ||
        body.leaseToOwn !== undefined ||
        body.leasePrincipal !== undefined ||
        body.leaseDailyRate !== undefined
      ) {
        await tx.riderProfile.create({
          data: {
            userId: u.id,
            fullName: body.fullName || 'Operator',
            licenceNumber: body.licenceNumber || null,
            identityNumber: body.identityNumber || null,
            passportPhoto: body.passportPhoto || null,
            licencePhoto: body.licencePhoto || null,
            identityCardPhoto: body.identityCardPhoto || null,
            leaseToOwn: body.leaseToOwn ?? false,
            leasePrincipal: body.leasePrincipal ?? 2500000,
            leaseDailyRate: body.leaseDailyRate ?? 15000,
          },
        });
      }

      return {
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
      };
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType:
        body.role === 'RIDER'
          ? AuditActionType.RIDER_CREATED
          : AuditActionType.USER_INVITED,
      targetType: 'USER',
      targetId: result.id,
      metaJson: {
        email: result.email,
        phone: result.phone,
        role: result.role,
        fullName: body.fullName,
      },
    });

    return result;
  }

  async updateUserHq(
    id: string,
    body: {
      email?: string;
      phone?: string;
      role?: UserRole;
      status?: UserStatus;
      fullName?: string;
      licenceNumber?: string;
      identityNumber?: string;
      passportPhoto?: string;
      licencePhoto?: string;
      identityCardPhoto?: string;
      leaseToOwn?: boolean;
      leasePrincipal?: number;
      leaseDailyRate?: number;
    },
    actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { riderProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const normalizedEmail = body.email?.toLowerCase();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: { fleetId: user.fleetId, email: normalizedEmail },
      });
      if (existing) {
        throw new BadRequestException('Email already exists in this fleet');
      }
    }
    if (body.phone && body.phone !== user.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { fleetId: user.fleetId, phone: body.phone },
      });
      if (existing) {
        throw new BadRequestException(
          'Phone number already exists in this fleet',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          email:
            normalizedEmail !== undefined ? normalizedEmail || null : undefined,
          phone: body.phone !== undefined ? body.phone || null : undefined,
          role: body.role,
          status: body.status,
        },
      });

      const hasProfileUpdate =
        body.fullName !== undefined ||
        body.licenceNumber !== undefined ||
        body.identityNumber !== undefined ||
        body.passportPhoto !== undefined ||
        body.licencePhoto !== undefined ||
        body.identityCardPhoto !== undefined ||
        body.leaseToOwn !== undefined ||
        body.leasePrincipal !== undefined ||
        body.leaseDailyRate !== undefined;

      if (hasProfileUpdate) {
        const updateData: {
          fullName?: string;
          licenceNumber?: string | null;
          identityNumber?: string | null;
          passportPhoto?: string | null;
          licencePhoto?: string | null;
          identityCardPhoto?: string | null;
          leaseToOwn?: boolean;
          leasePrincipal?: number;
          leaseDailyRate?: number;
        } = {};
        if (body.fullName !== undefined) updateData.fullName = body.fullName;
        if (body.licenceNumber !== undefined)
          updateData.licenceNumber = body.licenceNumber || null;
        if (body.identityNumber !== undefined)
          updateData.identityNumber = body.identityNumber || null;
        if (body.passportPhoto !== undefined)
          updateData.passportPhoto = body.passportPhoto || null;
        if (body.licencePhoto !== undefined)
          updateData.licencePhoto = body.licencePhoto || null;
        if (body.identityCardPhoto !== undefined)
          updateData.identityCardPhoto = body.identityCardPhoto || null;
        if (body.leaseToOwn !== undefined)
          updateData.leaseToOwn = body.leaseToOwn;
        if (body.leasePrincipal !== undefined)
          updateData.leasePrincipal = body.leasePrincipal;
        if (body.leaseDailyRate !== undefined)
          updateData.leaseDailyRate = body.leaseDailyRate;

        if (user.riderProfile) {
          await tx.riderProfile.update({
            where: { userId: id },
            data: updateData,
          });
        } else {
          await tx.riderProfile.create({
            data: {
              userId: id,
              fullName: body.fullName || 'Operator',
              ...updateData,
            },
          });
        }
      }

      return updated;
    });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.USER_ROLE_CHANGED,
      targetType: 'USER',
      targetId: id,
      metaJson: {
        changes: body,
      },
    });

    return result;
  }

  async getBillingFleets() {
    const fleets = await this.prisma.fleet.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        installationPaid: true,
        upgradeRequested: true,
        upgradeRequestedAt: true,
        createdAt: true,
        insurerName: true,
        monthlyRatePerBike: true,
        trialStartedAt: true,
        trialEndsAt: true,
        momoPhoneNumber: true,
        autoPayEnabled: true,
        _count: {
          select: { users: true, bikes: true },
        },
      },
    });

    const result = [];
    for (const f of fleets) {
      let bikeCount = f._count.bikes;
      if (f.plan === 'INSURANCE' && f.insurerName) {
        bikeCount = await this.prisma.bike.count({
          where: { insurerName: f.insurerName },
        });
      }
      result.push({
        id: f.id,
        name: f.name,
        plan: f.plan,
        subscriptionStatus: f.subscriptionStatus,
        installationPaid: f.installationPaid,
        upgradeRequested: f.upgradeRequested,
        upgradeRequestedAt: f.upgradeRequestedAt,
        createdAt: f.createdAt,
        insurerName: f.insurerName,
        monthlyRatePerBike: f.monthlyRatePerBike,
        trialStartedAt: f.trialStartedAt,
        trialEndsAt: f.trialEndsAt,
        _count: {
          users: f._count.users,
          bikes: bikeCount,
        },
      });
    }
    return result;
  }

  async toggleInstallationPayment(fleetId: string, actor: AuthenticatedUser) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true, installationPaid: true },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: { installationPaid: !fleet.installationPaid },
      select: { id: true, name: true, installationPaid: true },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_SUBSCRIPTION_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        toggledInstallationPayment: true,
        oldValue: fleet.installationPaid,
        newValue: updated.installationPaid,
      },
    });

    return updated;
  }

  async approveFleetUpgrade(fleetId: string, actor: AuthenticatedUser) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true, upgradeRequested: true },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    const tier = await this.prisma.pricingTier.findUnique({
      where: { planCode: 'PREMIUM' },
    });
    const monthlyRatePerBike = tier ? tier.monthlyRatePerBike : 10000;

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        plan: 'PREMIUM',
        upgradeRequested: false,
        upgradeRequestedAt: null,
        monthlyRatePerBike,
      },
      select: { id: true, name: true, plan: true, upgradeRequested: true },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        approvedUpgrade: true,
        plan: 'PREMIUM',
      },
    });

    return updated;
  }

  async updateFleetBillingRate(
    fleetId: string,
    monthlyRatePerBike: number,
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (typeof monthlyRatePerBike !== 'number' || monthlyRatePerBike < 0) {
      throw new BadRequestException('Invalid monthly rate per bike');
    }

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: { monthlyRatePerBike: Math.round(monthlyRatePerBike) },
      select: { id: true, name: true, monthlyRatePerBike: true },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        oldRate: fleet.monthlyRatePerBike,
        newRate: monthlyRatePerBike,
      },
    });

    return updated;
  }

  async updateFleetTrial(
    fleetId: string,
    durationDays: number,
    actor: AuthenticatedUser,
  ) {
    const fleet = await this.prisma.fleet.findUnique({
      where: { id: fleetId },
    });
    if (!fleet) throw new NotFoundException('Fleet not found');

    if (typeof durationDays !== 'number' || durationDays <= 0) {
      throw new BadRequestException(
        'Duration must be a positive number of days',
      );
    }

    const trialStartedAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);

    const previousStatus = fleet.subscriptionStatus;

    const updated = await this.prisma.fleet.update({
      where: { id: fleetId },
      data: {
        trialStartedAt,
        trialEndsAt,
        subscriptionStatus: FleetSubscriptionStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.FLEET_PLAN_CHANGED,
      targetType: 'FLEET',
      targetId: fleetId,
      metaJson: {
        updatedTrial: true,
        durationDays,
        trialStartedAt,
        trialEndsAt,
        previousSubscriptionStatus: previousStatus,
        newSubscriptionStatus: FleetSubscriptionStatus.ACTIVE,
      },
    });

    return updated;
  }

  async globalSearch(q: string) {
    if (!q || typeof q !== 'string' || !q.trim()) {
      return {
        fleets: [],
        users: [],
        bikes: [],
        logs: [],
        devices: [],
      };
    }

    const searchTerm = q.trim();

    // Determine matched audit log action types
    const matchedActionTypes = Object.values(AuditActionType).filter((val) =>
      val.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const [fleets, users, bikes, devices, logs] = await Promise.all([
      // 1. Fleets
      this.prisma.fleet.findMany({
        where: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { insurerName: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          name: true,
          type: true,
          plan: true,
          subscriptionStatus: true,
        },
      }),

      // 2. Users
      this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
            {
              riderProfile: {
                fullName: { contains: searchTerm, mode: 'insensitive' },
              },
            },
          ],
        },
        take: 10,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          fleet: {
            select: {
              name: true,
            },
          },
          riderProfile: {
            select: {
              fullName: true,
            },
          },
        },
      }),

      // 3. Bikes
      this.prisma.bike.findMany({
        where: {
          OR: [
            { label: { contains: searchTerm, mode: 'insensitive' } },
            { plate: { contains: searchTerm, mode: 'insensitive' } },
            { serial: { contains: searchTerm, mode: 'insensitive' } },
            { model: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          label: true,
          plate: true,
          serial: true,
          model: true,
          status: true,
          fleetId: true,
          fleet: {
            select: {
              name: true,
            },
          },
        },
      }),

      // 4. Devices
      this.prisma.device.findMany({
        where: {
          OR: [
            { deviceUid: { contains: searchTerm, mode: 'insensitive' } },
            { imei: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          deviceUid: true,
          imei: true,
          status: true,
          fleet: {
            select: {
              name: true,
            },
          },
          bike: {
            select: {
              label: true,
            },
          },
        },
      }),

      // 5. Audit Logs
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { targetType: { contains: searchTerm, mode: 'insensitive' } },
            { targetId: { contains: searchTerm, mode: 'insensitive' } },
            {
              actionType: { in: matchedActionTypes },
            },
            {
              actorUser: {
                OR: [
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                  {
                    riderProfile: {
                      fullName: { contains: searchTerm, mode: 'insensitive' },
                    },
                  },
                ],
              },
            },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          actionType: true,
          targetType: true,
          targetId: true,
          createdAt: true,
          fleet: {
            select: {
              name: true,
            },
          },
          actorUser: {
            select: {
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      fleets,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        fleetName: u.fleet?.name ?? 'No Fleet',
        fullName: u.riderProfile?.fullName ?? 'No Profile Name',
      })),
      bikes: bikes.map((b) => ({
        id: b.id,
        label: b.label,
        plate: b.plate,
        serial: b.serial,
        model: b.model,
        status: b.status,
        fleetId: b.fleetId,
        fleetName: b.fleet?.name ?? 'No Fleet',
      })),
      devices: devices.map((d) => ({
        id: d.id,
        deviceUid: d.deviceUid,
        imei: d.imei,
        status: d.status,
        fleetName: d.fleet?.name ?? 'No Fleet',
        bikeLabel: d.bike?.label ?? null,
      })),
      logs: logs.map((l) => ({
        id: String(l.id),
        actionType: l.actionType,
        targetType: l.targetType,
        targetId: l.targetId,
        createdAt: l.createdAt,
        fleetName: l.fleet?.name ?? 'No Fleet',
        actorEmail: l.actorUser?.email ?? 'System/Unknown',
      })),
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
