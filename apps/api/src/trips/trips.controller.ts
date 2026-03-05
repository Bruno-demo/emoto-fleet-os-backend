import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { ListTripsDto } from './dto/list-trips.dto';
import { TripsService } from './trips.service';
import { FleetTrip } from './trips.types';

@ApiTags('trips')
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('bikes/:id/trips')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'List trips for a bike in caller fleet' })
  async listBikeTrips(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bikeId: string,
    @Query() query: ListTripsDto,
  ): Promise<FleetTrip[]> {
    return this.tripsService.listBikeTripsForUser(user, bikeId, query);
  }

  @Get('trips/:id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Get one trip by id' })
  async getTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) tripId: string,
  ): Promise<FleetTrip> {
    return this.tripsService.getTripForUser(user, tripId);
  }
}
