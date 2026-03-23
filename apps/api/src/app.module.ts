import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { buildLoggerOptions } from './logger/logger-options';
import { MetricsModule } from './metrics/metrics.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { RidersModule } from './riders/riders.module';
import { RoadsModule } from './roads/roads.module';
import { TripsModule } from './trips/trips.module';
import { ZonesModule } from './zones/zones.module';

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
    RoadsModule,
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
