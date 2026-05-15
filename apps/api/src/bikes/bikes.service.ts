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
  ): Promise<PaginatedResponse<Bike>> {
    const pagination = getPaginationParams(query);
    const where: Prisma.BikeWhereInput = { fleetId: user.fleetId };

    const [bikes, total] = await Promise.all([
      this.prismaService.bike.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
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
      return await this.prismaService.bike.create({
        data: {
          fleetId: user.fleetId,
          label: dto.label,
          plate: dto.plate,
          serial: dto.serial,
          model: dto.model,
          status: dto.status ?? 'ACTIVE',
        },
      });
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
  async getBikeForUser(id: string, user: AuthenticatedUser): Promise<Bike> {
    const bike = await this.loadBikeOrThrow(id);

    this.assertFleetAccess(bike.fleetId, user);

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
      return await this.prismaService.bike.update({
        where: { id },
        data: {
          label: dto.label,
          plate: dto.plate,
          serial: dto.serial,
          model: dto.model,
          status: dto.status,
          ...(dto.insurerUserId !== undefined ? { insurerUserId: dto.insurerUserId } : {}),
        },
      });
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
  private async loadBikeOrThrow(id: string): Promise<Bike> {
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
}
