import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { envSchema } from './config/env.schema';
import { IngestionWorkerModule } from './ingestion/ingestion-worker.module';
import { buildLoggerOptions } from './logger/logger-options';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      // Validates required environment variables before booting the worker.
      validate: (env) => envSchema.parse(env),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildLoggerOptions(configService),
    }),
    IngestionWorkerModule,
  ],
})
export class WorkerModule {}
