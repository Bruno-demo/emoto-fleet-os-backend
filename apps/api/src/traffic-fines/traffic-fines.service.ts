import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrafficFineDto } from './dto/create-traffic-fine.dto';
import { UpdateTrafficFineDto } from './dto/update-traffic-fine.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { AuditActionType, Prisma } from '@prisma/client';

@Injectable()
export class TrafficFinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createFine(
    fleetId: string,
    dto: CreateTrafficFineDto,
    user: AuthenticatedUser,
  ) {
    // Verify that the rider exists and belongs to the fleet
    const rider = await this.prisma.user.findFirst({
      where: {
        id: dto.riderId,
        fleetId,
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found in this fleet');
    }

    // Verify unique ticket number for this fleet
    const existing = await this.prisma.trafficFine.findFirst({
      where: {
        fleetId,
        ticketNumber: dto.ticketNumber,
      },
    });

    if (existing) {
      throw new BadRequestException('Ticket number already registered');
    }

    const fine = await this.prisma.trafficFine.create({
      data: {
        fleetId,
        riderId: dto.riderId,
        amount: dto.amount,
        reason: dto.reason,
        ticketNumber: dto.ticketNumber,
        finedAt: new Date(dto.finedAt),
        status: 'PENDING',
      },
      include: {
        rider: {
          select: {
            phone: true,
            email: true,
            riderProfile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.TRAFFIC_FINE_CREATED,
      targetType: 'TRAFFIC_FINE',
      targetId: fine.id,
      metaJson: {
        ticketNumber: fine.ticketNumber,
        riderId: fine.riderId,
        amount: fine.amount,
      },
    });

    return fine;
  }

  async listFines(
    fleetId: string,
    filters: { riderId?: string; status?: string },
  ) {
    return this.prisma.trafficFine.findMany({
      where: {
        fleetId,
        ...(filters.riderId && { riderId: filters.riderId }),
        ...(filters.status && { status: filters.status }),
      },
      include: {
        rider: {
          select: {
            id: true,
            phone: true,
            email: true,
            riderProfile: {
              select: {
                fullName: true,
              },
            },
            bikeAssignments: {
              where: {
                active: true,
              },
              include: {
                bike: {
                  select: {
                    label: true,
                    plate: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        finedAt: 'desc',
      },
    });
  }

  async getFineById(fleetId: string, id: string) {
    const fine = await this.prisma.trafficFine.findFirst({
      where: {
        id,
        fleetId,
      },
      include: {
        rider: {
          select: {
            id: true,
            phone: true,
            email: true,
            riderProfile: {
              select: {
                fullName: true,
              },
            },
            bikeAssignments: {
              where: {
                active: true,
              },
              include: {
                bike: {
                  select: {
                    label: true,
                    plate: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!fine) {
      throw new NotFoundException('Traffic fine not found');
    }

    return fine;
  }

  async updateFine(
    fleetId: string,
    id: string,
    dto: UpdateTrafficFineDto,
    user: AuthenticatedUser,
  ) {
    const fine = await this.getFineById(fleetId, id);

    if (dto.ticketNumber && dto.ticketNumber !== fine.ticketNumber) {
      const existing = await this.prisma.trafficFine.findFirst({
        where: {
          fleetId,
          ticketNumber: dto.ticketNumber,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException('Ticket number already registered');
      }
    }

    const updatedPaidAt =
      dto.status === 'PAID' && fine.status !== 'PAID'
        ? dto.paidAt
          ? new Date(dto.paidAt)
          : new Date()
        : dto.status === 'PENDING'
          ? null
          : fine.paidAt;

    const updated = await this.prisma.trafficFine.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        ...(dto.ticketNumber !== undefined && {
          ticketNumber: dto.ticketNumber,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.finedAt !== undefined && { finedAt: new Date(dto.finedAt) }),
        paidAt: updatedPaidAt,
      },
      include: {
        rider: {
          select: {
            phone: true,
            email: true,
            riderProfile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.TRAFFIC_FINE_UPDATED,
      targetType: 'TRAFFIC_FINE',
      targetId: id,
      metaJson: {
        fineId: id,
        changes: JSON.parse(JSON.stringify(dto)) as Prisma.JsonObject,
      },
    });

    return updated;
  }

  async deleteFine(fleetId: string, id: string, user: AuthenticatedUser) {
    const fine = (await this.getFineById(fleetId, id)) as {
      ticketNumber: string;
      amount: number;
    };

    await this.prisma.trafficFine.delete({
      where: { id },
    });

    await this.auditService.createAuditLog({
      fleetId,
      actorUserId: user.id,
      actionType: AuditActionType.TRAFFIC_FINE_DELETED,
      targetType: 'TRAFFIC_FINE',
      targetId: id,
      metaJson: {
        fineId: id,
        ticketNumber: fine.ticketNumber,
        amount: fine.amount,
      },
    });

    return { success: true };
  }
}
