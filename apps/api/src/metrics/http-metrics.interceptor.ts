import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  // Records HTTP request count and latency for Prometheus metrics.
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationSeconds =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        const route = request.route as { path?: string | RegExp } | undefined;
        const routePath =
          typeof route?.path === 'string'
            ? `${request.baseUrl ?? ''}${route.path}`
            : (request.path ?? 'unknown');

        this.metricsService.recordHttpRequest(
          request.method ?? 'UNKNOWN',
          routePath,
          response.statusCode ?? 0,
          durationSeconds,
        );
      }),
    );
  }
}
