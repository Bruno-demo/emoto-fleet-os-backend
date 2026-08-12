import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import {
  json,
  urlencoded,
  type Request,
  type Response,
  type NextFunction,
  type Application,
} from 'express';
import { AppModule } from './app.module';

// Resolves browser origins allowed to call the API for local dashboard and rider apps.
function resolveCorsOrigins(configService: ConfigService): string[] {
  const configuredOrigins = configService.get<string>('CORS_ORIGINS');
  const userOrigins = configuredOrigins
    ? configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : [];

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'https://gateway.emotofleet.com',
    'https://dashboard.emotofleet.com',
    'https://emotofleet.com',
    'https://www.emotofleet.com',
  ];

  const dashboardOrigins = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${3001 + index}`,
  );
  const riderOrigins = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${8081 + index}`,
  );

  return Array.from(
    new Set([...userOrigins, ...defaultOrigins, ...dashboardOrigins, ...riderOrigins, 'http://localhost:19006']),
  );
}

import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';

// Bootstraps the HTTP server, global validation, and API documentation.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
    { bufferLogs: true },
  );
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());
  app.use(helmet());

  // Trust the first proxy hop so rate limiters and logging see real client IPs.
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const allowedCorsOrigins = resolveCorsOrigins(configService);

  // Rejects cross-origin cookie-authenticated mutating requests to mitigate CSRF.
  const cookieName = configService.get<string>(
    'AUTH_COOKIE_NAME',
    'emoto_access_token',
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const hasCookie = Boolean(req.cookies?.[cookieName]);
    if (!isMutating || !hasCookie) {
      return next();
    }
    const origin = req.headers.origin;
    if (!origin) {
      return next();
    }
    if (allowedCorsOrigins.includes(origin)) {
      return next();
    }
    res.status(403).json({ error: 'Origin not allowed' });
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedCorsOrigins.includes(origin) || allowedCorsOrigins.includes('*')) {
        callback(null, true);
        return;
      }
      callback(null, false);
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

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('eMoto Fleet OS API')
      .setDescription('Backend API for e-moto telematics')
      .setVersion('0.1.0')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
    });
  }

  const port = configService.get<number>('PORT', 3000);
  const publicUrl =
    configService.get<string>('API_PUBLIC_URL') ?? `http://localhost:${port}`;

  app.enableShutdownHooks();
  await app.listen(port);

  logger.log(`API listening on ${publicUrl}`);
  logger.log(`Swagger docs available at ${publicUrl}/docs`);
  logger.log(`Prometheus metrics available at ${publicUrl}/metrics`);
}

bootstrap().catch((error) => {
  console.error('Fatal: API bootstrap failed', error);
  process.exit(1);
});
