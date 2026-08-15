import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActionType, Bike, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  PaginatedResponse,
  createPaginatedResponse,
  getPaginationParams,
} from '../common/pagination';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBikeDto } from './dto/create-bike.dto';
import { LockActionDto } from './dto/lock-action.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';

export type LoadedBike = Bike;

@Injectable()
export class BikesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // Returns all bikes visible to the caller fleet.
  async listBikesForUser(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<LoadedBike>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.BikeWhereInput = {};

    if (user.fleetPlan === 'INSURANCE') {
      where.insurerName = user.insurerName;
    } else {
      where.fleetId = user.fleetId;
    }

    if (query.search) {
      where.OR = [
        { label: { contains: query.search, mode: 'insensitive' } },
        { serial: { contains: query.search, mode: 'insensitive' } },
        { plate: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [bikes, total] = await Promise.all([
      this.prismaService.bike.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          commands: {
            where: { type: { in: ['LOCK', 'UNLOCK'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              type: true,
              status: true,
              updatedAt: true,
              errorMessage: true,
            },
          },
        },
      }),
      this.prismaService.bike.count({ where }),
    ]);

    return createPaginatedResponse(
      bikes,
      total,
      pagination.page,
      pagination.pageSize,
    );
  }

  // Creates a bike in the caller fleet.
  async createBikeForUser(
    dto: CreateBikeDto,
    user: AuthenticatedUser,
  ): Promise<Bike> {
    try {
      const bike = await this.prismaService.bike.create({
        data: {
          fleetId: user.fleetId,
          label: dto.label,
          plate: dto.plate,
          serial: dto.serial,
          model: dto.model,
          status: dto.status ?? 'ACTIVE',
          imageUrl: dto.imageUrl,
          type: dto.type,
          insurerName: dto.insurerName,
          leaseToOwn: dto.leaseToOwn ?? false,
        },
      });

      await this.auditService.createAuditLog({
        fleetId: user.fleetId,
        actorUserId: user.id,
        actionType: AuditActionType.BIKE_CREATED,
        targetType: 'BIKE',
        targetId: bike.id,
        metaJson: {
          label: bike.label,
          plate: bike.plate ?? null,
          serial: bike.serial ?? null,
          model: bike.model ?? null,
          type: bike.type ?? null,
          insurerName: bike.insurerName ?? null,
          leaseToOwn: bike.leaseToOwn,
        },
      });

      return bike;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bike label, plate, or serial already exists',
        );
      }

      throw error;
    }
  }

  // Loads a bike by id and enforces fleet isolation on access.
  async getBikeForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<LoadedBike> {
    const bike = await this.loadBikeOrThrow(id);

    if (user.fleetPlan === 'INSURANCE') {
      if (bike.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this bike is denied');
      }
    } else {
      this.assertFleetAccess(bike.fleetId, user);
    }

    return bike;
  }

  // Updates a bike if it belongs to the caller fleet.
  async updateBikeForUser(
    id: string,
    dto: UpdateBikeDto,
    user: AuthenticatedUser,
  ): Promise<Bike> {
    const bike = await this.loadBikeOrThrow(id);
    this.assertFleetAccess(bike.fleetId, user);

    try {
      const updated = await this.prismaService.bike.update({
        where: { id },
        data: {
          label: dto.label,
          plate: dto.plate,
          serial: dto.serial,
          model: dto.model,
          status: dto.status,
          imageUrl: dto.imageUrl,
          type: dto.type,
          ...(dto.insurerName !== undefined
            ? { insurerName: dto.insurerName }
            : {}),
          ...(dto.leaseToOwn !== undefined
            ? { leaseToOwn: dto.leaseToOwn }
            : {}),
        },
      });

      await this.auditService.createAuditLog({
        fleetId: user.fleetId,
        actorUserId: user.id,
        actionType: AuditActionType.BIKE_UPDATED,
        targetType: 'BIKE',
        targetId: updated.id,
        metaJson: {
          before: {
            label: bike.label,
            plate: bike.plate,
            serial: bike.serial,
            model: bike.model,
            status: bike.status,
            type: bike.type,
            insurerName: bike.insurerName,
            leaseToOwn: bike.leaseToOwn,
          },
          after: {
            label: updated.label,
            plate: updated.plate,
            serial: updated.serial,
            model: updated.model,
            status: updated.status,
            type: updated.type,
            insurerName: updated.insurerName,
            leaseToOwn: updated.leaseToOwn,
          },
        },
      });

      return updated;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Bike label, plate, or serial already exists',
        );
      }

      throw error;
    }
  }

  // Deletes a bike if it belongs to the caller fleet.
  async deleteBikeForUser(id: string, user: AuthenticatedUser): Promise<void> {
    const bike = await this.loadBikeOrThrow(id);
    this.assertFleetAccess(bike.fleetId, user);
    await this.prismaService.bike.delete({ where: { id } });

    await this.auditService.createAuditLog({
      fleetId: user.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.BIKE_DELETED,
      targetType: 'BIKE',
      targetId: bike.id,
      metaJson: {
        label: bike.label,
        plate: bike.plate,
        serial: bike.serial,
      },
    });
  }

  // Audits lock/unlock control actions before lock integration is implemented.
  async requestBikeLockAction(
    id: string,
    dto: LockActionDto,
    user: AuthenticatedUser,
  ): Promise<{ queued: false; message: string }> {
    const bike = await this.loadBikeOrThrow(id);
    this.assertFleetAccess(bike.fleetId, user);

    await this.auditService.createAuditLog({
      fleetId: bike.fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.LOCK_ACTION_REQUESTED,
      targetType: 'BIKE',
      targetId: bike.id,
      metaJson: {
        action: dto.action,
        reason: dto.reason ?? null,
        implemented: false,
      },
    });

    this.eventsGateway.emitCommandStatus(bike.fleetId, {
      commandId: `lock:${bike.id}:${Date.now()}`,
      status: 'NOT_IMPLEMENTED',
      ts: new Date().toISOString(),
      bikeId: bike.id,
      action: dto.action,
      message: 'Bike lock integration is not implemented yet',
    });

    return {
      queued: false,
      message: 'Bike lock integration is not implemented yet; action audited.',
    };
  }

  // Fetches a bike record by id or throws 404.
  private async loadBikeOrThrow(id: string): Promise<LoadedBike> {
    const bike = await this.prismaService.bike.findUnique({
      where: { id },
    });

    if (!bike) {
      throw new NotFoundException('Bike not found');
    }

    return bike;
  }

  // Validates caller fleet ownership against the target fleet id.
  private assertFleetAccess(fleetId: string, user: AuthenticatedUser): void {
    if (fleetId !== user.fleetId) {
      throw new ForbiddenException('Fleet access violation');
    }
  }

  // Gets 7-day weekly mileage for the bike
  async getWeeklyMileage(id: string, user: AuthenticatedUser) {
    const bike = await this.loadBikeOrThrow(id);
    if (user.fleetPlan === 'INSURANCE') {
      if (bike.insurerName !== user.insurerName) {
        throw new ForbiddenException('Access to this bike is denied');
      }
    } else {
      this.assertFleetAccess(bike.fleetId, user);
    }

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
}
