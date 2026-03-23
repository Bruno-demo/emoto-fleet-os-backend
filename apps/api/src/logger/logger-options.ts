import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

type RequestWithId = IncomingMessage & {
  id?: string | number | object;
  method?: string;
  url?: string;
  socket?: { remoteAddress?: string };
};

type ResponseWithStatus = ServerResponse & {
  statusCode?: number;
};

// Builds the structured logger configuration with request correlation IDs.
export const buildLoggerOptions = (configService: ConfigService) => {
  const logPretty = configService.get<boolean>('LOG_PRETTY', false);

  return {
    pinoHttp: {
      level: configService.get<string>('LOG_LEVEL', 'info'),
      transport: logPretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              singleLine: true,
            },
          }
        : undefined,
      // Ensures each request has a stable x-request-id and injects it into logs.
      genReqId: (
        req: IncomingMessage,
        res: ServerResponse<IncomingMessage>,
      ) => {
        const request = req as RequestWithId;
        const response = res as ResponseWithStatus;
        const headerValue = request.headers?.['x-request-id'];
        const candidate = Array.isArray(headerValue)
          ? headerValue[0]
          : headerValue;
        const incomingId =
          typeof candidate === 'string' && candidate.trim().length > 0
            ? candidate.trim()
            : undefined;
        const requestId = incomingId ?? randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      // Scrubs PII or secrets from structured request logs.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.set-cookie',
          'req.body.password',
          'req.body.phone',
          'req.body.email',
        ],
        censor: '[REDACTED]',
      },
      // Keeps request logs concise and PII-safe.
      serializers: {
        req: (req: RequestWithId) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.socket?.remoteAddress,
        }),
        res: (res: ResponseWithStatus) => ({
          statusCode: res.statusCode,
        }),
      },
      // Adds requestId to log payloads for correlation.
      customProps: (req: RequestWithId) => ({
        requestId: req.id,
      }),
    },
  };
};
