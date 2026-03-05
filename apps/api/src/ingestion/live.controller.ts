import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { LiveBikeState } from './ingestion.types';
import { LiveStateService } from './live-state.service';

@ApiTags('live')
@ApiBearerAuth()
@Controller('live')
export class LiveController {
  constructor(private readonly liveStateService: LiveStateService) {}

  @Get('bikes')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Get latest bike states for caller fleet' })
  async getFleetLiveBikes(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LiveBikeState[]> {
    return this.liveStateService.getFleetBikeStates(user.fleetId);
  }
}
