import { Injectable } from '@nestjs/common';
import { AuditActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../common/pagination';
import { CreateAuditLogInput } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  async createAuditLog(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.prismaService.auditLog.create({
        data: {
          fleetId: input.fleetId,
          actorUserId: input.actorUserId,
          actionType: input.actionType,
          targetType: input.targetType,
          targetId: input.targetId,
          metaJson: input.metaJson ?? {},
        },
      });
    } catch (err) {
      // Non-critical audit logging failure fallback (e.g. un-migrated enum value on DB)
      console.warn(
        `[AuditService] Non-critical audit log skipped for action '${input.actionType}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async listAuditLogs(
    fleetId: string,
    options: {
      page: number;
      pageSize: number;
      actionType?: AuditActionType;
    },
  ): Promise<PaginatedResponse<unknown>> {
    const where: Record<string, unknown> = { fleetId };
    if (options.actionType) {
      where.actionType = options.actionType;
    }

    const [data, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: {
          actorUser: {
            select: { id: true, email: true, phone: true },
          },
        },
      }),
      this.prismaService.auditLog.count({ where }),
    ]);

    return createPaginatedResponse(
      data.map((log) => ({
        ...log,
        id: String(log.id),
      })),
      total,
      options.page,
      options.pageSize,
    );
  }
}
