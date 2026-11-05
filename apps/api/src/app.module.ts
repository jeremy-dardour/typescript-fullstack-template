import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { AuthModule, AuthGuard } from '@/app/auth';
import {
  createClsConfig,
  validateEnv,
  throttlerConfig,
  createStaticAssetsImports,
} from '@/app/config';
import {
  AllExceptionsFilter,
  ProblemDetailsFilter,
  ThrottlerExceptionFilter,
} from '@/app/filters';
import { HealthModule } from '@/app/health';
import { ContextHeadersInterceptor } from '@/app/interceptors';
import { LoggerModule } from '@/app/logger';
import { DatabaseModule } from '@/database/database.module';
import { AuthFeatureModule } from '@/modules/auth/auth.module';
import { ItemModule } from '@/modules/item/item.module';

import type { NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    ClsModule.forRoot(createClsConfig()),
    LoggerModule,
    AuthModule,
    AuthFeatureModule,
    DatabaseModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: throttlerConfig.ttl,
        limit: throttlerConfig.limit,
      },
    ]),
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
    ThrottlerExceptionFilter,
    ContextHeadersInterceptor,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('{*path}');
  }
}
