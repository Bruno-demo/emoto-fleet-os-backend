import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

// Resolves browser origins allowed to call the API for local dashboard and rider apps.
function resolveCorsOrigins(configService: ConfigService): string[] {
  const configuredOrigins = configService.get<string>('CORS_ORIGINS');
  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  const dashboardOrigins = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${3001 + index}`,
  );
  const riderOrigins = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${8081 + index}`,
  );

  return [...dashboardOrigins, ...riderOrigins, 'http://localhost:19006'];
}

// Bootstraps the HTTP server, global validation, and API documentation.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const allowedCorsOrigins = resolveCorsOrigins(configService);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  });

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

  const port = configService.get<number>('PORT', 3000);
  const publicUrl =
    configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${port}`;
  await app.listen(port, '0.0.0.0');

  logger.log(`API listening on ${publicUrl}`);
  logger.log(`Swagger docs available at ${publicUrl}/docs`);
  logger.log(`Prometheus metrics available at ${publicUrl}/metrics`);
}

void bootstrap();
