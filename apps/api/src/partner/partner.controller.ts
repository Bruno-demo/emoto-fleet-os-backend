import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PaginatedResponse } from '../common/pagination';
import { CurrentPartner } from './current-partner.decorator';
import { CreatePartnerWebhookDto } from './dto/create-partner-webhook.dto';
import { PartnerDateRangeDto } from './dto/partner-date-range.dto';
import { PartnerListTripsDto } from './dto/partner-list-trips.dto';
import { PartnerAuthGuard } from './partner-auth.guard';
import { PartnerService } from './partner.service';
import type {
  AuthenticatedPartner,
  PartnerEvidencePackSummary,
  PartnerIncidentDetails,
  PartnerTripSummary,
  PartnerWebhookRegistration,
  PartnerWeeklySummary,
} from './partner.types';

@ApiTags('partner')
@ApiBearerAuth()
@Public()
@UseGuards(PartnerAuthGuard)
@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get('fleets/:fleetId/weekly-summary')
  @ApiOperation({
    summary: 'Get partner-scoped fleet weekly summary (aggregated only)',
  })
  async getFleetWeeklySummary(
    @CurrentPartner() partner: AuthenticatedPartner,
    @Param('fleetId', ParseUUIDPipe) fleetId: string,
    @Query() query: PartnerDateRangeDto,
  ): Promise<PartnerWeeklySummary> {
    return this.partnerService.getWeeklySummaryForPartner(
      partner,
      fleetId,
      query,
    );
  }

  @Get('bikes/:bikeId/trips')
  @ApiOperation({
    summary: 'List partner-safe trip summaries for a fleet bike',
  })
  async listBikeTrips(
    @CurrentPartner() partner: AuthenticatedPartner,
    @Param('bikeId', ParseUUIDPipe) bikeId: string,
    @Query() query: PartnerListTripsDto,
  ): Promise<PaginatedResponse<PartnerTripSummary>> {
    return this.partnerService.listBikeTripsForPartner(partner, bikeId, query);
  }

  @Get('incidents/:incidentId')
  @ApiOperation({
    summary: 'Get incident metadata and event timeline for a partner',
  })
  async getIncident(
    @CurrentPartner() partner: AuthenticatedPartner,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ): Promise<PartnerIncidentDetails> {
    return this.partnerService.getIncidentForPartner(partner, incidentId);
  }

  @Get('incidents/:incidentId/evidence-pack')
  @ApiOperation({
    summary:
      'Generate incident evidence pack and return short-lived download URLs',
  })
  async getIncidentEvidencePack(
    @CurrentPartner() partner: AuthenticatedPartner,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ): Promise<PartnerEvidencePackSummary> {
    return this.partnerService.getIncidentEvidencePackForPartner(
      partner,
      incidentId,
    );
  }

  @Post('webhooks')
  @ApiOperation({
    summary: 'Register partner webhook callback endpoint',
  })
  async createWebhook(
    @CurrentPartner() partner: AuthenticatedPartner,
    @Body() dto: CreatePartnerWebhookDto,
  ): Promise<PartnerWebhookRegistration> {
    return this.partnerService.createWebhookForPartner(partner, dto);
  }
}
