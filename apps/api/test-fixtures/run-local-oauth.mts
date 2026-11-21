import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { startOAuthProvider } from './oauth-provider.mts';

config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const address = reservation.address();
if (!address || typeof address === 'string')
  throw new Error('No allocated API port');
const port = address.port;
await new Promise<void>((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);

const resource = `http://127.0.0.1:${port}/mcp`;
const audience = 'template-api-local-test';
const scope = 'items:access';
const provider = await startOAuthProvider({ resource, audience, scope });
const child = spawn('pnpm', ['start'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    FAKE_AUTH: 'false',
    AUTH_CLIENT_ID: 'template-api-local-resource',
    AUTH_OIDC_DISCOVERY_URL: provider.issuer,
    AUTH_AUDIENCE: audience,
    AUTH_ACCEPTED_SCOPES: scope,
    MCP_ENABLED: 'true',
    MCP_PUBLIC_URL: resource,
  },
  stdio: 'inherit',
  detached: process.platform !== 'win32',
});
const lifecycle = { isClosing: false };

async function shutdown(code: number): Promise<void> {
  if (lifecycle.isClosing) return;
  lifecycle.isClosing = true;
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
    await exited;
  }
  await provider.close();
  process.exitCode = code;
}

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
child.once('error', (error) => {
  console.error(error.message);
  void shutdown(1);
});
child.once('exit', (code) => {
  if (!lifecycle.isClosing) void shutdown(code ?? 1);
});

try {
  const deadline = Date.now() + 45_000;
  let isReady = false;
  while (!lifecycle.isClosing && Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/.well-known/oauth-protected-resource/mcp`,
        { signal: AbortSignal.timeout(1000) },
      );
      if (response.ok) {
        isReady = true;
        break;
      }
    } catch {
      // The API compiles before binding its listener.
    }
    await setTimeout(250);
  }
  if (!isReady && !lifecycle.isClosing)
    throw new Error('The local OAuth API did not become ready');
  if (isReady) {
    console.log(`Local test OAuth provider: ${provider.issuer}`);
    console.log(`MCP endpoint: ${resource}`);
    console.log(
      'Connect an HTTP MCP client and choose "Authorize test user" in the browser.',
    );
    console.log(
      'The API uses real JWT verification. Ctrl-C stops both local processes.',
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Local OAuth startup failed',
  );
  await shutdown(1);
}
