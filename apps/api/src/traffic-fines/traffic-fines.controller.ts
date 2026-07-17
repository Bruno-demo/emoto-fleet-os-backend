import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrafficFinesService } from './traffic-fines.service';
import { CreateTrafficFineDto } from './dto/create-traffic-fine.dto';
import { UpdateTrafficFineDto } from './dto/update-traffic-fine.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('traffic-fines')
@Controller('traffic-fines')
export class TrafficFinesController {
  constructor(private readonly trafficFinesService: TrafficFinesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Record a new traffic fine' })
  async create(
    @Body() dto: CreateTrafficFineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trafficFinesService.createFine(user.fleetId, dto, user);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.RIDER)
  @ApiOperation({ summary: 'List traffic fines' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('riderId') riderId?: string,
    @Query('status') status?: string,
  ) {
    // Security check: riders can only see their own traffic fines
    const effectiveRiderId = user.role === UserRole.RIDER ? user.id : riderId;
    return this.trafficFinesService.listFines(user.fleetId, {
      riderId: effectiveRiderId,
      status,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get details of a specific traffic fine' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fine = await this.trafficFinesService.getFineById(user.fleetId, id);
    // Security check: riders can only see their own traffic fines
    if (user.role === UserRole.RIDER && fine.riderId !== user.id) {
      throw new NotFoundException('Traffic fine not found');
    }
    return fine;
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update/transition a traffic fine' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrafficFineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trafficFinesService.updateFine(user.fleetId, id, dto, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a traffic fine' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.trafficFinesService.deleteFine(user.fleetId, id, user);
  }
}

// Simple placeholder fallback for NotFoundException if not imported from common
import { NotFoundException } from '@nestjs/common';
