import { once } from 'node:events';
import { createServer } from 'node:http';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { chromium } from '@playwright/test';
import { ClsModule } from 'nestjs-cls';

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

async function browserOrigin() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Browser MCP test</title>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No browser fixture port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

it('allows production browser preflight, exposes auth challenges, and blocks other origins', async () => {
  const allowed = await browserOrigin();
  const disallowed = await browserOrigin();
  const oidc = new MockOidcService();
  await oidc.setup();
  const token = await new MockTokenFactory(
    oidc,
    'browser-audience',
    'items.read',
  ).validToken();
  const config = new ConfigService<Env, true>({
    NODE_ENV: 'production',
    FAKE_AUTH: false,
    AUTH_CLIENT_ID: 'browser-audience',
    AUTH_ACCEPTED_SCOPES: ['items.read'],
    MCP_PUBLIC_URL: 'https://127.0.0.1/mcp',
    MCP_ALLOWED_ORIGINS: [allowed.origin],
    MCP_RATE_LIMIT_PER_MINUTE: 120,
  });
  let app: NestExpressApplication | undefined;
  const browser = await chromium.launch();
  try {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ClsModule.forRoot({ global: true, middleware: { mount: false } }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
        AuthInfrastructureModule,
        McpModule.register(true),
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
    const url = `${await app.getUrl()}/mcp`;
    const page = await browser.newPage();
    await page.goto(allowed.origin);
    const challenge = await page.evaluate(async (endpoint) => {
      const response = await globalThis.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Method': 'server/discover',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'server/discover',
        }),
      });
      return {
        status: response.status,
        challenge: response.headers.get('WWW-Authenticate'),
        requestId: response.headers.get('X-Request-Id'),
        correlationId: response.headers.get('X-Correlation-Id'),
      };
    }, url);
    expect(challenge.status).toBe(401);
    expect(challenge.challenge).toContain('resource_metadata=');
    expect(challenge.requestId).toBeTruthy();
    expect(challenge.correlationId).toBeTruthy();
    const discovery = await page.evaluate(
      async ({ endpoint, credential }) => {
        const response = await globalThis.fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credential}`,
            'MCP-Protocol-Version': '2026-07-28',
            'Mcp-Method': 'server/discover',
            'X-Request-Id': 'browser-request',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'server/discover',
            params: {
              _meta: {
                'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientCapabilities': {},
              },
            },
          }),
        });
        const body: unknown = await response.json();
        return {
          status: response.status,
          requestId: response.headers.get('X-Request-Id'),
          body,
        };
      },
      { endpoint: url, credential: token },
    );
    expect(discovery.status).toBe(200);
    expect(discovery.requestId).toBe('browser-request');
    expect(discovery.body).toHaveProperty('result');
    await page.goto(disallowed.origin);
    expect(
      await page.evaluate(async (endpoint) => {
        try {
          await globalThis.fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          return false;
        } catch {
          return true;
        }
      }, url),
    ).toBe(true);
  } finally {
    await browser.close();
    await app?.close();
    allowed.server.closeAllConnections();
    disallowed.server.closeAllConnections();
    await Promise.all(
      [allowed.server, disallowed.server].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
}, 30_000);
