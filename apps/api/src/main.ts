import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AuthInitializerService } from '@/app/auth';
import {
  configureHttpApplication,
  areApiDocsEnabled,
  setupSwagger,
} from '@/app/config';

import { AppModule } from './app.module';

import type { Env } from '@/app/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // Buffer logs until Logger is ready
    bodyParser: false,
  });

  const logger = app.get(Logger);
  const configService = app.get(ConfigService<Env, true>);
  const env: Env['NODE_ENV'] = configService.get('NODE_ENV');

  // Use nestjs-pino Logger
  app.useLogger(logger);

  // Initialize OIDC discovery service (if not in fake auth mode)
  const authInitializer = app.get(AuthInitializerService);
  await authInitializer.init();

  configureHttpApplication(app);

  // Swagger docs
  setupSwagger(app);

  const port: Env['PORT'] = configService.get('PORT');
  await app.listen(port);

  const nodeVersion = process.version;
  const baseUrl = `http://localhost:${port}`;
  const documentationEndpoints = areApiDocsEnabled()
    ? `|  - Docs:       ${`${baseUrl}/api/docs`.padEnd(35)}  |
|  - Swagger:    ${`${baseUrl}/api/swagger`.padEnd(35)}  |
|  - YAML:       ${`${baseUrl}/openapi.yaml`.padEnd(35)}  |`
    : `|  - API docs:   ${'disabled (NODE_ENV)'.padEnd(35)}  |`;

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
${documentationEndpoints}
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
