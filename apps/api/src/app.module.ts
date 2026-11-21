import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { AuthInfrastructureModule, AuthGuard } from '@/app/auth';
import {
  createClsConfig,
  validateEnv,
  throttlerConfig,
  throttlerErrorMessage,
  createStaticAssetsImports,
} from '@/app/config';
import { AllExceptionsFilter, ProblemDetailsFilter } from '@/app/filters';
import { HealthModule } from '@/app/health';
import { LoggerModule } from '@/app/logger';
import { McpModule } from '@/app/mcp';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { ItemModule } from '@/modules/item/item.module';

import type { NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    (async () => {
      await ConfigModule.envVariablesLoaded;
      return McpModule.register(validateEnv(process.env).MCP_ENABLED);
    })(),
    ClsModule.forRoot(createClsConfig()),
    LoggerModule,
    AuthInfrastructureModule,
    AuthModule,
    DatabaseModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [throttlerConfig],
      errorMessage: throttlerErrorMessage,
    }),
    HealthModule,
    ItemModule,
    // Evaluated when this module is defined. ConfigModule.forRoot above has
    // already loaded .env into process.env synchronously by then (an
    // implementation detail of @nestjs/config); a real env var always works.
    ...createStaticAssetsImports(process.env.SERVE_STATIC_DIR),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AllExceptionsFilter,
    ProblemDetailsFilter,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('{*path}');
  }
}
