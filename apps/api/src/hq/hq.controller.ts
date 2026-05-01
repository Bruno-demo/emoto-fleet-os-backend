import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
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
}
