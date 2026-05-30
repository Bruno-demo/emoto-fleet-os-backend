import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommandsService } from '../commands/commands.service';
import { HqGuard } from './guards/hq.guard';
import { HqService } from './hq.service';

@ApiTags('HQ (Internal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HqGuard)
@Controller('hq')
export class HqController {
  constructor(
    private readonly hqService: HqService,
    private readonly commandsService: CommandsService,
  ) {}

  // ── Overview ──────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get global HQ metrics' })
  getStats() {
    return this.hqService.getStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get global platform health status' })
  getHealth() {
    return this.hqService.getHealth();
  }

  @Get('events')
  @ApiOperation({ summary: 'Get recent global platform events' })
  getEvents() {
    return this.hqService.getEvents();
  }

  // ── Fleets ────────────────────────────────────────────────────────

  @Get('fleets')
  @ApiOperation({ summary: 'List all fleets globally' })
  getFleets() {
    return this.hqService.getFleets();
  }

  @Get('fleets/:id')
  @ApiOperation({ summary: 'Get fleet details by ID' })
  getFleetById(@Param('id') id: string) {
    return this.hqService.getFleetById(id);
  }

  @Put('fleets/:id/plan')
  @ApiOperation({ summary: 'Change fleet plan' })
  updateFleetPlan(
    @Param('id') id: string,
    @Body() body: { plan: 'DEMO' | 'PREMIUM' },
  ) {
    return this.hqService.updateFleetPlan(id, body.plan);
  }

  @Put('fleets/:id/subscription')
  @ApiOperation({ summary: 'Update fleet subscription status' })
  updateFleetSubscription(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' },
  ) {
    return this.hqService.updateFleetSubscription(id, body.status);
  }

  @Delete('fleets/:id')
  @ApiOperation({ summary: 'Soft-delete a fleet (set all users to DISABLED)' })
  deleteFleet(@Param('id') id: string) {
    return this.hqService.softDeleteFleet(id);
  }

  @Put('bikes/:id/status')
  @ApiOperation({ summary: 'Change bike status' })
  updateBikeStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED' },
  ) {
    return this.hqService.updateBikeStatus(id, body.status);
  }

  @Post('fleets/:fleetId/bikes')
  @ApiOperation({ summary: 'Create a new bike for a fleet (HQ admin)' })
  createBikeForFleet(
    @Param('fleetId') fleetId: string,
    @Body()
    body: {
      label: string;
      plate?: string;
      serial?: string;
      model?: string;
      status?: any;
    },
  ) {
    return this.hqService.createBikeForFleet(fleetId, body);
  }

  @Put('bikes/:id')
  @ApiOperation({ summary: 'Update a bike details (HQ admin)' })
  updateBikeHq(
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      plate?: string;
      serial?: string;
      model?: string;
      status?: any;
    },
  ) {
    return this.hqService.updateBikeHq(id, body);
  }

  @Delete('bikes/:id')
  @ApiOperation({ summary: 'Delete a bike permanently (HQ admin)' })
  deleteBikeHq(@Param('id') id: string) {
    return this.hqService.deleteBikeHq(id);
  }

  @Post('bikes/:id/lock')
  @ApiOperation({
    summary: 'Send a remote LOCK command to any bike (HQ override)',
  })
  lockBike(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandsService.requestLockForBikeHq(id, user);
  }

  @Post('bikes/:id/unlock')
  @ApiOperation({
    summary: 'Send a remote UNLOCK command to any bike (HQ override)',
  })
  unlockBike(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commandsService.requestUnlockForBikeHq(id, user);
  }

  // ── Users ─────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users globally (paginated)' })
  getUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.hqService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      search,
      status,
      role,
    });
  }

  @Get('users/pending')
  @ApiOperation({ summary: 'List all users pending hardware setup' })
  getPendingUsers() {
    return this.hqService.getPendingUsers();
  }

  @Post('users/:id/activate')
  @ApiOperation({ summary: 'Activate a user pending setup' })
  activateUser(@Param('id') id: string) {
    return this.hqService.activateUser(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Change a user role' })
  updateUserRole(@Param('id') id: string, @Body() body: { role: string }) {
    return this.hqService.updateUserRole(id, body.role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate a user' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' },
  ) {
    return this.hqService.updateUserStatus(id, body.status);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user permanently' })
  deleteUser(@Param('id') id: string) {
    return this.hqService.deleteUser(id);
  }

  @Post('fleets/:fleetId/users')
  @ApiOperation({
    summary: 'Create a new operator/rider user for a fleet (HQ admin)',
  })
  createUserForFleet(
    @Param('fleetId') fleetId: string,
    @Body()
    body: {
      email?: string;
      phone?: string;
      role: any;
      status?: any;
      password?: string;
      fullName?: string;
    },
  ) {
    return this.hqService.createUserForFleet(fleetId, body);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update operator/rider user details (HQ admin)' })
  updateUserHq(
    @Param('id') id: string,
    @Body()
    body: {
      email?: string;
      phone?: string;
      role?: any;
      status?: any;
      fullName?: string;
    },
  ) {
    return this.hqService.updateUserHq(id, body);
  }

  // ── Partners ──────────────────────────────────────────────────────

  @Post('partners')
  @ApiOperation({ summary: 'Create a new API partner' })
  createPartner(@Body() body: { name: string }) {
    return this.hqService.createPartner(body.name);
  }

  @Get('partners')
  @ApiOperation({ summary: 'List all API partners globally' })
  getPartners() {
    return this.hqService.getPartners();
  }

  @Get('partners/:id')
  @ApiOperation({
    summary: 'Get partner details by ID with credentials and webhooks',
  })
  getPartnerById(@Param('id') id: string) {
    return this.hqService.getPartnerById(id);
  }

  @Post('partners/:id/credentials')
  @ApiOperation({ summary: 'Create API credential (client) for partner' })
  createPartnerCredential(
    @Param('id') partnerId: string,
    @Body() body: { clientId: string; scopes: string },
  ) {
    return this.hqService.createPartnerCredential(
      partnerId,
      body.clientId,
      body.scopes,
    );
  }

  @Delete('partners/:partnerId/credentials/:credentialId')
  @ApiOperation({ summary: 'Delete/revoke partner credential' })
  deletePartnerCredential(
    @Param('partnerId') partnerId: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.hqService.deletePartnerCredential(partnerId, credentialId);
  }

  @Post('partners/:id/webhooks')
  @ApiOperation({ summary: 'Create webhook endpoint for partner' })
  createWebhook(@Param('id') partnerId: string, @Body() body: { url: string }) {
    return this.hqService.createWebhook(partnerId, body.url);
  }

  @Put('webhooks/:id')
  @ApiOperation({ summary: 'Update webhook endpoint URL' })
  updateWebhook(@Param('id') webhookId: string, @Body() body: { url: string }) {
    return this.hqService.updateWebhook(webhookId, body.url);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  deleteWebhook(@Param('id') webhookId: string) {
    return this.hqService.deleteWebhook(webhookId);
  }

  // ── Audit Log ─────────────────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'Get global audit log (paginated)' })
  getAuditLog(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('fleetId') fleetId?: string,
    @Query('actionType') actionType?: string,
  ) {
    return this.hqService.getAuditLog({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 30,
      fleetId,
      actionType,
    });
  }

  // ── Incidents ─────────────────────────────────────────────────────

  @Get('incidents')
  @ApiOperation({
    summary: 'Get global incidents across all fleets (paginated)',
  })
  getIncidents(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('fleetId') fleetId?: string,
  ) {
    return this.hqService.getIncidents({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      status,
      fleetId,
    });
  }

  // ── Telemetry Events ──────────────────────────────────────────────

  @Get('telemetry-events')
  @ApiOperation({ summary: 'List all telemetry events globally (paginated)' })
  getTelemetryEvents(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('fleetId') fleetId?: string,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
  ) {
    return this.hqService.getTelemetryEvents({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      fleetId,
      type,
      severity,
    });
  }

  // ── Devices ────────────────────────────────────────────────────────

  @Get('devices')
  @ApiOperation({ summary: 'List all devices globally (paginated)' })
  getDevices(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('fleetId') fleetId?: string,
    @Query('status') status?: string,
    @Query('assigned') assigned?: string,
  ) {
    return this.hqService.getDevices({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      fleetId,
      status,
      assigned,
    });
  }

  @Post('devices/:id/assign-bike')
  @ApiOperation({ summary: 'Assign a bike to a device' })
  assignBikeToDevice(
    @Param('id') id: string,
    @Body() body: { bikeId: string },
  ) {
    return this.hqService.assignBikeToDevice(id, body.bikeId);
  }

  @Post('devices/:id/unassign-bike')
  @ApiOperation({ summary: 'Unassign bike from a device' })
  unassignBikeFromDevice(@Param('id') id: string) {
    return this.hqService.unassignBikeFromDevice(id);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Create a new global device identity' })
  createDevice(
    @Body() body: { deviceUid: string; imei?: string; fleetId: string },
  ) {
    return this.hqService.createDevice(body);
  }

  @Post('devices/:id/rotate-secret')
  @ApiOperation({ summary: 'Rotate the secret credentials of a device' })
  rotateDeviceSecret(@Param('id') id: string) {
    return this.hqService.rotateDeviceSecret(id);
  }

  // ── Insurers ──────────────────────────────────────────────────────

  @Get('insurers')
  @ApiOperation({ summary: 'List all insurers globally (paginated)' })
  getInsurers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.hqService.getInsurers({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      search,
    });
  }

  @Get('insurers/:id')
  @ApiOperation({ summary: 'Get insurer details by ID' })
  getInsurerById(@Param('id') id: string) {
    return this.hqService.getInsurerById(id);
  }

  @Post('insurers')
  @ApiOperation({ summary: 'Create a new insurer user' })
  createInsurer(
    @Body()
    body: {
      email?: string;
      phone?: string;
      password: string;
      fullName: string;
      fleetId: string;
    },
  ) {
    return this.hqService.createInsurer(body);
  }

  @Post('insurers/:id/assign-bike')
  @ApiOperation({ summary: 'Assign a bike to an insurer' })
  assignBikeToInsurer(
    @Param('id') id: string,
    @Body() body: { bikeId: string },
  ) {
    return this.hqService.assignBikeToInsurer(id, body.bikeId);
  }

  @Delete('insurers/:id/bikes/:bikeId')
  @ApiOperation({ summary: 'Remove a bike from an insurer' })
  unassignBikeFromInsurer(
    @Param('id') id: string,
    @Param('bikeId') bikeId: string,
  ) {
    return this.hqService.unassignBikeFromInsurer(id, bikeId);
  }

  // ── Monitoring ────────────────────────────────────────────────────

  @Get('monitoring/live')
  @ApiOperation({ summary: 'Get real-time infrastructure metrics' })
  getMonitoringLive() {
    return this.hqService.getMonitoringLive();
  }
}
