import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LiveStateService } from '../ingestion/live-state.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AuditActionType, DeliveryStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly liveStateService: LiveStateService,
  ) {}

  async createDelivery(
    fleetId: string,
    dto: CreateDeliveryDto,
    actor: AuthenticatedUser,
  ) {
    const delivery = await this.prisma.delivery.create({
      data: {
        fleetId,
        orderNumber: dto.orderNumber,
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffAddress: dto.dropoffAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        notes: dto.notes,
        status: DeliveryStatus.PENDING,
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DELIVERY_CREATED,
      targetType: 'DELIVERY',
      targetId: delivery.id,
      metaJson: {
        orderNumber: delivery.orderNumber,
        customerName: delivery.customerName,
      },
    });

    return delivery;
  }

  async listDeliveries(
    fleetId: string,
    query: { status?: DeliveryStatus; riderId?: string },
  ) {
    const where: {
      fleetId: string;
      status?: DeliveryStatus;
      riderId?: string;
    } = { fleetId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.riderId) {
      where.riderId = query.riderId;
    }

    return this.prisma.delivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    });
  }

  async getDelivery(fleetId: string, id: string, actor?: AuthenticatedUser) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, fleetId },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    if (
      actor &&
      actor.role === UserRole.RIDER &&
      delivery.riderId !== actor.id
    ) {
      throw new NotFoundException('Delivery not found');
    }
    return delivery;
  }

  async assignDelivery(
    fleetId: string,
    id: string,
    dto: AssignDeliveryDto,
    actor: AuthenticatedUser,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, fleetId },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    // Prevent assignment if delivery is in terminal state
    if (
      delivery.status === DeliveryStatus.DELIVERED ||
      delivery.status === DeliveryStatus.FAILED
    ) {
      throw new BadRequestException(
        'Cannot assign a delivery in a terminal state',
      );
    }

    // Verify rider exists and is in the same fleet
    const riderUser = await this.prisma.user.findFirst({
      where: { id: dto.riderId, fleetId, role: UserRole.RIDER },
    });
    if (!riderUser) {
      throw new BadRequestException('Rider not found in this fleet');
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: {
        riderId: dto.riderId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
      },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DELIVERY_ASSIGNED,
      targetType: 'DELIVERY',
      targetId: id,
      metaJson: {
        orderNumber: updated.orderNumber,
        riderId: dto.riderId,
      },
    });

    return updated;
  }

  async updateDeliveryStatus(
    fleetId: string,
    id: string,
    dto: UpdateDeliveryStatusDto,
    actor: AuthenticatedUser,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id, fleetId },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    // Enforce rider security check: riders can only update deliveries assigned to them
    if (actor.role === UserRole.RIDER && delivery.riderId !== actor.id) {
      throw new BadRequestException(
        'You can only update status of deliveries assigned to you',
      );
    }

    const currentStatus = delivery.status;
    const nextStatus = dto.status;

    // Define valid transitions
    const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [
        DeliveryStatus.ASSIGNED,
        DeliveryStatus.FAILED,
      ],
      [DeliveryStatus.ASSIGNED]: [
        DeliveryStatus.PENDING,
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.FAILED,
      ],
      [DeliveryStatus.PICKED_UP]: [
        DeliveryStatus.IN_TRANSIT,
        DeliveryStatus.DELIVERED,
        DeliveryStatus.FAILED,
      ],
      [DeliveryStatus.IN_TRANSIT]: [
        DeliveryStatus.DELIVERED,
        DeliveryStatus.FAILED,
      ],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [],
    };

    if (currentStatus !== nextStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        throw new BadRequestException(
          `Invalid status transition from ${currentStatus} to ${nextStatus}`,
        );
      }
    }

    const data: {
      status: DeliveryStatus;
      notes?: string | null;
      pickedUpAt?: Date;
      inTransitAt?: Date;
      deliveredAt?: Date;
      proofPhotoUrl?: string;
      proofSignature?: string;
      failedAt?: Date;
      failureReason?: string;
    } = {
      status: dto.status,
      notes: dto.notes ?? delivery.notes,
    };

    if (dto.status === DeliveryStatus.PICKED_UP) {
      data.pickedUpAt = new Date();
    } else if (dto.status === DeliveryStatus.IN_TRANSIT) {
      data.inTransitAt = new Date();
    } else if (dto.status === DeliveryStatus.DELIVERED) {
      data.deliveredAt = new Date();
      data.proofPhotoUrl = dto.proofPhotoUrl;
      data.proofSignature = dto.proofSignature;
    } else if (dto.status === DeliveryStatus.FAILED) {
      data.failedAt = new Date();
      data.failureReason = dto.failureReason;
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data,
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: actor.id,
      actionType: AuditActionType.DELIVERY_STATUS_CHANGED,
      targetType: 'DELIVERY',
      targetId: id,
      metaJson: {
        orderNumber: updated.orderNumber,
        oldStatus: delivery.status,
        newStatus: dto.status,
      },
    });

    return updated;
  }

  async getPublicDelivery(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        rider: {
          select: {
            id: true,
            email: true,
            phone: true,
            riderProfile: {
              select: { fullName: true },
            },
          },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    let liveState = null;
    let bike = null;

    if (delivery.riderId) {
      const activeAssignment = await this.prisma.bikeAssignment.findFirst({
        where: { riderUserId: delivery.riderId, active: true },
        include: {
          bike: true,
        },
      });

      if (activeAssignment) {
        bike = {
          id: activeAssignment.bike.id,
          label: activeAssignment.bike.label,
          plate: activeAssignment.bike.plate,
        };

        // Query the live state
        const state = await this.liveStateService.getBikeState(
          delivery.fleetId,
          activeAssignment.bikeId,
        );
        if (state) {
          liveState = {
            lat: state.lat,
            lng: state.lng,
            speedKph: state.speedKph,
            ts: state.ts,
          };
        }
      }
    }

    return {
      delivery: {
        id: delivery.id,
        orderNumber: delivery.orderNumber,
        pickupAddress: delivery.pickupAddress,
        pickupLat: Number(delivery.pickupLat),
        pickupLng: Number(delivery.pickupLng),
        dropoffAddress: delivery.dropoffAddress,
        dropoffLat: Number(delivery.dropoffLat),
        dropoffLng: Number(delivery.dropoffLng),
        customerName: delivery.customerName,
        status: delivery.status,
        failureReason: delivery.failureReason,
        proofPhotoUrl: delivery.proofPhotoUrl,
        notes: delivery.notes,
        assignedAt: delivery.assignedAt,
        pickedUpAt: delivery.pickedUpAt,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        createdAt: delivery.createdAt,
      },
      riderName: delivery.rider?.riderProfile?.fullName ?? null,
      bike,
      liveState,
    };
  }
}
