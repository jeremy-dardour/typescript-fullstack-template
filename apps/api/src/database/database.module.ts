import { EntityManager } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver, SqlEntityManager } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BaseEnv } from '@/shared/types/env.base.schema';
import type { DynamicModule } from '@nestjs/common';

/**
 * MikroORM database module
 *
 * Configures MikroORM with NestJS integration
 */
@Module({})
export class DatabaseModule {
  /**
   * Create global database connection using ConfigService
   */
  /**
   * @param options.allowNoEntities for processes that load no entity-owning
   * module, such as a CLI whose commands don't touch the database. The HTTP app
   * keeps MikroORM's fail-fast check for an empty entity set.
   */
  static forRoot(options: { allowNoEntities?: boolean } = {}): DynamicModule {
    return {
      module: this,
      global: true,

      imports: [
        MikroOrmModule.forRootAsync({
          // With a factory, @mikro-orm/nestjs needs the driver up front to
          // register its driver-specific providers; without it, it warns at boot.
          driver: PostgreSqlDriver,
          inject: [ConfigService],
          useFactory: (configService: ConfigService<BaseEnv, true>) => {
            const isProduction =
              configService.get('NODE_ENV', { infer: true }) === 'production';

            return {
              driver: PostgreSqlDriver,
              // Connection
              clientUrl: configService.get('DATABASE_URL', { infer: true }),

              // SSL: node-postgres ignores sslmode in URL query params,
              // so we must pass ssl config explicitly for managed PostgreSQL services
              ...((configService.get('DB_SSL', { infer: true }) ??
                isProduction) && {
                driverOptions: {
                  ssl: { rejectUnauthorized: false },
                },
              }),

              autoLoadEntities: true, // prevents needing to register entities manually in mikro orm module
              discovery: { warnWhenNoEntities: !options.allowNoEntities },

              metadataProvider: TsMorphMetadataProvider,
              // Production runs as an unprivileged user that cannot write the
              // app tree, so TsMorph's metadata cache lives in /tmp.
              ...(isProduction && {
                metadataCache: {
                  options: { cacheDir: '/tmp/mikro-orm-metadata' },
                },
              }),
              // Connection pool
              pool: {
                min: configService.get('DB_POOL_MIN', { infer: true }),
                max: configService.get('DB_POOL_MAX', { infer: true }),
                idleTimeoutMillis: configService.get('DB_POOL_IDLE_TIMEOUT', {
                  infer: true,
                }),
                acquireTimeoutMillis: configService.get(
                  'DB_POOL_CONNECTION_TIMEOUT',
                  { infer: true },
                ),
              },

              // Debugging
              debug: !isProduction, // When true, MikroORM logs all SQL queries to the console

              allowGlobalContext: false, // Disables global context to avoid issues with em sharing accross requests
            };
          },
        }),
      ],
      providers: [
        {
          provide: SqlEntityManager,
          useFactory: (em: EntityManager) => em,
          inject: [EntityManager],
        },
      ],
      exports: [SqlEntityManager],
    };
  }
}
