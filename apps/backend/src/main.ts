import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // Cookie parsing — required for reading the 'sid' session cookie
  app.use(cookieParser());

  // CORS — allow frontend origin, with credentials
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Device'],
  });

  // All routes under /api/v1
  app.setGlobalPrefix('api/v1');

  // Validation — whitelist + transform applied globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Note: Guards, Interceptors, and Filters are registered via APP_GUARD /
  // APP_INTERCEPTOR / APP_FILTER tokens in AppModule, so they have access to
  // the DI container (needed for PrismaService injection).

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running at http://0.0.0.0:${port}/api/v1`);
  console.log(`Health check: http://0.0.0.0:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
