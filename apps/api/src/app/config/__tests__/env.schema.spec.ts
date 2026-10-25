import { validateEnv } from '@/app/config/env.schema';

const BASE = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };
const REAL_AUTH = {
  AUTH_CLIENT_ID: 'client-id',
  AUTH_OIDC_DISCOVERY_URL:
    'https://auth.example.com/.well-known/openid-configuration',
  AUTH_ACCEPTED_SCOPES: 'api.read',
};

describe('validateEnv', () => {
  it('requires the OIDC variables when fake auth is off', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(
      /AUTH_CLIENT_ID is required[\s\S]*AUTH_OIDC_DISCOVERY_URL is required[\s\S]*AUTH_ACCEPTED_SCOPES is required/,
    );
  });

  it('accepts real auth configuration', () => {
    expect(
      validateEnv({ ...BASE, ...REAL_AUTH, NODE_ENV: 'production' })
        .AUTH_ACCEPTED_SCOPES,
    ).toEqual(['api.read']);
  });

  it('does not require OIDC variables with fake auth in development', () => {
    expect(
      validateEnv({ ...BASE, NODE_ENV: 'development', FAKE_AUTH: 'true' })
        .FAKE_AUTH,
    ).toBe(true);
  });

  it('refuses fake auth when NODE_ENV only defaulted', () => {
    expect(() => validateEnv({ ...BASE, FAKE_AUTH: 'true' })).toThrow(
      /FAKE_AUTH=true requires NODE_ENV/,
    );
  });

  it('refuses fake auth in production', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        ...REAL_AUTH,
        NODE_ENV: 'production',
        FAKE_AUTH: 'true',
      }),
    ).toThrow(/FAKE_AUTH=true requires NODE_ENV/);
  });
});
