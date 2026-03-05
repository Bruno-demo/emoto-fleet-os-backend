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
import { Bike, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../common/pagination';
import { CreateBikeDto } from './dto/create-bike.dto';
import { LockActionDto } from './dto/lock-action.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';
import { BikesService } from './bikes.service';

@ApiTags('bikes')
@ApiBearerAuth()
@Controller('bikes')
export class BikesController {
  constructor(private readonly bikesService: BikesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'List bikes in caller fleet' })
  async listBikes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Bike>> {
    return this.bikesService.listBikesForUser(user, query);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Create bike in caller fleet' })
  async createBike(
    @Body() dto: CreateBikeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Bike> {
    return this.bikesService.createBikeForUser(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Get bike by id with fleet isolation enforcement' })
  async getBike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Bike> {
    return this.bikesService.getBikeForUser(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Update bike in caller fleet' })
  async updateBike(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBikeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Bike> {
    return this.bikesService.updateBikeForUser(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Delete bike in caller fleet' })
  async deleteBike(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    await this.bikesService.deleteBikeForUser(id, user);
    return { deleted: true };
  }

  @Post(':id/lock-actions')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({
    summary:
      'Request bike lock action (audit only until lock integration exists)',
  })
  async requestLockAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ queued: false; message: string }> {
    return this.bikesService.requestBikeLockAction(id, dto, user);
  }
}
