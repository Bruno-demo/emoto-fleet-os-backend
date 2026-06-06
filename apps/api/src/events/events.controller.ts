import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { PaginatedResponse } from '../common/pagination';
import { ListEventsDto } from './dto/list-events.dto';
import { EventsService } from './events.service';
import { FleetEvent } from './events.types';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.TECH,
    UserRole.RIDER,
    UserRole.INSURER,
  )
  @ApiOperation({ summary: 'List fleet events with optional filters' })
  async listEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEventsDto,
  ): Promise<PaginatedResponse<FleetEvent>> {
    return this.eventsService.listEventsForUser(user, query);
  }
}
