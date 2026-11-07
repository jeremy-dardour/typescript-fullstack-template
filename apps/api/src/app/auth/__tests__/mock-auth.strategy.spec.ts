import {
  MOCK_SECOND_USER_TOKEN,
  MockAuthStrategyService,
} from '@/app/auth/strategies/mock-auth-strategy.service';

import type { AuthenticatedRequest } from '@/app/auth/types/token.types';

function requestWith(authorization?: string): AuthenticatedRequest {
  return { headers: { authorization } } as unknown as AuthenticatedRequest;
}

describe('mockAuthStrategy', () => {
  const strategy = new MockAuthStrategyService();

  it('authenticates any request as the default identity', async () => {
    await expect(strategy.authenticate(requestWith())).resolves.toMatchObject({
      sub: 'mock-user',
    });
  });

  it('selects the second identity with its token', async () => {
    await expect(
      strategy.authenticate(requestWith(`Bearer ${MOCK_SECOND_USER_TOKEN}`)),
    ).resolves.toMatchObject({ sub: 'mock-second-user' });
  });
});
