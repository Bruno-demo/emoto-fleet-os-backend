import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HqGuard } from './guards/hq.guard';
import { HqService } from './hq.service';

@ApiTags('HQ (Internal)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HqGuard)
@Controller('hq')
export class HqController {
  constructor(private readonly hqService: HqService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get global HQ metrics' })
  getStats() {
    return this.hqService.getStats();
  }

  @Get('fleets')
  @ApiOperation({ summary: 'List all fleets globally' })
  getFleets() {
    return this.hqService.getFleets();
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

  @Get('partners')
  @ApiOperation({ summary: 'List all API partners globally' })
  getPartners() {
    return this.hqService.getPartners();
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

  @Get('fleets/:id')
  @ApiOperation({ summary: 'Get fleet details by ID' })
  getFleetById(@Param('id') id: string) {
    return this.hqService.getFleetById(id);
  }

  @Get('partners/:id')
  @ApiOperation({ summary: 'Get partner details by ID with credentials and webhooks' })
  getPartnerById(@Param('id') id: string) {
    return this.hqService.getPartnerById(id);
  }

  @Post('partners/:id/credentials')
  @ApiOperation({ summary: 'Create API credential (client) for partner' })
  createPartnerCredential(
    @Param('id') partnerId: string,
    @Body() body: { clientId: string; scopes: string },
  ) {
    return this.hqService.createPartnerCredential(partnerId, body.clientId, body.scopes);
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
  createWebhook(
    @Param('id') partnerId: string,
    @Body() body: { url: string },
  ) {
    return this.hqService.createWebhook(partnerId, body.url);
  }

  @Put('webhooks/:id')
  @ApiOperation({ summary: 'Update webhook endpoint URL' })
  updateWebhook(
    @Param('id') webhookId: string,
    @Body() body: { url: string },
  ) {
    return this.hqService.updateWebhook(webhookId, body.url);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  deleteWebhook(@Param('id') webhookId: string) {
    return this.hqService.deleteWebhook(webhookId);
  }
}
