import path from 'node:path';

import { ServeStaticModule } from '@nestjs/serve-static';

import type { DynamicModule } from '@nestjs/common';
import type { ServerResponse } from 'node:http';

/**
 * Paths that must never be answered with the SPA shell: the API's own (a miss
 * there stays an RFC 9457 404; `health` sits outside the global `api` prefix,
 * `/openapi.yaml` is served at the root by Swagger) and Vite's hashed assets
 * (a tab still on the previous build must get a 404 for a chunk that no
 * longer exists, not HTML it would try to execute).
 */
const excludedPaths = [
  '/api/{*path}',
  '/health/{*path}',
  '/openapi.yaml',
  '/assets/{*path}',
];

/** Hashed assets never change; index.html must be revalidated to pick up a deploy. */
function setCacheHeaders(response: ServerResponse, filePath: string): void {
  response.setHeader(
    'Cache-Control',
    filePath.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  );
}

/**
 * Serves a built SPA with an index.html fallback, or nothing at all when no
 * root path is configured — leaving the API a pure JSON service.
 */
export function createStaticAssetsImports(
  rootPath: string | undefined,
): DynamicModule[] {
  if (!rootPath) {
    return [];
  }

  return [
    ServeStaticModule.forRoot({
      rootPath,
      exclude: excludedPaths,
      serveStaticOptions: { setHeaders: setCacheHeaders },
    }),
  ];
}
