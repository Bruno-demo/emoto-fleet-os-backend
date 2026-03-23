import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { envSchema } from './config/env.schema';
import { IngestionWorkerModule } from './ingestion/ingestion-worker.module';
import { buildLoggerOptions } from './logger/logger-options';
import { WebhookDispatcherModule } from './webhooks/webhook-dispatcher.module';
import { WebhookDispatcherService } from './webhooks/webhook-dispatcher.service';

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
    WebhookDispatcherModule,
  ],
})
export class WorkerModule implements OnModuleInit {
  constructor(private readonly dispatcher: WebhookDispatcherService) {}

  // Ensures the webhook dispatcher is instantiated so the stream consumer starts.
  onModuleInit(): void {
    void this.dispatcher;
  }
}
