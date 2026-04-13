import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

// Boots the ingestion worker without exposing an HTTP server.
async function bootstrap(): Promise<void> {
  await NestFactory.createApplicationContext(WorkerModule);
}

bootstrap().catch((error) => {
  console.error('Fatal: Worker bootstrap failed', error);
  process.exit(1);
});
