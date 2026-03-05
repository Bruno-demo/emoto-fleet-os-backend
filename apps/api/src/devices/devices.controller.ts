import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { AssignBikeDto } from './dto/assign-bike.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DevicesService, PublicDevice } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'List devices in caller fleet' })
  async listDevices(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicDevice[]> {
    return this.devicesService.listDevicesForUser(user);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({
    summary: 'Create device and return one-time provisioning secret',
  })
  async createDevice(
    @Body() dto: CreateDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ device: PublicDevice; deviceSecret: string }> {
    return this.devicesService.createDeviceForUser(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({
    summary: 'Get device by id with fleet isolation enforcement',
  })
  async getDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicDevice> {
    return this.devicesService.getDeviceForUser(id, user);
  }

  @Post(':id/assign-bike')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Assign a device to a bike in the same fleet' })
  async assignBike(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBikeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicDevice> {
    return this.devicesService.assignBikeForUser(id, dto, user);
  }

  @Post(':id/rotate-secret')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({
    summary: 'Rotate device secret and return new secret one-time',
  })
  async rotateSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deviceId: string; deviceUid: string; deviceSecret: string }> {
    return this.devicesService.rotateSecretForUser(id, user);
  }
}
