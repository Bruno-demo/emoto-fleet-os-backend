import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  // Exposes Prometheus metrics for scraping.  The endpoint is public so that
  // the internal Prometheus scraper can reach it without a JWT.  External
  // access is blocked at the gateway layer in production.
  @Get()
  @Public()
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
