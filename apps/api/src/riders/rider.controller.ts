import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginatedResponse } from '../common/pagination';
import { PoiNearQueryDto } from './dto/poi-near-query.dto';
import { RiderSosDto } from './dto/rider-sos.dto';
import { RiderTripsQueryDto } from './dto/rider-trips-query.dto';
import { RiderWeeklyScoreQueryDto } from './dto/rider-weekly-score-query.dto';
import type {
  NearbyPoiSummary,
  RiderMeResponse,
  RiderSosResponse,
  RiderTripSummary,
  RiderWeeklyScoreResponse,
} from './riders.types';
import { RidersService } from './riders.service';

@ApiTags('rider')
@ApiBearerAuth()
@Controller('rider')
export class RiderController {
  constructor(private readonly ridersService: RidersService) {}

  @Get('me')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Return rider profile and active bike assignments' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<RiderMeResponse> {
    return this.ridersService.getRiderMe(user);
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
