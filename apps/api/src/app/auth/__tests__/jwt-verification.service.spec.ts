import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { InvalidTokenException } from '@/app/auth/exceptions/invalid-token.exception';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import { envSchema } from '@/app/config/env.schema';

import type { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import type { Env } from '@/app/config/env.schema';
import type { ConfigService } from '@nestjs/config';

const CLIENT_ID = 'client-id';
const SCOPE = 'api.read';

function createService(
  oidc: MockOidcService,
  audience?: string,
): JwtVerificationService {
  const config: Record<string, unknown> = {
    AUTH_CLIENT_ID: CLIENT_ID,
    AUTH_AUDIENCE: audience,
    AUTH_ACCEPTED_SCOPES: [SCOPE],
  };
  const configService = {
    get: (key: string) => config[key],
  } as unknown as ConfigService<Env, true>;

  return new JwtVerificationService(
    oidc as unknown as OidcDiscoveryService,
    configService,
  );
}

describe('jwtVerificationService audience', () => {
  const oidc = new MockOidcService();

  beforeAll(async () => {
    await oidc.setup();
  });

  it('expects AUTH_CLIENT_ID as the audience by default', async () => {
    const service = createService(oidc);
    const tokens = new MockTokenFactory(oidc, CLIENT_ID, SCOPE);

    const { payload } = await service.verify(await tokens.createToken());
    expect(payload.aud).toBe(CLIENT_ID);
    await expect(
      service.verify(await tokens.createToken({ aud: `api://${CLIENT_ID}` })),
    ).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('expects AUTH_AUDIENCE instead when it is set', async () => {
    const service = createService(oidc, `api://${CLIENT_ID}`);
    const tokens = new MockTokenFactory(oidc, `api://${CLIENT_ID}`, SCOPE);

    const { payload } = await service.verify(await tokens.createToken());
    expect(payload.aud).toBe(`api://${CLIENT_ID}`);
    await expect(
      service.verify(await tokens.createToken({ aud: CLIENT_ID })),
    ).rejects.toBeInstanceOf(InvalidTokenException);
  });
});

describe('envSchema audience', () => {
  const baseEnv = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    AUTH_CLIENT_ID: CLIENT_ID,
    AUTH_OIDC_DISCOVERY_URL:
      'https://auth.example.com/.well-known/openid-configuration',
    AUTH_ACCEPTED_SCOPES: SCOPE,
  };

  // An empty audience would make jose skip the audience check entirely.
  it.each(['AUTH_AUDIENCE', 'AUTH_CLIENT_ID'])('rejects an empty %s', (key) => {
    expect(envSchema.safeParse({ ...baseEnv, [key]: '' }).success).toBe(false);
  });
});
