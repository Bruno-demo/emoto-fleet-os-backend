import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

const logger = new Logger('WorkerBootstrap');

// Boots the ingestion & webhook worker without exposing an HTTP server.
async function bootstrap(): Promise<void> {
  logger.log('Bootstrapping E-Moto Fleet OS Ingestion & Webhook Worker...');

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });

  app.enableShutdownHooks();

  logger.log('E-Moto Fleet OS Worker started and actively processing streams.');

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Gracefully shutting down worker...`);
    try {
      await app.close();
      logger.log('Worker closed cleanly.');
      process.exit(0);
    } catch (err: unknown) {
      logger.error('Error during worker shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled Promise Rejection in Worker: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`,
    );
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception in Worker: ${err.stack || err.message}`);
  });
}

bootstrap().catch((error: unknown) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error);
  console.error('Fatal: Worker bootstrap failed:\n', msg);
  process.exit(1);
});
