import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogInput } from './audit.types';

@Injectable()
export class AuditService {
  constructor(private readonly prismaService: PrismaService) {}

  // Persists fleet-scoped audit entries for privileged control-plane actions.
  async createAuditLog(input: CreateAuditLogInput): Promise<void> {
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
  }
}
