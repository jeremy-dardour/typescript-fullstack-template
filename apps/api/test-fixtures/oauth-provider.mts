import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';

import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { z } from 'zod';

import type { ServerResponse } from 'node:http';

const redirectSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.hash
  );
});
const registrationSchema = z.object({
  redirect_uris: z.array(redirectSchema).min(1),
});
const authorizationSchema = z.object({
  client_id: z.string(),
  redirect_uri: redirectSchema,
  response_type: z.literal('code'),
  code_challenge: z.string().regex(/^[\w-]{43}$/),
  code_challenge_method: z.literal('S256'),
  state: z.string().min(1),
  resource: z.url(),
  scope: z.string(),
});

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
}

export async function startOAuthProvider(options: {
  resource: string;
  audience: string;
  scope: string;
  port?: number;
  authorizationCodeTtlMs?: number;
}) {
  type JwksMode = 'available' | 'unavailable' | 'malformed' | 'missing-key';
  const keys = await generateKeyPair('RS256');
  const jwk = await exportJWK(keys.publicKey);
  const clients = new Map<string, z.infer<typeof registrationSchema>>();
  const codes = new Map<
    string,
    { authorization: z.infer<typeof authorizationSchema>; expiresAt: number }
  >();
  let issuer = '';
  let jwksMode: JwksMode = 'available';

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', issuer);
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        });
        response.end();
        return;
      }
      if (
        request.method === 'GET' &&
        [
          '/.well-known/openid-configuration',
          '/.well-known/oauth-authorization-server',
        ].includes(url.pathname)
      ) {
        json(response, 200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          registration_endpoint: `${issuer}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none'],
          scopes_supported: [options.scope],
          authorization_response_iss_parameter_supported: true,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/jwks') {
        if (jwksMode === 'malformed') {
          json(response, 200, { keys: 'malformed' });
          return;
        }
        if (jwksMode === 'missing-key') {
          json(response, 200, { keys: [] });
          return;
        }
        json(
          response,
          jwksMode === 'available' ? 200 : 503,
          jwksMode === 'available'
            ? {
                keys: [
                  { ...jwk, kid: 'local-test-key', alg: 'RS256', use: 'sig' },
                ],
              }
            : { error: 'temporarily_unavailable' },
        );
        return;
      }

      let body = '';
      for await (const chunk of request) {
        body += String(chunk);
        if (body.length > 65_536) {
          json(response, 413, { error: 'invalid_request' });
          return;
        }
      }
      if (request.method === 'POST' && url.pathname === '/register') {
        const registration = registrationSchema.parse(JSON.parse(body));
        const clientId = randomUUID();
        clients.set(clientId, registration);
        json(response, 201, {
          ...registration,
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code'],
          response_types: ['code'],
        });
        return;
      }
      if (
        url.pathname === '/authorize' &&
        ['GET', 'POST'].includes(request.method ?? '')
      ) {
        const authorization = authorizationSchema.parse(
          Object.fromEntries(url.searchParams),
        );
        const client = clients.get(authorization.client_id);
        if (
          !client?.redirect_uris.includes(authorization.redirect_uri) ||
          authorization.resource !== options.resource ||
          authorization.scope !== options.scope
        ) {
          json(response, 400, { error: 'invalid_request' });
          return;
        }
        if (request.method === 'GET') {
          const action = `${url.pathname}${url.search}`
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;');
          response.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store',
          });
          response.end(
            `<!doctype html><html lang="en"><title>Local test sign-in</title><body><h1>Local test provider</h1><p>Authorize the template API as Test User.</p><form method="post" action="${action}"><button type="submit">Authorize test user</button></form></body></html>`,
          );
          return;
        }
        const code = randomUUID();
        codes.set(code, {
          authorization,
          expiresAt: Date.now() + (options.authorizationCodeTtlMs ?? 60_000),
        });
        const callback = new URL(authorization.redirect_uri);
        callback.searchParams.set('code', code);
        callback.searchParams.set('state', authorization.state);
        callback.searchParams.set('iss', issuer);
        response.writeHead(302, {
          Location: callback.href,
          'Cache-Control': 'no-store',
        });
        response.end();
        return;
      }
      if (request.method === 'POST' && url.pathname === '/token') {
        const tokenRequest = new URLSearchParams(body);
        const code = tokenRequest.get('code') ?? '';
        const grant = codes.get(code);
        const verifier = tokenRequest.get('code_verifier') ?? '';
        if (
          !grant ||
          tokenRequest.get('grant_type') !== 'authorization_code' ||
          grant.expiresAt <= Date.now() ||
          tokenRequest.get('client_id') !== grant.authorization.client_id ||
          tokenRequest.get('redirect_uri') !==
            grant.authorization.redirect_uri ||
          tokenRequest.get('resource') !== options.resource ||
          !/^[\w.~\-]{43,128}$/.test(verifier) ||
          createHash('sha256').update(verifier).digest('base64url') !==
            grant.authorization.code_challenge
        ) {
          json(response, 400, { error: 'invalid_grant' });
          return;
        }
        codes.delete(code);
        const accessToken = await new SignJWT({
          scope: options.scope,
          name: 'Test User',
          email: 'test@example.com',
        })
          .setProtectedHeader({ alg: 'RS256', kid: 'local-test-key' })
          .setIssuer(issuer)
          .setAudience(options.audience)
          .setSubject('local-test-user')
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(keys.privateKey);
        json(response, 200, {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 300,
          scope: options.scope,
        });
        return;
      }
      json(response, 404, { error: 'not_found' });
    })().catch(() => {
      if (response.headersSent) {
        response.end();
        return;
      }
      json(response, 400, { error: 'invalid_request' });
    });
  });
  server.listen(options.port ?? 0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No provider port');
  issuer = `http://127.0.0.1:${address.port}`;
  return {
    issuer,
    setJwksMode(mode: JwksMode) {
      jwksMode = mode;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
