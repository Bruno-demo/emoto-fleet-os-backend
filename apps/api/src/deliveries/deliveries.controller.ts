import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { DeliveryStatus, UserRole, FleetType } from '@prisma/client';

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create a new delivery order' })
  async create(
    @Body() dto: CreateDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    return this.deliveriesService.createDelivery(user.fleetId, dto, user);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.RIDER)
  @ApiOperation({ summary: 'List fleet deliveries' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: DeliveryStatus,
    @Query('riderId') riderId?: string,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    // Security check: riders can only see their own deliveries
    const effectiveRiderId = user.role === UserRole.RIDER ? user.id : riderId;
    return this.deliveriesService.listDeliveries(user.fleetId, {
      status,
      riderId: effectiveRiderId,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.RIDER)
  @ApiOperation({ summary: 'Get details of a specific delivery' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    return this.deliveriesService.getDelivery(user.fleetId, id, user);
  }

  @Put(':id/assign')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Assign a rider to a delivery' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    return this.deliveriesService.assignDelivery(user.fleetId, id, dto, user);
  }

  @Post(':id/auto-assign')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({
    summary: 'Auto-assign the closest available rider to a delivery',
  })
  async autoAssign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    return this.deliveriesService.autoAssignDelivery(user.fleetId, id, user);
  }

  @Put(':id/status')
  @ApiBearerAuth()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.RIDER)
  @ApiOperation({
    summary: 'Update the status and proof details of a delivery',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.fleetType !== FleetType.DELIVERY) {
      throw new ForbiddenException(
        'Delivery features are only available for delivery fleets',
      );
    }
    return this.deliveriesService.updateDeliveryStatus(
      user.fleetId,
      id,
      dto,
      user,
    );
  }

  @Get('public/:id/track')
  @Public()
  @ApiOperation({ summary: 'Public tracking endpoint for customers' })
  async publicTrack(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveriesService.getPublicDelivery(id);
  }
}
