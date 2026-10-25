import { Injectable, Logger } from '@nestjs/common';

import { AuthStrategy } from '@/app/auth/strategies/auth-strategy.interface';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

/** Bearer token that selects the second identity; any other request gets the default one. */
export const MOCK_PARTNER_TOKEN = 'mock-partner';

const DEFAULT_IDENTITY: AuthenticatedUser = {
  sub: 'mock-user',
  email: 'mock@example.com',
  name: 'MockUser',
};

const PARTNER_IDENTITY: AuthenticatedUser = {
  sub: 'mock-partner',
  email: 'mock-partner@example.com',
  name: 'MockPartner',
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
      request.headers.authorization === `Bearer ${MOCK_PARTNER_TOKEN}`
        ? PARTNER_IDENTITY
        : DEFAULT_IDENTITY;

    return Promise.resolve({ ...identity });
  }
}
