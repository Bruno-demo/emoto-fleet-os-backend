import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginatedResponse } from '../common/pagination';
import type { IncidentEvidencePackResponse } from '../evidence/evidence.types';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { IncidentStatusActionDto } from './dto/incident-status-action.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import type { FleetIncident } from './incidents.types';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({
    summary: 'List fleet incidents with optional status/date filters',
  })
  async listIncidents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListIncidentsDto,
  ): Promise<PaginatedResponse<FleetIncident>> {
    return this.incidentsService.listIncidentsForUser(user, query);
  }

  @Get('stats')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({ summary: 'Get incident stats for the caller fleet' })
  async getIncidentStats(@CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.getIncidentStatsForUser(user);
  }

  @Get(':id')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({ summary: 'Get one incident by id' })
  async getIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FleetIncident> {
    return this.incidentsService.getIncidentForUser(user, id);
  }

  @Get(':id/evidence-pack')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @RequireSubscriptionFeature('evidence')
  @ApiOperation({
    summary:
      'Generate incident evidence pack and return short-lived download URLs',
  })
  async getIncidentEvidencePack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IncidentEvidencePackResponse> {
    return this.incidentsService.getIncidentEvidencePackForUser(user, id);
  }

  @Post(':id/acknowledge')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({ summary: 'Acknowledge an open incident' })
  async acknowledgeIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    return this.incidentsService.acknowledgeIncidentForUser(user, id, dto);
  }

  @Post(':id/resolve')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({ summary: 'Resolve an acknowledged incident' })
  async resolveIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    return this.incidentsService.resolveIncidentForUser(user, id, dto);
  }

  @Post(':id/false-alarm')
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
  )
  @ApiOperation({ summary: 'Mark an incident as false alarm' })
  async markIncidentFalseAlarm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IncidentStatusActionDto,
  ): Promise<FleetIncident> {
    return this.incidentsService.markIncidentFalseAlarmForUser(user, id, dto);
  }
}
