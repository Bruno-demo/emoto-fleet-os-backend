import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditActionType, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
@RequireSubscriptionFeature('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List audit logs for fleet' })
  async listAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
    @Query('actionType') actionType?: string,
  ) {
    const validActionType =
      actionType &&
      Object.values(AuditActionType).includes(actionType as AuditActionType)
        ? (actionType as AuditActionType)
        : undefined;

    return this.auditService.listAuditLogs(user.fleetId, {
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      actionType: validActionType,
    });
  }
}
