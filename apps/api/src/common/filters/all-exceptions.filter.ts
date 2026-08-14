import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string;
    if (
      errorResponse &&
      typeof errorResponse === 'object' &&
      errorResponse !== null &&
      'message' in errorResponse
    ) {
      const msg = errorResponse.message;
      message = Array.isArray(msg) ? msg.join(', ') : String(msg);
    } else if (exception instanceof Error) {
      message = exception.message;
    } else {
      message = 'Internal server error';
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Message: ${message}`,
      stack,
    );

    if (response.headersSent) {
      return;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: status >= 500 ? 'Internal Server Error' : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
