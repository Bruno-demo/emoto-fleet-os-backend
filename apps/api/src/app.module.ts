import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BikesModule } from './bikes/bikes.module';
import { CommandsModule } from './commands/commands.module';
import { envSchema } from './config/env.schema';
import { DevicesModule } from './devices/devices.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { MetricsModule } from './metrics/metrics.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { RidersModule } from './riders/riders.module';
import { TripsModule } from './trips/trips.module';
import { ZonesModule } from './zones/zones.module';

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
const buildLoggerOptions = (configService: ConfigService) => {
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      // Validates required environment variables before booting the app.
      validate: (env) => envSchema.parse(env),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 1_000,
      },
    ]),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildLoggerOptions(configService),
    }),
    MetricsModule,
    AuditModule,
    AuthModule,
    BikesModule,
    CommandsModule,
    DevicesModule,
    EventsModule,
    ZonesModule,
    TripsModule,
    ReportsModule,
    RidersModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    IngestionModule,
    PartnerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
