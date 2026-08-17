import { Controller, ForbiddenException, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';
import { HealthResponse } from './health.types';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Returns service health and dependency checks' })
  @ApiOkResponse({
    description: 'Dependencies are reachable.',
    schema: {
      example: {
        status: 'ok',
        checks: {
          db: 'up',
          redis: 'up',
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more dependencies are unavailable.',
  })
  // Returns runtime health state for database and Redis dependencies.
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.check();
  }

  @Get('healthz')
  @Public()
  @ApiOperation({ summary: 'Returns liveness check status directly' })
  @ApiOkResponse({
    description: 'Service is alive.',
    schema: {
      example: {
        status: 'ok',
      },
    },
  })
  getLiveness() {
    return { status: 'ok' };
  }

  @Get('health/simulate-fail')
  @Public()
  @ApiOperation({
    summary:
      'Simulates health check failure for 3 minutes for failover testing',
  })
  simulateFail() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not allowed in production');
    }
    return this.healthService.simulateFail();
  }
}
