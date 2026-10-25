import { Injectable, Logger } from '@nestjs/common';

import { AuthStrategy } from '@/app/auth/strategies/auth-strategy.interface';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

/** Bearer token that selects the second identity; any other request gets the default one. */
export const MOCK_SECOND_USER_TOKEN = 'mock-second-user';

const DEFAULT_IDENTITY: AuthenticatedUser = {
  sub: 'mock-user',
  email: 'mock@example.com',
  name: 'MockUser',
};

const SECOND_IDENTITY: AuthenticatedUser = {
  sub: 'mock-second-user',
  email: 'mock-second-user@example.com',
  name: 'MockSecondUser',
};

@Injectable()
export class MockAuthStrategy implements AuthStrategy {
  private readonly logger = new Logger(MockAuthStrategy.name);

  constructor() {
    this.logger.warn(
      '⚠️  MockAuthStrategy initialized - using fake authentication',
    );
  }

  authenticate(request: AuthenticatedRequest): Promise<AuthenticatedUser> {
    const identity =
      request.headers.authorization === `Bearer ${MOCK_SECOND_USER_TOKEN}`
        ? SECOND_IDENTITY
        : DEFAULT_IDENTITY;

    return Promise.resolve({ ...identity });
  }
}
