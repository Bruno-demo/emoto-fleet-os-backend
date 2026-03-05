import { Controller, Get } from '@nestjs/common';
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
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
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
}
