import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActionType,
  EventSeverity,
  EventType,
  NotificationChannel,
  NotificationType,
  Poi,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { EventsService } from '../events/events.service';
import { NotificationOutboxService } from '../incidents/notification-outbox.service';
import { CommandsService } from '../commands/commands.service';
import { LiveStateService } from '../ingestion/live-state.service';
import { LiveBikeState } from '../ingestion/ingestion.types';
import { FleetDeviceCommand } from '../commands/commands.types';
import { PrismaService } from '../prisma/prisma.service';
import { haversineDistanceKm } from '../trips/trip-scoring.util';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreatePoiDto } from './dto/create-poi.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { ListAssignmentsDto } from './dto/list-assignments.dto';
import { ListPoiDto } from './dto/list-poi.dto';
import { ListRidersDto } from './dto/list-riders.dto';
import { PoiNearQueryDto } from './dto/poi-near-query.dto';
import { RiderSosDto } from './dto/rider-sos.dto';
import { RiderEventsQueryDto } from './dto/rider-events-query.dto';
import { RiderTripsQueryDto } from './dto/rider-trips-query.dto';
import { RiderWeeklyScoreQueryDto } from './dto/rider-weekly-score-query.dto';
import { UpdatePoiDto } from './dto/update-poi.dto';
import type {
  AssignmentSummary,
  NearbyPoiSummary,
  PoiSummary,
  RiderEventSummary,
  RiderMeResponse,
  RiderSosResponse,
  RiderTripDetail,
  RiderSummary,
  RiderTripSummary,
  RiderWeeklyScoreResponse,
} from './riders.types';
import {
  EMPTY_TRIP_EVENT_COUNTS,
  TripEventCounts,
  TripScoreWeights,
  normalizeTripEventCounts,
} from '../trips/trip-scoring.util';

interface RiderIdentity {
  id: string;
  fleetId: string;
  email: string | null;
  phone: string | null;
  status: string;
  riderProfile: {
    fullName: string;
  } | null;
  bikeAssignments: Array<{
    id: string;
    fleetId: string;
    bikeId: string;
    riderUserId: string;
    assignedAt: Date;
    unassignedAt: Date | null;
    active: boolean;
    bike: {
      label: string;
      status: string;
    };
  }>;
}

@Injectable()
export class RidersService {
  private readonly tripScoreMinDistanceKm: number;
  private readonly tripPenaltyMultiplier: number;
  private readonly tripScoreWeights: TripScoreWeights;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly commandsService: CommandsService,
    private readonly liveStateService: LiveStateService,
  ) {
    this.tripScoreMinDistanceKm = this.configService.get<number>(
      'TRIP_SCORE_MIN_DISTANCE_KM',
      1,
    );
    this.tripPenaltyMultiplier = this.configService.get<number>(
      'TRIP_SCORE_PENALTY_MULTIPLIER',
      20,
    );
    this.tripScoreWeights = {
      overspeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_OVERSPEED',
        1.2,
      ),
      speedLimitViolation: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_SPEED_LIMIT',
        1.1,
      ),
      schoolZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_SCHOOL_ZONE',
        1.4,
      ),
      hospitalZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HOSPITAL_ZONE',
        1.2,
      ),
      marketZoneSpeed: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_MARKET_ZONE',
        1.2,
      ),
      harshBrake: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_BRAKE',
        1,
      ),
      harshAccel: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_ACCEL',
        0.8,
      ),
      harshCorner: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_HARSH_CORNER',
        0.8,
      ),
      crash: this.configService.get<number>('TRIP_SCORE_WEIGHT_CRASH', 4),
      theftSuspected: this.configService.get<number>(
        'TRIP_SCORE_WEIGHT_THEFT_SUSPECTED',
        3,
      ),
    };
  }

  // Creates one rider account/profile and optionally assigns a bike in one transactional workflow.
  async createRiderForUser(
    actor: AuthenticatedUser,
    dto: CreateRiderDto,
  ): Promise<RiderSummary> {
    const normalizedEmail = dto.email?.toLowerCase() ?? null;

    // Check global uniqueness for email and phone number
    const OR: Prisma.UserWhereInput[] = [];
    if (normalizedEmail) {
      OR.push({ email: normalizedEmail.trim() });
    }
    if (dto.phone) {
      OR.push({ phone: dto.phone.trim() });
    }
    if (OR.length > 0) {
      const existingUser = await this.prismaService.user.findFirst({
        where: { OR },
      });
      if (existingUser) {
        if (
          normalizedEmail &&
          existingUser.email?.toLowerCase() === normalizedEmail.trim()
        ) {
          throw new ConflictException(
            'Email is already in use by another account',
          );
        }
        if (dto.phone && existingUser.phone === dto.phone.trim()) {
          throw new ConflictException(
            'Phone number is already in use by another account',
          );
        }
        throw new ConflictException('Email or phone already exists');
      }
    }

    const passwordHash = await this.hashPassword(dto.password);

    try {
      return this.prismaService.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            fleetId: actor.fleetId,
            role: UserRole.RIDER,
            phone: dto.phone,
            email: normalizedEmail,
            passwordHash,
            status: 'ACTIVE',
          },
        });

        await tx.riderProfile.create({
          data: {
            userId: createdUser.id,
            fullName: dto.fullName,
          },
        });

        if (dto.assignBikeId) {
          await this.assignRiderToBikeTx(
            tx,
            actor.fleetId,
            dto.assignBikeId,
            createdUser.id,
            actor.id,
          );
        }

        await tx.auditLog.create({
          data: {
            fleetId: actor.fleetId,
            actorUserId: actor.id,
            actionType: AuditActionType.RIDER_CREATED,
            targetType: 'User',
            targetId: createdUser.id,
            metaJson: {
              role: UserRole.RIDER,
              assignedBikeId: dto.assignBikeId ?? null,
            },
          },
        });

        const riderIdentity = await this.loadRiderIdentityTx(
          tx,
          createdUser.id,
          actor.fleetId,
        );
        return this.toRiderSummary(riderIdentity);
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Rider email or phone already exists');
      }
      throw error;
    }
  }

  // Assigns one rider to one bike and automatically deactivates prior active bike assignment.
  async createAssignmentForUser(
    actor: AuthenticatedUser,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentSummary> {
    return this.prismaService.$transaction((tx) =>
      this.assignRiderToBikeTx(
        tx,
        actor.fleetId,
        dto.bikeId,
        dto.riderUserId,
        actor.id,
      ),
    );
  }

  // Lists rider accounts with optional active-bike filter and pagination metadata.
  async listRidersForUser(
    user: AuthenticatedUser,
    query: ListRidersDto,
  ): Promise<PaginatedResponse<RiderSummary>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.UserWhereInput = {
      fleetId: user.fleetId,
      role: UserRole.RIDER,
    };
    if (query.bikeId) {
      where.bikeAssignments = {
        some: {
          bikeId: query.bikeId,
          active: true,
        },
      };
    }

    const [riders, total] = await Promise.all([
      this.prismaService.user.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          riderProfile: true,
          bikeAssignments: {
            where: {
              active: true,
            },
            include: {
              bike: {
                select: {
                  label: true,
                  status: true,
                },
              },
            },
            orderBy: {
              assignedAt: 'desc',
            },
          },
        },
      }),
      this.prismaService.user.count({ where }),
    ]);

    return createPaginatedResponse(
      riders.map((rider) => this.toRiderSummary(rider as RiderIdentity)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Lists bike assignment history records with optional bike/rider/activity filters.
  async listAssignmentsForUser(
    user: AuthenticatedUser,
    query: ListAssignmentsDto,
  ): Promise<PaginatedResponse<AssignmentSummary>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.BikeAssignmentWhereInput = {
      fleetId: user.fleetId,
    };
    if (query.bikeId) {
      where.bikeId = query.bikeId;
    }
    if (query.riderUserId) {
      where.riderUserId = query.riderUserId;
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }

    const [assignments, total] = await Promise.all([
      this.prismaService.bikeAssignment.findMany({
        where,
        orderBy: {
          assignedAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          bike: {
            select: {
              label: true,
              status: true,
            },
          },
          rider: {
            select: {
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.bikeAssignment.count({ where }),
    ]);

    return createPaginatedResponse(
      assignments.map((assignment) => this.toAssignmentSummary(assignment)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Creates one fleet or global POI while enforcing owner-only global permissions.
  async createPoiForUser(
    user: AuthenticatedUser,
    dto: CreatePoiDto,
  ): Promise<PoiSummary> {
    const isGlobalPoi = dto.global === true;
    if (isGlobalPoi && user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can create global POIs');
    }

    const createdPoi = await this.prismaService.poi.create({
      data: {
        fleetId: isGlobalPoi ? null : user.fleetId,
        type: dto.type,
        name: dto.name,
        phone: dto.phone ?? null,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address ?? null,
        active: dto.active ?? true,
      },
    });

    return this.toPoiSummary(createdPoi);
  }

  // Lists fleet-visible and global POIs with optional filters and pagination.
  async listPoisForUser(
    user: AuthenticatedUser,
    query: ListPoiDto,
  ): Promise<PaginatedResponse<PoiSummary>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.PoiWhereInput = {
      OR: [{ fleetId: user.fleetId }, { fleetId: null }],
    };
    if (query.type) {
      where.type = query.type;
    }
    if (query.active !== undefined) {
      where.active = query.active;
    }

    const [pois, total] = await Promise.all([
      this.prismaService.poi.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.poi.count({ where }),
    ]);

    return createPaginatedResponse(
      pois.map((poi) => this.toPoiSummary(poi)),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Loads one POI and enforces fleet/global read visibility.
  async getPoiForUser(
    user: AuthenticatedUser,
    poiId: string,
  ): Promise<PoiSummary> {
    const poi = await this.loadPoiOrThrow(poiId);
    this.assertPoiReadableByUser(poi, user);
    return this.toPoiSummary(poi);
  }

  // Updates one POI with owner-only restrictions on global records.
  async updatePoiForUser(
    user: AuthenticatedUser,
    poiId: string,
    dto: UpdatePoiDto,
  ): Promise<PoiSummary> {
    const poi = await this.loadPoiOrThrow(poiId);
    this.assertPoiWritableByUser(poi, user);

    const updated = await this.prismaService.poi.update({
      where: { id: poi.id },
      data: {
        type: dto.type,
        name: dto.name,
        phone: dto.phone,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address,
        active: dto.active,
      },
    });

    return this.toPoiSummary(updated);
  }

  // Deletes one POI with owner-only restrictions on global records.
  async deletePoiForUser(
    user: AuthenticatedUser,
    poiId: string,
  ): Promise<{ deleted: true; id: string }> {
    const poi = await this.loadPoiOrThrow(poiId);
    this.assertPoiWritableByUser(poi, user);
    await this.prismaService.poi.delete({
      where: { id: poi.id },
    });
    return {
      deleted: true,
      id: poi.id,
    };
  }

  // Returns nearby POIs sorted by distance and filtered by radius/type/global-visibility.
  async getNearbyPoisForUser(
    user: AuthenticatedUser,
    query: PoiNearQueryDto,
  ): Promise<NearbyPoiSummary[]> {
    const radiusKm = this.normalizePositiveNumber(query.radiusKm, 5);
    const limit = this.normalizePositiveInteger(query.limit, 20);

    const where: Prisma.PoiWhereInput = {
      active: true,
      OR: [{ fleetId: user.fleetId }, { fleetId: null }],
    };
    if (query.type) {
      where.type = query.type;
    }

    const pois = await this.prismaService.poi.findMany({
      where,
    });
    return pois
      .map((poi) => {
        const distanceKm = haversineDistanceKm(
          query.lat,
          query.lng,
          Number(poi.lat),
          Number(poi.lng),
        );
        return {
          ...this.toPoiSummary(poi),
          distanceKm,
        };
      })
      .filter((poi) => poi.distanceKm <= radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, limit);
  }

  // Returns rider profile plus currently active bike assignments.
  async getRiderMe(user: AuthenticatedUser): Promise<RiderMeResponse> {
    const rider = await this.loadRiderIdentityOrThrow(user.id, user.fleetId);

    const fleet = await this.prismaService.fleet.findUnique({
      where: { id: user.fleetId },
    });

    return {
      userId: rider.id,
      fleetId: rider.fleetId,
      phone: rider.phone,
      email: rider.email,
      status: rider.status,
      plan: fleet?.plan ?? 'DEMO',
      fullName: rider.riderProfile?.fullName ?? null,
      assignments: rider.bikeAssignments.map((assignment) =>
        this.toAssignmentSummary(assignment),
      ),
      isPersonalOwner: fleet?.type === 'PERSONAL',
    };
  }

  // Returns live telemetry for an assigned bike
  async getRiderBikeState(
    user: AuthenticatedUser,
    bikeId: string,
  ): Promise<LiveBikeState | null> {
    await this.assertBikeAssignedToRider(user, bikeId);
    return this.liveStateService.getBikeState(user.fleetId, bikeId);
  }

  // Requests lock command for personal bike owner
  async requestLock(
    user: AuthenticatedUser,
    bikeId: string,
  ): Promise<FleetDeviceCommand> {
    await this.assertBikeAssignedToRider(user, bikeId);
    await this.assertPersonalFleet(user.fleetId);
    return this.commandsService.requestLockForBike(bikeId, user);
  }

  // Requests unlock command for personal bike owner
  async requestUnlock(
    user: AuthenticatedUser,
    bikeId: string,
  ): Promise<FleetDeviceCommand> {
    await this.assertBikeAssignedToRider(user, bikeId);
    await this.assertPersonalFleet(user.fleetId);
    return this.commandsService.requestUnlockForBike(bikeId, user);
  }

  // Validates fleet type is PERSONAL for premium rider features
  private async assertPersonalFleet(fleetId: string): Promise<void> {
    const fleet = await this.prismaService.fleet.findUnique({
      where: { id: fleetId },
    });
    if (fleet?.type !== 'PERSONAL') {
      throw new ForbiddenException(
        'Remote lock/unlock is only available for personal owners',
      );
    }
  }

  // Validates bike assignment
  private async assertBikeAssignedToRider(
    user: AuthenticatedUser,
    bikeId: string,
  ): Promise<void> {
    const rider = await this.loadRiderIdentityOrThrow(user.id, user.fleetId);
    const isAssigned = rider.bikeAssignments.some(
      (a) => a.bikeId === bikeId && a.active,
    );
    if (!isAssigned) {
      throw new ForbiddenException(
        'You must be actively assigned to this bike',
      );
    }
  }

  // Lists rider-owned trips only and supports optional date filtering.
  async listRiderTrips(
    user: AuthenticatedUser,
    query: RiderTripsQueryDto,
  ): Promise<PaginatedResponse<RiderTripSummary>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.TripWhereInput = {
      fleetId: user.fleetId,
      riderId: user.id,
    };
    if (query.from || query.to) {
      where.startTs = {};
      if (query.from) {
        where.startTs.gte = new Date(query.from);
      }
      if (query.to) {
        where.startTs.lte = new Date(query.to);
      }
    }

    const [trips, total] = await Promise.all([
      this.prismaService.trip.findMany({
        where,
        include: {
          bike: {
            select: {
              label: true,
            },
          },
        },
        orderBy: {
          startTs: 'desc',
        },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prismaService.trip.count({ where }),
    ]);

    return createPaginatedResponse(
      trips.map((trip) => ({
        id: trip.id,
        bikeId: trip.bikeId,
        bikeLabel: trip.bike?.label ?? 'Bike ' + trip.bikeId.slice(0, 8),
        startTs: trip.startTs.toISOString(),
        endTs: trip.endTs?.toISOString() ?? null,
        distanceKm: Number(trip.distanceKm),
        durationSec: trip.durationSec,
        score: Number(trip.score),
        consumptionPct:
          trip.startBatteryPct !== null && trip.endBatteryPct !== null
            ? Number(trip.startBatteryPct) - Number(trip.endBatteryPct)
            : null,
      })),
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Loads one rider-owned trip and attaches score breakdown and grouped event counters.
  async getRiderTripDetail(
    user: AuthenticatedUser,
    tripId: string,
  ): Promise<RiderTripDetail> {
    const trip = await this.prismaService.trip.findFirst({
      where: {
        id: tripId,
        fleetId: user.fleetId,
        riderId: user.id,
      },
      include: {
        bike: {
          select: {
            label: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const eventCounts = await this.getTripEventCountsForWindow(
      trip.fleetId,
      trip.bikeId,
      trip.startTs,
      trip.endTs,
    );

    return {
      id: trip.id,
      bikeId: trip.bikeId,
      bikeLabel: trip.bike?.label ?? 'Bike ' + trip.bikeId.slice(0, 8),
      startTs: trip.startTs.toISOString(),
      endTs: trip.endTs?.toISOString() ?? null,
      distanceKm: Number(trip.distanceKm),
      durationSec: trip.durationSec,
      score: Number(trip.score),
      consumptionPct:
        trip.startBatteryPct !== null && trip.endBatteryPct !== null
          ? Number(trip.startBatteryPct) - Number(trip.endBatteryPct)
          : null,
      eventCounts,
      scoreBreakdown: this.computeTripScoreBreakdown(
        Number(trip.distanceKm),
        eventCounts,
      ),
    };
  }

  // Lists recent rider-visible events for assigned bike context on mobile home alerts.
  async listRiderEvents(
    user: AuthenticatedUser,
    query: RiderEventsQueryDto,
  ): Promise<RiderEventSummary[]> {
    const rider = await this.loadRiderIdentityOrThrow(user.id, user.fleetId);
    const assignedBikeIds = rider.bikeAssignments.map(
      (assignment) => assignment.bikeId,
    );
    if (assignedBikeIds.length === 0) {
      return [];
    }

    const targetBikeId = query.bikeId ?? assignedBikeIds[0];
    if (!assignedBikeIds.includes(targetBikeId)) {
      throw new ForbiddenException('Rider can only view assigned bike alerts');
    }

    const where: Prisma.EventWhereInput = {
      fleetId: user.fleetId,
      bikeId: targetBikeId,
    };
    if (query.from || query.to) {
      where.ts = {};
      if (query.from) {
        where.ts.gte = new Date(query.from);
      }
      if (query.to) {
        where.ts.lte = new Date(query.to);
      }
    }

    const limit = this.normalizePositiveInteger(query.limit, 5);
    const events = await this.prismaService.event.findMany({
      where,
      orderBy: {
        ts: 'desc',
      },
      take: limit,
    });

    return events.map((event) => ({
      id: event.id.toString(),
      bikeId: event.bikeId,
      deviceId: event.deviceId,
      ts: event.ts.toISOString(),
      type: event.type,
      severity: event.severity,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  // Computes weekly rider scoring aggregates from rider-linked trips.
  async getRiderWeeklyScore(
    user: AuthenticatedUser,
    query: RiderWeeklyScoreQueryDto,
  ): Promise<RiderWeeklyScoreResponse> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const trips = await this.prismaService.trip.findMany({
      where: {
        fleetId: user.fleetId,
        riderId: user.id,
        startTs: {
          gte: from,
          lte: to,
        },
      },
      select: {
        score: true,
      },
    });

    const scores = trips.map((trip) => Number(trip.score));
    const avgScore =
      scores.length === 0
        ? 100
        : scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const bestScore = scores.length === 0 ? null : Math.max(...scores);
    const worstScore = scores.length === 0 ? null : Math.min(...scores);

    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      tripCount: scores.length,
      avgScore: Number(avgScore.toFixed(2)),
      bestScore: bestScore === null ? null : Number(bestScore.toFixed(2)),
      worstScore: worstScore === null ? null : Number(worstScore.toFixed(2)),
    };
  }

  // Emits SOS event for rider's current bike and notifies emergency contacts asynchronously.
  async triggerRiderSos(
    user: AuthenticatedUser,
    dto: RiderSosDto,
  ): Promise<RiderSosResponse> {
    const rider = await this.loadRiderIdentityOrThrow(user.id, user.fleetId);
    const activeAssignment = rider.bikeAssignments[0];
    if (!activeAssignment) {
      throw new BadRequestException('Rider has no active bike assignment');
    }

    const activeDevice = await this.prismaService.device.findFirst({
      where: {
        fleetId: user.fleetId,
        bikeId: activeAssignment.bikeId,
        status: 'ACTIVE',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    if (!activeDevice) {
      throw new BadRequestException(
        'Assigned bike has no active telemetry device',
      );
    }

    const sosEvent = await this.eventsService.createFleetEvent({
      fleetId: user.fleetId,
      bikeId: activeAssignment.bikeId,
      deviceId: activeDevice.id,
      ts: new Date(),
      type: 'SOS',
      severity: EventSeverity.HIGH,
      metaJson: {
        source: 'rider_mobile',
        riderUserId: user.id,
        message: dto.message ?? null,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
      },
    });

    const emergencyContacts =
      await this.prismaService.emergencyContact.findMany({
        where: {
          fleetId: user.fleetId,
          active: true,
        },
        select: {
          id: true,
          phone: true,
        },
      });

    const notificationIds: string[] = [];
    for (const contact of emergencyContacts) {
      const notification = await this.prismaService.notification.create({
        data: {
          fleetId: user.fleetId,
          type: NotificationType.SOS_ALERT,
          channel: NotificationChannel.SMS,
          to: contact.phone,
          payloadJson: {
            eventId: sosEvent.id,
            eventType: sosEvent.type,
            bikeId: sosEvent.bikeId,
            deviceId: sosEvent.deviceId,
            ts: sosEvent.ts.toISOString(),
            message: dto.message ?? null,
          },
        },
        select: {
          id: true,
        },
      });
      notificationIds.push(notification.id);
    }

    for (const notificationId of notificationIds) {
      await this.notificationOutboxService.enqueueNotification(notificationId);
    }

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.SOS_TRIGGERED,
      targetType: 'Event',
      targetId: sosEvent.id,
      metaJson: {
        bikeId: sosEvent.bikeId,
        notifiedContacts: emergencyContacts.length,
      },
    });

    return {
      event: sosEvent,
      notifiedContacts: emergencyContacts.length,
      type: 'SOS',
    };
  }

  // Aggregates trip-window event counts that feed rider detail score transparency.
  private async getTripEventCountsForWindow(
    fleetId: string,
    bikeId: string,
    startTs: Date,
    endTs: Date | null,
  ): Promise<TripEventCounts> {
    if (!endTs) {
      return { ...EMPTY_TRIP_EVENT_COUNTS };
    }

    const groupedRows = await this.prismaService.event.groupBy({
      by: ['type'],
      where: {
        fleetId,
        bikeId,
        ts: {
          gte: startTs,
          lte: endTs,
        },
        type: {
          in: [
            EventType.OVERSPEED,
            EventType.SPEED_LIMIT_VIOLATION,
            EventType.SCHOOL_ZONE_SPEED,
            EventType.HOSPITAL_ZONE_SPEED,
            EventType.MARKET_ZONE_SPEED,
            EventType.HARSH_BRAKE,
            EventType.HARSH_ACCEL,
            EventType.HARSH_CORNER,
            EventType.CRASH,
            EventType.THEFT_SUSPECTED,
          ],
        },
      },
      _count: {
        _all: true,
      },
    });

    return normalizeTripEventCounts(
      groupedRows.map((row) => ({
        type: row.type,
        count: row._count._all,
      })),
    );
  }

  // Derives a score explanation payload from configured weights and trip event counts.
  private computeTripScoreBreakdown(
    distanceKm: number,
    counts: TripEventCounts,
  ): RiderTripDetail['scoreBreakdown'] {
    const normalizedDistanceKm = Math.max(
      distanceKm,
      this.tripScoreMinDistanceKm,
    );
    const weightedBaseByType = {
      OVERSPEED: counts.OVERSPEED * this.tripScoreWeights.overspeed,
      SPEED_LIMIT_VIOLATION:
        counts.SPEED_LIMIT_VIOLATION *
        this.tripScoreWeights.speedLimitViolation,
      SCHOOL_ZONE_SPEED:
        counts.SCHOOL_ZONE_SPEED * this.tripScoreWeights.schoolZoneSpeed,
      HOSPITAL_ZONE_SPEED:
        counts.HOSPITAL_ZONE_SPEED * this.tripScoreWeights.hospitalZoneSpeed,
      MARKET_ZONE_SPEED:
        counts.MARKET_ZONE_SPEED * this.tripScoreWeights.marketZoneSpeed,
      HARSH_BRAKE: counts.HARSH_BRAKE * this.tripScoreWeights.harshBrake,
      HARSH_ACCEL: counts.HARSH_ACCEL * this.tripScoreWeights.harshAccel,
      HARSH_CORNER: counts.HARSH_CORNER * this.tripScoreWeights.harshCorner,
      CRASH: counts.CRASH * this.tripScoreWeights.crash,
      THEFT_SUSPECTED:
        counts.THEFT_SUSPECTED * this.tripScoreWeights.theftSuspected,
    };

    const penalties = {
      OVERSPEED: this.roundScorePenalty(
        (weightedBaseByType.OVERSPEED / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      SPEED_LIMIT_VIOLATION: this.roundScorePenalty(
        (weightedBaseByType.SPEED_LIMIT_VIOLATION / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      SCHOOL_ZONE_SPEED: this.roundScorePenalty(
        (weightedBaseByType.SCHOOL_ZONE_SPEED / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      HOSPITAL_ZONE_SPEED: this.roundScorePenalty(
        (weightedBaseByType.HOSPITAL_ZONE_SPEED / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      MARKET_ZONE_SPEED: this.roundScorePenalty(
        (weightedBaseByType.MARKET_ZONE_SPEED / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      HARSH_BRAKE: this.roundScorePenalty(
        (weightedBaseByType.HARSH_BRAKE / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      HARSH_ACCEL: this.roundScorePenalty(
        (weightedBaseByType.HARSH_ACCEL / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      HARSH_CORNER: this.roundScorePenalty(
        (weightedBaseByType.HARSH_CORNER / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      CRASH: this.roundScorePenalty(
        (weightedBaseByType.CRASH / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
      THEFT_SUSPECTED: this.roundScorePenalty(
        (weightedBaseByType.THEFT_SUSPECTED / normalizedDistanceKm) *
          this.tripPenaltyMultiplier,
      ),
    };

    const total = this.roundScorePenalty(
      penalties.OVERSPEED +
        penalties.SPEED_LIMIT_VIOLATION +
        penalties.SCHOOL_ZONE_SPEED +
        penalties.HOSPITAL_ZONE_SPEED +
        penalties.MARKET_ZONE_SPEED +
        penalties.HARSH_BRAKE +
        penalties.HARSH_ACCEL +
        penalties.HARSH_CORNER +
        penalties.CRASH +
        penalties.THEFT_SUSPECTED,
    );

    return {
      minDistanceKm: this.tripScoreMinDistanceKm,
      normalizedDistanceKm: this.roundScorePenalty(normalizedDistanceKm),
      penaltyMultiplier: this.tripPenaltyMultiplier,
      weights: this.tripScoreWeights,
      penalties: {
        ...penalties,
        total,
      },
    };
  }

  // Rounds score-related decimal values to two places for stable mobile rendering.
  private roundScorePenalty(value: number): number {
    return Number(value.toFixed(2));
  }

  // Reusable transactional assignment workflow with fleet/rider validation and audit logging.
  private async assignRiderToBikeTx(
    tx: Prisma.TransactionClient,
    fleetId: string,
    bikeId: string,
    riderUserId: string,
    actorUserId: string,
  ): Promise<AssignmentSummary> {
    const [bike, riderUser] = await Promise.all([
      tx.bike.findUnique({
        where: {
          id: bikeId,
        },
        select: {
          id: true,
          fleetId: true,
          label: true,
          status: true,
        },
      }),
      tx.user.findUnique({
        where: {
          id: riderUserId,
        },
        select: {
          id: true,
          fleetId: true,
          role: true,
          riderProfile: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    ]);

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }
    if (bike.fleetId !== fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
    if (!riderUser || riderUser.role !== UserRole.RIDER) {
      throw new NotFoundException('Rider not found');
    }
    if (riderUser.fleetId !== fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }

    const now = new Date();
    const previousAssignment = await tx.bikeAssignment.findFirst({
      where: {
        bikeId,
        active: true,
      },
      select: {
        id: true,
        riderUserId: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
    if (previousAssignment?.riderUserId === riderUserId) {
      const existingAssignment = await tx.bikeAssignment.findFirst({
        where: {
          bikeId,
          riderUserId,
          active: true,
        },
        include: {
          bike: {
            select: {
              label: true,
              status: true,
            },
          },
          rider: {
            select: {
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      });
      if (!existingAssignment) {
        throw new ConflictException('Unable to resolve existing assignment');
      }
      return this.toAssignmentSummary(existingAssignment);
    }

    await tx.bikeAssignment.updateMany({
      where: {
        bikeId,
        active: true,
      },
      data: {
        active: false,
        unassignedAt: now,
      },
    });

    const assignment = await tx.bikeAssignment.create({
      data: {
        fleetId,
        bikeId,
        riderUserId,
        assignedAt: now,
        active: true,
      },
      include: {
        bike: {
          select: {
            label: true,
            status: true,
          },
        },
        rider: {
          select: {
            riderProfile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        fleetId,
        actorUserId,
        actionType: AuditActionType.BIKE_ASSIGNMENT_CHANGED,
        targetType: 'BikeAssignment',
        targetId: assignment.id,
        metaJson: {
          bikeId,
          riderUserId,
          previousAssignmentId: previousAssignment?.id ?? null,
        },
      },
    });

    return this.toAssignmentSummary(assignment);
  }

  // Loads one rider identity projection with active assignment context.
  private async loadRiderIdentityOrThrow(
    userId: string,
    fleetId: string,
  ): Promise<RiderIdentity> {
    const rider = await this.loadRiderIdentity(userId, fleetId);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }
    return rider;
  }

  // Fetches rider identity projection by id and fleet scope.
  private async loadRiderIdentity(
    userId: string,
    fleetId: string,
  ): Promise<RiderIdentity | null> {
    return this.prismaService.user.findFirst({
      where: {
        id: userId,
        fleetId,
        role: UserRole.RIDER,
      },
      select: {
        id: true,
        fleetId: true,
        email: true,
        phone: true,
        status: true,
        riderProfile: {
          select: {
            fullName: true,
          },
        },
        bikeAssignments: {
          where: {
            active: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
          select: {
            id: true,
            fleetId: true,
            bikeId: true,
            riderUserId: true,
            assignedAt: true,
            unassignedAt: true,
            active: true,
            bike: {
              select: {
                label: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  // Fetches rider identity projection inside a transaction context.
  private async loadRiderIdentityTx(
    tx: Prisma.TransactionClient,
    userId: string,
    fleetId: string,
  ): Promise<RiderIdentity> {
    const rider = await tx.user.findFirst({
      where: {
        id: userId,
        fleetId,
        role: UserRole.RIDER,
      },
      select: {
        id: true,
        fleetId: true,
        email: true,
        phone: true,
        status: true,
        riderProfile: {
          select: {
            fullName: true,
          },
        },
        bikeAssignments: {
          where: {
            active: true,
          },
          orderBy: {
            assignedAt: 'desc',
          },
          select: {
            id: true,
            fleetId: true,
            bikeId: true,
            riderUserId: true,
            assignedAt: true,
            unassignedAt: true,
            active: true,
            bike: {
              select: {
                label: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }
    return rider;
  }

  // Loads one POI by id or raises 404 for missing records.
  private async loadPoiOrThrow(poiId: string): Promise<Poi> {
    const poi = await this.prismaService.poi.findUnique({
      where: {
        id: poiId,
      },
    });
    if (!poi) {
      throw new NotFoundException('POI not found');
    }
    return poi;
  }

  // Enforces read-level POI access rules for fleet and global records.
  private assertPoiReadableByUser(poi: Poi, user: AuthenticatedUser): void {
    if (poi.fleetId === null) {
      return;
    }
    if (poi.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Enforces write-level POI access rules, including owner-only global POI edits.
  private assertPoiWritableByUser(poi: Poi, user: AuthenticatedUser): void {
    if (poi.fleetId === null && user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only OWNER can modify global POIs');
    }
    if (poi.fleetId !== null && poi.fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Hashes rider passwords using configured bcrypt work factor.
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);
    return bcrypt.hash(password, saltRounds);
  }

  // Maps rider identity data into list-friendly API response shape.
  private toRiderSummary(rider: RiderIdentity): RiderSummary {
    return {
      id: rider.id,
      fleetId: rider.fleetId,
      phone: rider.phone,
      email: rider.email,
      status: rider.status as RiderSummary['status'],
      fullName: rider.riderProfile?.fullName ?? null,
      activeAssignments: rider.bikeAssignments.map((assignment) =>
        this.toAssignmentSummary(assignment),
      ),
    };
  }

  // Maps assignment rows into API-safe assignment response objects.
  private toAssignmentSummary(assignment: {
    id: string;
    fleetId: string;
    bikeId: string;
    riderUserId: string;
    assignedAt: Date;
    unassignedAt: Date | null;
    active: boolean;
    bike: {
      label: string;
      status: string;
    };
    rider?: {
      riderProfile: {
        fullName: string;
      } | null;
    };
  }): AssignmentSummary {
    return {
      id: assignment.id,
      fleetId: assignment.fleetId,
      bikeId: assignment.bikeId,
      bikeLabel: assignment.bike.label,
      bikeStatus: assignment.bike.status as AssignmentSummary['bikeStatus'],
      riderUserId: assignment.riderUserId,
      riderFullName: assignment.rider?.riderProfile?.fullName ?? null,
      assignedAt: assignment.assignedAt.toISOString(),
      unassignedAt: assignment.unassignedAt?.toISOString() ?? null,
      active: assignment.active,
    };
  }

  // Maps POI model rows into API response shape with numeric coordinates.
  private toPoiSummary(poi: Poi): PoiSummary {
    return {
      id: poi.id,
      fleetId: poi.fleetId,
      type: poi.type,
      name: poi.name,
      phone: poi.phone,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
      address: poi.address,
      active: poi.active,
      createdAt: poi.createdAt.toISOString(),
      updatedAt: poi.updatedAt.toISOString(),
    };
  }

  // Coerces HTTP query values into positive integers for stable service behavior in tests and runtime.
  private normalizePositiveInteger(
    value: number | string | undefined,
    fallback: number,
  ): number {
    const normalized = Number(value ?? fallback);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return fallback;
    }

    return Math.trunc(normalized);
  }

  // Coerces HTTP query values into positive numbers for geo distance filtering.
  private normalizePositiveNumber(
    value: number | string | undefined,
    fallback: number,
  ): number {
    const normalized = Number(value ?? fallback);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return fallback;
    }

    return normalized;
  }
}
