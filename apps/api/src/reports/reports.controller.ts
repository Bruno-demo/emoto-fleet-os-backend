import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RequireSubscriptionFeature } from '../subscription/subscription-feature.decorator';
import { ReportsService } from './reports.service';
import { WeeklyReport } from './reports.types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@RequireSubscriptionFeature('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.TECH)
  @ApiOperation({ summary: 'Weekly fleet risk report and scoring summary' })
  async getWeeklyReport(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WeeklyReport> {
    return this.reportsService.getWeeklyReport(user);
  }
}
