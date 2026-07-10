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
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { PaginatedResponse } from '../common/pagination';
import { PoiNearQueryDto } from './dto/poi-near-query.dto';
import { RiderEventsQueryDto } from './dto/rider-events-query.dto';
import { RiderSosDto } from './dto/rider-sos.dto';
import { RiderTripsQueryDto } from './dto/rider-trips-query.dto';
import { RiderWeeklyScoreQueryDto } from './dto/rider-weekly-score-query.dto';
import type {
  NearbyPoiSummary,
  RiderEventSummary,
  RiderMeResponse,
  RiderSosResponse,
  RiderTripDetail,
  RiderTripSummary,
  RiderWeeklyScoreResponse,
} from './riders.types';
import { RidersService } from './riders.service';

import { LiveBikeState } from '../ingestion/ingestion.types';
import { FleetDeviceCommand } from '../commands/commands.types';

import { RedisService } from '../redis/redis.service';

@ApiTags('rider')
@ApiBearerAuth()
@Controller('rider')
export class RiderController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly redisService: RedisService,
  ) {}

  @Get('me')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Return rider profile and active bike assignments' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<RiderMeResponse> {
    return this.ridersService.getRiderMe(user);
  }

  @Get('online')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Get current courier availability status' })
  async getOnline(@CurrentUser() user: AuthenticatedUser) {
    const status = await this.redisService.get(`rider:online:${user.id}`);
    return { online: status === 'ONLINE' };
  }

  @Post('online')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Update courier availability status' })
  async updateOnline(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { online: boolean },
  ) {
    const status = body.online ? 'ONLINE' : 'OFFLINE';
    await this.redisService.set(`rider:online:${user.id}`, status);
    return { online: body.online };
  }

  @Get('bikes/:id/state')
  @Roles(UserRole.RIDER)
  @RequireSubscriptionFeature('commands')
  @ApiOperation({ summary: 'Get live telemetry for an assigned bike' })
  async getBikeState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bikeId: string,
  ): Promise<LiveBikeState | null> {
    return this.ridersService.getRiderBikeState(user, bikeId);
  }

  @Post('bikes/:id/lock')
  @Roles(UserRole.RIDER)
  @RequireSubscriptionFeature('commands')
  @ApiOperation({ summary: 'Send lock command to personal bike' })
  async lockBike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bikeId: string,
  ): Promise<FleetDeviceCommand> {
    return this.ridersService.requestLock(user, bikeId);
  }

  @Post('bikes/:id/unlock')
  @Roles(UserRole.RIDER)
  @RequireSubscriptionFeature('commands')
  @ApiOperation({ summary: 'Send unlock command to personal bike' })
  async unlockBike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bikeId: string,
  ): Promise<FleetDeviceCommand> {
    return this.ridersService.requestUnlock(user, bikeId);
  }

  @Get('trips')
  @Roles(UserRole.RIDER)
  @ApiOperation({
    summary: 'List trips belonging only to the authenticated rider',
  })
  async listMyTrips(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RiderTripsQueryDto,
  ): Promise<PaginatedResponse<RiderTripSummary>> {
    return this.ridersService.listRiderTrips(user, query);
  }

  @Get('trips/:id')
  @Roles(UserRole.RIDER)
  @ApiOperation({
    summary: 'Load a rider trip with score breakdown and event counts',
  })
  async getMyTripDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) tripId: string,
  ): Promise<RiderTripDetail> {
    return this.ridersService.getRiderTripDetail(user, tripId);
  }

  @Get('events')
  @Roles(UserRole.RIDER)
  @ApiOperation({
    summary: 'List recent rider alerts for the active assigned bike',
  })
  async listMyRecentEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RiderEventsQueryDto,
  ): Promise<RiderEventSummary[]> {
    return this.ridersService.listRiderEvents(user, query);
  }

  @Get('score/weekly')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Return rider weekly score summary' })
  async weeklyScore(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RiderWeeklyScoreQueryDto,
  ): Promise<RiderWeeklyScoreResponse> {
    return this.ridersService.getRiderWeeklyScore(user, query);
  }

  @Get('poi/near')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Find nearby POIs for rider location context' })
  async nearbyPoi(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PoiNearQueryDto,
  ): Promise<NearbyPoiSummary[]> {
    return this.ridersService.getNearbyPoisForUser(user, query);
  }

  @Post('sos')
  @Roles(UserRole.RIDER)
  @ApiOperation({
    summary: 'Trigger SOS event and notify fleet emergency contacts',
  })
  async triggerSos(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RiderSosDto,
  ): Promise<RiderSosResponse> {
    return this.ridersService.triggerRiderSos(user, dto);
  }
}
