import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from '@modelcontextprotocol/client';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { chromium } from '@playwright/test';
import { TestOAuthClientProvider } from '@test-fixtures/oauth-client.mjs';
import { startOAuthProvider } from '@test-fixtures/oauth-provider.mjs';
import { decodeJwt } from 'jose';
import { z } from 'zod';

import { AuthInitializerService, OidcDiscoveryService } from '@/app/auth';
import { configureHttpApplication, validateEnv } from '@/app/config';
import { AppModule } from '@/app.module';
import { itemSchema } from '@/modules/item/dtos/output/item.dto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Browser } from '@playwright/test';
import type { Server } from 'node:http';

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No allocated port');
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('MCP OAuth with a local HTTP provider', () => {
  let app: NestExpressApplication | undefined;
  let provider: Awaited<ReturnType<typeof startOAuthProvider>> | undefined;
  let callbackServer: Server | undefined;
  let browser: Browser | undefined;
  let resource: string;
  let oauth: TestOAuthClientProvider;
  let callback: Promise<URL>;
  const audience = 'template-api-oauth-test';
  const scope = 'items:access';

  beforeAll(async () => {
    const reservation = createServer();
    const apiPort = await listen(reservation);
    await closeServer(reservation);
    resource = `http://127.0.0.1:${apiPort}/mcp`;
    provider = await startOAuthProvider({ resource, audience, scope });

    callback = new Promise<URL>((resolve) => {
      callbackServer = createServer((request, response) => {
        const url = new URL(request.url ?? '/', oauth.redirectUrl);
        if (url.pathname === '/callback') resolve(url);
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end(
          'Authorization complete. You can return to the test client.',
        );
      });
    });
    if (!callbackServer) throw new Error('Callback server was not created');
    const callbackPort = await listen(callbackServer);
    oauth = new TestOAuthClientProvider(
      `http://127.0.0.1:${callbackPort}/callback`,
    );

    const environment = validateEnv({
      ...process.env,
      NODE_ENV: 'test',
      FAKE_AUTH: 'false',
      MCP_ENABLED: 'true',
      MCP_PUBLIC_URL: resource,
      AUTH_OIDC_DISCOVERY_URL: provider.issuer,
      AUTH_CLIENT_ID: 'template-api-resource',
      AUTH_AUDIENCE: audience,
      AUTH_ACCEPTED_SCOPES: scope,
    });
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .compile();
    app = fixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureHttpApplication(app);
    await app.get(AuthInitializerService).init();
    await app.listen(apiPort, '127.0.0.1');
    browser = await chromium.launch();
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
    await provider?.close();
    if (callbackServer) await closeServer(callbackServer);
  });

  it('completes discovery, PKCE browser consent, token exchange and the Item lifecycle', async () => {
    if (!browser || !provider) throw new Error('OAuth fixture did not start');
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      authProvider: oauth,
    });
    const initialClient = new Client(
      { name: 'oauth-test', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );

    await expect(initialClient.connect(transport)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    const authorizationUrl = oauth.authorizationUrl;
    if (!authorizationUrl)
      throw new Error('SDK did not initiate authorization');
    expect(authorizationUrl.origin).toBe(provider.issuer);
    expect(authorizationUrl.searchParams.get('resource')).toBe(resource);
    expect(authorizationUrl.searchParams.get('scope')).toBe(scope);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe(
      'S256',
    );

    const page = await browser.newPage();
    await page.goto(authorizationUrl.href);
    await page.getByRole('button', { name: 'Authorize test user' }).click();
    const callbackUrl = await callback;
    await page.waitForURL(`${oauth.redirectUrl}**`);
    await page.close();

    const wrongState = new URL(callbackUrl);
    wrongState.searchParams.set('state', 'unexpected-state');
    expect(() => oauth.callbackParameters(wrongState)).toThrow(
      'OAuth callback',
    );

    const registration = oauth.clientInformation({ issuer: provider.issuer });
    if (!registration) throw new Error('SDK did not register its OAuth client');
    const tokenRequest = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: registration.client_id,
      code: callbackUrl.searchParams.get('code') ?? '',
      redirect_uri: oauth.redirectUrl,
      resource,
      code_verifier: 'x'.repeat(43),
    });
    const invalidPkce = await fetch(`${provider.issuer}/token`, {
      method: 'POST',
      body: tokenRequest,
    });
    expect(invalidPkce.status).toBe(400);

    for (const [field, value] of [
      ['client_id', 'unregistered-client'],
      ['redirect_uri', 'http://127.0.0.1/other-callback'],
      ['resource', 'https://other-resource.example.com/mcp'],
    ] as const) {
      const invalidBinding = new URLSearchParams(tokenRequest);
      invalidBinding.set('code_verifier', oauth.codeVerifier());
      invalidBinding.set(field, value);
      const rejected = await fetch(`${provider.issuer}/token`, {
        method: 'POST',
        body: invalidBinding,
      });
      expect(rejected.status).toBe(400);
    }

    const mismatchedIssuer = new URLSearchParams(
      oauth.callbackParameters(callbackUrl),
    );
    mismatchedIssuer.set('iss', 'https://unexpected.example.com');
    await expect(transport.finishAuth(mismatchedIssuer)).rejects.toThrow();
    await transport.finishAuth(oauth.callbackParameters(callbackUrl));
    await transport.close();
    await initialClient.close();

    const tokens = oauth.tokens();
    if (!tokens) throw new Error('SDK did not store issued tokens');
    expect(decodeJwt(tokens.access_token)).toMatchObject({
      iss: provider.issuer,
      aud: audience,
      sub: 'local-test-user',
      scope,
    });
    tokenRequest.set('code_verifier', oauth.codeVerifier());
    const replay = await fetch(`${provider.issuer}/token`, {
      method: 'POST',
      body: tokenRequest,
    });
    expect(replay.status).toBe(400);

    const client = new Client(
      { name: 'oauth-test', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    let createdId: string | undefined;
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(resource), {
          authProvider: oauth,
        }),
      );
      const catalog = await client.listTools();
      expect(catalog.tools).toHaveLength(5);
      const creation = await client.callTool({
        name: 'create_item',
        arguments: {
          name: 'OAuth lifecycle test',
          description: 'before update',
        },
      });
      const created = itemSchema.parse(creation.structuredContent);
      createdId = created.id;
      const restRead = await fetch(
        `${new URL(resource).origin}/api/items/${createdId}`,
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        },
      );
      expect(restRead.status).toBe(200);
      expect(itemSchema.parse(await restRead.json())).toEqual(created);
      const listing = await client.callTool({
        name: 'list_items',
        arguments: {},
      });
      expect(listing.isError).not.toBe(true);
      const read = await client.callTool({
        name: 'get_item',
        arguments: { id: createdId },
      });
      expect(itemSchema.parse(read.structuredContent)).toEqual(created);
      const update = await client.callTool({
        name: 'update_item',
        arguments: { id: createdId, description: null },
      });
      expect(itemSchema.parse(update.structuredContent).description).toBeNull();
      const deletion = await client.callTool({
        name: 'delete_item',
        arguments: { id: createdId },
      });
      expect(deletion.structuredContent).toEqual({
        id: createdId,
        deleted: true,
      });
      const deletedRead = await client.callTool({
        name: 'get_item',
        arguments: { id: createdId },
      });
      expect(deletedRead.isError).toBe(true);
      createdId = undefined;

      if (!app) throw new Error('OAuth API fixture did not start');
      try {
        for (const [mode, status] of [
          ['unavailable', 503],
          ['malformed', 503],
          ['missing-key', 401],
        ] as const) {
          provider.setJwksMode(mode);
          await app.get(OidcDiscoveryService).init();
          const restFailure = await fetch(
            `${new URL(resource).origin}/api/me`,
            {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
            },
          );
          expect(restFailure.status).toBe(status);
          const mcpFailure = await fetch(resource, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'server/discover',
            }),
          });
          expect(mcpFailure.status).toBe(status);
          const challenge = mcpFailure.headers.get('www-authenticate');
          if (status === 401) expect(challenge).toContain('invalid_token');
          else expect(challenge ?? '').not.toContain('invalid_token');
        }
      } finally {
        provider.setJwksMode('available');
        await app.get(OidcDiscoveryService).init();
      }
    } finally {
      if (createdId)
        await client.callTool({
          name: 'delete_item',
          arguments: { id: createdId },
        });
      await client.close();
    }
  }, 30_000);

  it('rejects expired authorization codes without a timing-dependent wait', async () => {
    const expiredProvider = await startOAuthProvider({
      resource,
      audience,
      scope,
      authorizationCodeTtlMs: 0,
    });
    try {
      const redirect = 'http://127.0.0.1/expiry-callback';
      const registration = await fetch(`${expiredProvider.issuer}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uris: [redirect] }),
      });
      expect(registration.status).toBe(201);
      const clientId = z
        .object({ client_id: z.string() })
        .parse(await registration.json()).client_id;
      const verifier = 'v'.repeat(43);
      const authorization = new URL(`${expiredProvider.issuer}/authorize`);
      authorization.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        code_challenge: createHash('sha256')
          .update(verifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
        state: 'expiry-state',
        resource,
        scope,
      }).toString();
      const authorized = await fetch(authorization, {
        method: 'POST',
        redirect: 'manual',
      });
      expect(authorized.status).toBe(302);
      const location = authorized.headers.get('location');
      if (!location)
        throw new Error('Provider did not issue an authorization code');
      const callbackUrl = new URL(location);
      const exchange = await fetch(`${expiredProvider.issuer}/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirect,
          code: callbackUrl.searchParams.get('code') ?? '',
          code_verifier: verifier,
          resource,
        }),
      });
      expect(exchange.status).toBe(400);
      expect(await exchange.json()).toEqual({ error: 'invalid_grant' });
    } finally {
      await expiredProvider.close();
    }
  });
});
