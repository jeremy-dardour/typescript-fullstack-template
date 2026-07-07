import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AuthInitializerService } from '@/app/auth';
import { corsConfig } from '@/app/config/security.config';
import { setupSwagger } from '@/app/config/swagger.config';
import { createValidationPipe } from '@/app/config/validation.config';
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter';
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter';
import { CorrelationIdInterceptor } from '@/app/interceptors/correlation-id.interceptor';
import { LinkHeaderInterceptor } from '@/app/interceptors/link-header.interceptor';
import { LocationHeaderInterceptor } from '@/app/interceptors/location-header.interceptor';
import { RequestContextInterceptor } from '@/app/interceptors/request-context.interceptor';
import { TimeoutInterceptor } from '@/app/interceptors/timeout.interceptor';
import { TraceContextInterceptor } from '@/app/interceptors/trace-context.interceptor';
import { TransformInterceptor } from '@/app/interceptors/transform.interceptor';

import { AppModule } from './app.module';

import type { Env } from '@/app/config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until Logger is ready
  });
  const logger = app.get(Logger);
  const configService = app.get(ConfigService<Env, true>);
  const env: Env['NODE_ENV'] = configService.get('NODE_ENV');

  // Use nestjs-pino Logger
  app.useLogger(logger);

  // Initialize OIDC discovery service (if not in fake auth mode)
  const authInitializer = app.get(AuthInitializerService);
  await authInitializer.init();

  // CORS config
  app.enableCors(corsConfig);

  // Global route prefix
  app.setGlobalPrefix('api', {
    exclude: [
      // Exclude Swagger dev credentials endpoint
      { path: '.well-known', method: RequestMethod.ALL },
      { path: '.well-known/{*path}', method: RequestMethod.ALL },
      // Exclude health check endpoints
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
    ],
  });

  // Global exception filters (specific to general)
  app.useGlobalFilters(
    app.get(ThrottlerExceptionFilter),
    app.get(ProblemDetailsFilter),
    app.get(AllExceptionsFilter),
  );

  // Global interceptors (in execution order)
  app.useGlobalInterceptors(
    // 1. Request context (add trace headers to response)
    app.get(RequestContextInterceptor),
    app.get(CorrelationIdInterceptor),
    app.get(TraceContextInterceptor),

    // 2. Timeout control (15s)
    new TimeoutInterceptor(15_000),

    // 3. Location header (201 Created)
    new LocationHeaderInterceptor(),

    // 4. Link header (pagination links)
    new LinkHeaderInterceptor(),

    // 5. Response formatting (executed last)
    new TransformInterceptor(app.get(Reflector)),
  );

  // Global validation pipe
  app.useGlobalPipes(createValidationPipe());

  // Swagger docs
  setupSwagger(app);

  const port: Env['PORT'] = configService.get('PORT');
  await app.listen(port);

  const nodeVersion = process.version;
  const baseUrl = `http://localhost:${port}`;

  const startupMessage = `
+-----------------------------------------------------+
|                     API Server                      |
+-----------------------------------------------------+
|  Environment:  ${env.padEnd(35)}  |
|  Port:         ${String(port).padEnd(35)}  |
|  Node:         ${nodeVersion.padEnd(35)}  |
+-----------------------------------------------------+
|  Endpoints:                                         |
|  - API:        ${`${baseUrl}/api`.padEnd(35)}  |
|  - Docs:       ${`${baseUrl}/api/docs`.padEnd(35)}  |
|  - Swagger:    ${`${baseUrl}/api/swagger`.padEnd(35)}  |
|  - YAML:       ${`${baseUrl}/openapi.yaml`.padEnd(35)}  |
|  - Health:     ${`${baseUrl}/health`.padEnd(35)}  |
+-----------------------------------------------------+`;

  logger.log(startupMessage);
}

// eslint-disable-next-line unicorn/prefer-top-level-await, unicorn/prefer-await
bootstrap().catch((error) => {
  // Exit non-zero so orchestrators treat a failed boot as a crash, not a clean start
  console.error(error);
  process.exitCode = 1;
});
