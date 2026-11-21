import { validateEnv } from '@/app/config/env.schema';

const BASE = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  MCP_PUBLIC_URL: 'https://api.example.com/mcp',
};
const REAL_AUTH = {
  AUTH_CLIENT_ID: 'client-id',
  AUTH_OIDC_DISCOVERY_URL:
    'https://auth.example.com/.well-known/openid-configuration',
  AUTH_ACCEPTED_SCOPES: 'api.read',
};

describe('validateEnv', () => {
  it('enables MCP by default and requires its public URL', () => {
    const config = { ...BASE, ...REAL_AUTH, NODE_ENV: 'production' };
    expect(validateEnv(config).MCP_ENABLED).toBe(true);
    expect(() => validateEnv({ ...config, MCP_PUBLIC_URL: undefined })).toThrow(
      /MCP_PUBLIC_URL is required/,
    );
    expect(
      validateEnv({
        ...config,
        MCP_ENABLED: 'false',
        MCP_PUBLIC_URL: undefined,
      }).MCP_ENABLED,
    ).toBe(false);
  });

  it.each([
    // eslint-disable-next-line unicorn/prefer-https -- Plain HTTP is the invalid production input under test.
    'http://api.example.com/mcp',
    'https://api.example.com/other',
    'https://api.example.com/mcp?token=invalid',
    'https://user:password@api.example.com/mcp',
    'https://api.example.com/mcp#fragment',
  ])('rejects invalid production MCP URLs: %s', (url) => {
    expect(() =>
      validateEnv({
        ...BASE,
        ...REAL_AUTH,
        NODE_ENV: 'production',
        MCP_PUBLIC_URL: url,
      }),
    ).toThrow(/MCP_PUBLIC_URL/);
  });

  it('accepts exact browser origins and a positive integral budget', () => {
    const config = { ...BASE, ...REAL_AUTH, NODE_ENV: 'production' };
    expect(
      validateEnv({
        ...config,
        MCP_ALLOWED_ORIGINS: 'https://web.example.com,http://localhost:1234',
        MCP_RATE_LIMIT_PER_MINUTE: '15',
      }),
    ).toMatchObject({
      MCP_ALLOWED_ORIGINS: ['https://web.example.com', 'http://localhost:1234'],
      MCP_RATE_LIMIT_PER_MINUTE: 15,
    });
    for (const origins of ['*', 'https://web.example.com/path', 'null']) {
      expect(() =>
        validateEnv({ ...config, MCP_ALLOWED_ORIGINS: origins }),
      ).toThrow(/MCP_ALLOWED_ORIGINS/);
    }
    for (const limit of ['0', '-1', '1.5', 'NaN']) {
      expect(() =>
        validateEnv({ ...config, MCP_RATE_LIMIT_PER_MINUTE: limit }),
      ).toThrow();
    }
  });
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
