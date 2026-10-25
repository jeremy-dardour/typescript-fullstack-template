# ADR 0009: The API serves the production SPA

**Status:** Accepted — 2026-10

## Decision

The production image contains both the NestJS API and the Vite-built SPA.
Nest serves the SPA through `ServeStaticModule` when `SERVE_STATIC_DIR` is set,
with an `index.html` fallback for client-side routes. Development leaves it
unset and runs Vite and Nest separately.

The fallback never answers API-owned paths — `/api/*`, `/health/*`, and
`/openapi.yaml` — so a miss there stays the API's RFC 9457 404 instead of an
HTML page with status 200.

## Why

One image gives one origin, one deploy, and one version: no production CORS
configuration, no auth redirect origin per host, and web and API can never be
deployed out of step. For most projects starting from this template, that is
the cheaper default.

## Consequences

- Web and API scale, release, and fail together.
- Static files get no CDN edge caching unless one is put in front.
- The image is larger by the size of the SPA build.
- The API-owned path list is part of the routing contract; a new top-level API
  path outside `/api` must be added to it (`static-assets.config.ts`).

## When to split

Serve the SPA from a static host or CDN, and unset `SERVE_STATIC_DIR`, when
asset latency or cold starts become user-visible, when web and API need
independent releases or scaling, or when the API is consumed by more than this
SPA.
