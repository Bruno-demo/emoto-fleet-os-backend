import { Controller, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { CommandsService } from './commands.service';
import { DeviceCommandQueryDto } from './dto/device-command-query.dto';
import { FleetDeviceCommand } from './commands.types';

@ApiTags('commands')
@ApiBearerAuth()
@Controller('commands')
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post('lock')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Request a remote LOCK command for a fleet bike' })
  async requestLock(
    @Query() query: DeviceCommandQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.commandsService.requestLockForBike(query.bikeId, user);
  }

  @Post('unlock')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.TECH)
  @ApiOperation({ summary: 'Request a remote UNLOCK command for a fleet bike' })
  async requestUnlock(
    @Query() query: DeviceCommandQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FleetDeviceCommand> {
    return this.commandsService.requestUnlockForBike(query.bikeId, user);
  }
}
