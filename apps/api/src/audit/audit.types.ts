import { AuditActionType, Prisma } from '@prisma/client';

export interface CreateAuditLogInput {
  fleetId: string;
  actorUserId?: string;
  actionType: AuditActionType;
  targetType: string;
  targetId?: string;
  metaJson?: Prisma.InputJsonValue;
}
