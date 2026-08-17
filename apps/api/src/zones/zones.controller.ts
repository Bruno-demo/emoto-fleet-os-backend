import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../common/pagination';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { FleetZone, ZonesService } from './zones.service';

@ApiTags('zones')
@ApiBearerAuth()
@Controller('zones')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.DISPATCHER)
@RequireSubscriptionFeature('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List geofence zones for caller fleet' })
  async listZones(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<FleetZone>> {
    return this.zonesService.listZonesForUser(user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a geofence zone' })
  async createZone(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateZoneDto,
  ): Promise<FleetZone> {
    return this.zonesService.createZoneForUser(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get geofence zone by id' })
  async getZone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FleetZone> {
    return this.zonesService.getZoneForUser(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update geofence zone' })
  async updateZone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateZoneDto,
  ): Promise<FleetZone> {
    return this.zonesService.updateZoneForUser(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete geofence zone' })
  async deleteZone(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.zonesService.deleteZoneForUser(id, user);
    return { deleted: true };
  }
}
