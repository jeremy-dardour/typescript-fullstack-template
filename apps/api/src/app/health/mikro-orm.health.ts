import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import type { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * MikroORM database health indicator - verifies connection via isConnected check
 */
@Injectable()
export class MikroORMHealthIndicator {
  constructor(private readonly orm: MikroORM) {}
  messageKey = 'database';

  /**
   * Check database connection health
   */
  async isHealthy(): Promise<HealthIndicatorResult> {
    try {
      const isConnected = await this.orm.isConnected();

      if (!isConnected) {
        return {
          [this.messageKey]: {
            status: 'down' as const,
            message: 'Database connection is not established',
          },
        };
      }

      // Execute a simple query to verify full connectivity
      const connection = this.orm.em.getConnection();
      await connection.execute('SELECT 1');

      return {
        [this.messageKey]: {
          status: 'up' as const,
          message: 'Database is available',
        },
      };
    } catch (error) {
      return {
        [this.messageKey]: {
          status: 'down' as const,
          message:
            error instanceof Error ? error.message : 'Database check failed',
        },
      };
    }
  }
}
