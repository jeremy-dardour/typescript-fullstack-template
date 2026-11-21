import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JOSEError } from 'jose/errors';
import { ClsModule } from 'nestjs-cls';
import request from 'supertest';

import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import {
  AuthGuard,
  AuthInfrastructureModule,
  OidcDiscoveryService,
} from '@/app/auth';
import { configureHttpApplication } from '@/app/config';
import { AllExceptionsFilter, ProblemDetailsFilter } from '@/app/filters';
import { McpModule } from '@/app/mcp/mcp.module';

import type { Env } from '@/app/config';
import type { NestExpressApplication } from '@nestjs/platform-express';

const VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];
const ACCEPT = 'application/json, text/event-stream';

describe('mCP HTTP integration', () => {
  const oidc = new MockOidcService();
  let tokens: MockTokenFactory;
  let app: NestExpressApplication;
  let baseUrl: string;
  let config: ConfigService<Env, true>;
  let token: string;

  beforeAll(async () => {
    await oidc.setup();
    tokens = new MockTokenFactory(oidc, 'mcp-test-audience', 'items.read');
    token = await tokens.validToken();
  });

  async function start(isEnabled = true, limit = 120) {
    config = new ConfigService<Env, true>({
      NODE_ENV: 'test',
      FAKE_AUTH: false,
      AUTH_CLIENT_ID: 'mcp-test-audience',
      AUTH_ACCEPTED_SCOPES: ['items.read', 'items.write'],
      MCP_PUBLIC_URL: 'http://localhost/mcp',
      MCP_ALLOWED_ORIGINS: ['https://client.example.com'],
      MCP_RATE_LIMIT_PER_MINUTE: limit,
    });
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
        AuthInfrastructureModule,
        McpModule.register(isEnabled),
      ],
      providers: [
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        AllExceptionsFilter,
        ProblemDetailsFilter,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(OidcDiscoveryService)
      .useValue(oidc)
      .compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureHttpApplication(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    config.set('MCP_PUBLIC_URL', `${baseUrl}/mcp`);
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  it.each(VERSIONS)(
    'serves discovery through an SDK client on %s',
    async (version) => {
      await start();
      const client = new Client(
        { name: 'mcp-http-test', version: '1.0.0' },
        {
          supportedProtocolVersions: [version],
          versionNegotiation:
            version === '2026-07-28'
              ? { mode: { pin: version } }
              : { mode: 'legacy' },
        },
      );
      try {
        await client.connect(
          new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer ${token}` } },
          }),
        );
        expect(client.getServerVersion()).toMatchObject({
          name: 'template-api',
        });
        expect(client.getServerCapabilities()).toEqual({});
      } finally {
        await client.close();
      }
    },
  );

  it('publishes public resource metadata using the actual issuer', async () => {
    await start();
    const response = await request(app.getHttpServer() as never)
      .get('/.well-known/oauth-protected-resource/mcp')
      .expect(200);
    expect(response.body).toEqual({
      resource: `${baseUrl}/mcp`,
      resource_name: 'Template API',
      authorization_servers: [MockOidcService.ISSUER],
      scopes_supported: ['items.read', 'items.write'],
      bearer_methods_supported: ['header'],
    });
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it.each([undefined, 'Basic invalid', 'Bearer'])(
    'classifies missing or malformed authentication: %s',
    async (header) => {
      await start();
      const call = request(app.getHttpServer() as never)
        .post('/mcp')
        .send({});
      if (header) call.set('Authorization', header);
      const response = await call.expect(401);
      expect(response.headers['www-authenticate']).toContain(
        'resource_metadata=',
      );
      expect(response.headers['www-authenticate']).not.toContain(
        'invalid_token',
      );
      expect(response.headers['x-request-id']).toBeTruthy();
      expect(response.headers['x-correlation-id']).toBeTruthy();
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
    },
  );

  it.each(['expired', 'issuer', 'audience', 'tampered'])(
    'rejects %s tokens with invalid_token',
    async (failure) => {
      await start();
      const credential =
        failure === 'expired'
          ? await tokens.expiredToken()
          : failure === 'issuer'
            ? await tokens.wrongIssuerToken()
            : failure === 'audience'
              ? await tokens.wrongAudienceToken()
              : 'not.a.token';
      const response = await request(app.getHttpServer() as never)
        .post('/mcp')
        .set('Authorization', `Bearer ${credential}`)
        .send({})
        .expect(401);
      expect(response.headers['www-authenticate']).toContain(
        'error="invalid_token"',
      );
    },
  );

  it('challenges insufficient scope with one sufficient accepted scope', async () => {
    await start();
    const credential = await tokens.wrongScopeToken();
    const response = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${credential}`)
      .send({})
      .expect(403);
    expect(response.headers['www-authenticate']).toContain(
      'error="insufficient_scope"',
    );
    expect(response.headers['www-authenticate']).toContain(
      'scope="items.read"',
    );
  });

  it.each(['get', 'delete'] as const)(
    'answers authenticated %s with 405 and no session',
    async (method) => {
      await start();
      const response = await request(app.getHttpServer() as never)
        [method]('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .expect(405);
      expect(response.headers.allow).toBe('POST');
      expect(response.headers['mcp-session-id']).toBeUndefined();
    },
  );

  it('rejects unsupported content types and disallowed browser origins', async () => {
    await start();
    await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send('{}')
      .expect(415);
    const response = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'https://not-permitted.example.com')
      .send({})
      .expect(403);
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports all endpoint revisions for an unsupported modern revision', async () => {
    await start();
    const response = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', ACCEPT)
      .set('MCP-Protocol-Version', '2099-01-01')
      .set('Mcp-Method', 'server/discover')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2099-01-01',
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      })
      .expect(400);
    expect(response.body).toMatchObject({
      error: { data: { supported: VERSIONS } },
    });
  });

  it('limits authenticated subjects independently and does not charge auth failures', async () => {
    await start(true, 1);
    await request(app.getHttpServer() as never)
      .get('/mcp')
      .expect(401);
    await request(app.getHttpServer() as never)
      .get('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .expect(405);
    const response = await request(app.getHttpServer() as never)
      .get('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .expect(429);
    expect(response.headers['x-ratelimit-limit']).toBe('1');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.text).toContain('1 requests per 60 seconds');
    const other = await tokens.createToken({ sub: 'other-caller' });
    await request(app.getHttpServer() as never)
      .get('/mcp')
      .set('Authorization', `Bearer ${other}`)
      .expect(405);
    await request(app.getHttpServer() as never)
      .get('/.well-known/oauth-protected-resource/mcp')
      .expect(200);
  });

  it('leaves protocol and metadata routes absent while disabled', async () => {
    await start(false);
    const protocol = await request(app.getHttpServer() as never)
      .post('/mcp')
      .send({})
      .expect(404);
    const metadata = await request(app.getHttpServer() as never)
      .get('/.well-known/oauth-protected-resource/mcp')
      .expect(404);
    expect([protocol.status, metadata.status]).toEqual([404, 404]);
  });

  it('distinguishes provider failure from invalid credentials', async () => {
    await start();
    vi.spyOn(oidc, 'getJWKSet').mockImplementation(() => {
      throw new JOSEError('test provider is unavailable');
    });
    const response = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(503);
    expect(response.headers['www-authenticate']).toBeUndefined();
  });

  it('omits a nonexistent authorization server when using mock identity', async () => {
    await start();
    config.set('FAKE_AUTH', true);
    const response = await request(app.getHttpServer() as never)
      .get('/.well-known/oauth-protected-resource/mcp')
      .expect(200);
    expect(response.body).not.toHaveProperty('authorization_servers');
  });

  it('serves production preflight and readable authentication challenges', async () => {
    await start();
    config.set('NODE_ENV', 'production');
    const preflight = await request(app.getHttpServer() as never)
      .options('/mcp')
      .set('Origin', 'https://client.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'authorization,content-type,mcp-protocol-version,mcp-method,mcp-name,last-event-id',
      )
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'https://client.example.com',
    );
    expect(preflight.headers['access-control-allow-headers']).toContain(
      'MCP-Protocol-Version',
    );
    const challenge = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Origin', 'https://client.example.com')
      .send({})
      .expect(401);
    expect(challenge.headers['access-control-allow-origin']).toBe(
      'https://client.example.com',
    );
    expect(challenge.headers['access-control-expose-headers']).toContain(
      'WWW-Authenticate',
    );
  });

  it('preserves supplied identifiers when parsing malformed JSON fails', async () => {
    await start();
    const response = await request(app.getHttpServer() as never)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .set('X-Request-Id', 'mcp-malformed-request')
      .set('X-Correlation-Id', 'mcp-malformed-correlation')
      .send('{broken')
      .expect(400);
    expect(response.headers['x-request-id']).toBe('mcp-malformed-request');
    expect(response.headers['x-correlation-id']).toBe(
      'mcp-malformed-correlation',
    );
    expect(response.headers['cache-control']).toContain('no-store');
  });
});
