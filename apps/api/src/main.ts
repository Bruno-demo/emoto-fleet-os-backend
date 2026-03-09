import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

// Bootstraps the HTTP server, global validation, and API documentation.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('eMoto Fleet OS API')
    .setDescription('Backend API for e-moto telematics')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const publicUrl = configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${port}`;
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on ${publicUrl}`);
  logger.log(`Swagger docs available at ${publicUrl}/docs`);
  logger.log(`Prometheus metrics available at ${publicUrl}/metrics`);
}

void bootstrap();
