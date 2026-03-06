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
import { PaginatedResponse } from '../common/pagination';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreatePoiDto } from './dto/create-poi.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { ListAssignmentsDto } from './dto/list-assignments.dto';
import { ListPoiDto } from './dto/list-poi.dto';
import { ListRidersDto } from './dto/list-riders.dto';
import { PoiNearQueryDto } from './dto/poi-near-query.dto';
import { UpdatePoiDto } from './dto/update-poi.dto';
import type {
  AssignmentSummary,
  NearbyPoiSummary,
  PoiSummary,
  RiderSummary,
} from './riders.types';
import { RidersService } from './riders.service';

@ApiTags('riders')
@ApiBearerAuth()
@Controller()
export class RidersAdminController {
  constructor(private readonly ridersService: RidersService) {}

  @Post('riders')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({
    summary: 'Create rider user/profile and optionally assign a bike',
  })
  async createRider(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRiderDto,
  ): Promise<RiderSummary> {
    return this.ridersService.createRiderForUser(user, dto);
  }

  @Get('riders')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'List riders in caller fleet' })
  async listRiders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRidersDto,
  ): Promise<PaginatedResponse<RiderSummary>> {
    return this.ridersService.listRidersForUser(user, query);
  }

  @Post('assignments')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({
    summary:
      'Assign rider to bike and auto-unassign previous active bike assignment',
  })
  async createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentSummary> {
    return this.ridersService.createAssignmentForUser(user, dto);
  }

  @Get('assignments')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'List bike assignments with optional filters' })
  async listAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAssignmentsDto,
  ): Promise<PaginatedResponse<AssignmentSummary>> {
    return this.ridersService.listAssignmentsForUser(user, query);
  }

  @Post('poi')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Create fleet/global POI (global only for OWNER)' })
  async createPoi(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePoiDto,
  ): Promise<PoiSummary> {
    return this.ridersService.createPoiForUser(user, dto);
  }

  @Get('poi')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'List fleet and global POIs' })
  async listPoi(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPoiDto,
  ): Promise<PaginatedResponse<PoiSummary>> {
    return this.ridersService.listPoisForUser(user, query);
  }

  @Get('poi/near')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Find nearby POIs by distance from coordinates' })
  async nearPoi(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PoiNearQueryDto,
  ): Promise<NearbyPoiSummary[]> {
    return this.ridersService.getNearbyPoisForUser(user, query);
  }

  @Get('poi/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Get POI by id' })
  async getPoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) poiId: string,
  ): Promise<PoiSummary> {
    return this.ridersService.getPoiForUser(user, poiId);
  }

  @Patch('poi/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Update POI by id' })
  async updatePoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) poiId: string,
    @Body() dto: UpdatePoiDto,
  ): Promise<PoiSummary> {
    return this.ridersService.updatePoiForUser(user, poiId, dto);
  }

  @Delete('poi/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Delete POI by id' })
  async deletePoi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) poiId: string,
  ): Promise<{ deleted: true; id: string }> {
    return this.ridersService.deletePoiForUser(user, poiId);
  }
}
