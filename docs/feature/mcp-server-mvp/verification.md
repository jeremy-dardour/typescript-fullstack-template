# MCP implementation verification

Verified locally on 2026-11-21 against the implemented
[requirements](draft-spec.md) and [design](draft-tech-design.md).

## Checks

| Check                                        | Result                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm format:check`                          | Passed.                                                                                       |
| `pnpm lint`                                  | Passed.                                                                                       |
| `pnpm check-types`                           | Passed, including compile-time tool argument/result mismatch cases.                           |
| `pnpm dependencies:check`                    | Passed; existing NestJS, Zod, MikroORM and TypeScript baseline retained.                      |
| `pnpm test`                                  | Passed: API 156, web 62, shared 3 tests.                                                      |
| `pnpm --filter api test:e2e`                 | Passed: 7 files, 82 tests against PostgreSQL.                                                 |
| `bash scripts/verify-app.sh`                 | Reported `verify-app: OK`; health, readiness, OpenAPI and SPA reachable.                      |
| `pnpm generate:api-types`                    | Regenerated from the final running API; no additional contract drift.                         |
| `pnpm --filter web exec tsc -b --force`      | Passed after regeneration.                                                                    |
| `pnpm --filter web test:e2e:real`            | Passed: Item CRUD, pagination and sign-out/sign-in in Chromium.                               |
| `pnpm --filter api mcp:smoke` and `--legacy` | Passed against the running development API and final production image; owned records removed. |
| `pnpm build:docker`                          | Final source built successfully.                                                              |

## Acceptance coverage

Retained tests live under `apps/api/src/app/mcp/__tests__/`,
`apps/api/src/app/config/__tests__/`, `apps/api/src/__e2e-tests__/` and
`apps/web/e2e/real/`.

| Requirement                  | Observed evidence                                                                                                                                                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery and revisions      | Actual SDK clients exercise modern `2026-07-28` and legacy `2025-11-25`, `2025-06-18`, `2025-03-26`; the real v1 SDK also completes the lifecycle. Metadata, five definitions, schemas, annotations and capabilities are asserted.                                          |
| Authentication               | Shared REST/MCP verification rejects missing, expired, tampered, wrong-issuer and wrong-audience credentials; scope failures are distinct from unavailable or malformed provider/JWKS responses.                                                                            |
| OAuth sign-in                | Official client follows the initial challenge through resource/provider discovery, registration, browser consent, PKCE, callback, token exchange and authenticated retry over real HTTP. Chromium drives the fixture page.                                                  |
| Item lifecycle and parity    | Database tests cover all five tools, both directions of REST/MCP reads, nullable descriptions, update omission, deletion and read-after-delete; successful structured results match JSON text.                                                                              |
| Validation and output safety | Invalid names, IDs, pages, null names and unknown fields are rejected without unintended writes. Type tests reject incompatible handlers. Runtime tests reject invalid or non-JSON output and verify local schema references.                                               |
| Privacy and caller context   | Tests cover safe errors, input-free outcome telemetry, output failures and concurrent caller isolation.                                                                                                                                                                     |
| Transport and tracing        | Unsupported revisions, malformed requests, content types, authenticated 405s, early HTTP errors, deadlines, disconnects and response/log identifiers have regression coverage. Delayed writes demonstrate that an expired response deadline does not roll back persistence. |
| Browser access               | Native Chromium checks production preflight, allowed/disallowed origins and readable authentication/tracing headers; OAuth tests separately exercise browser sign-in.                                                                                                       |
| Rate limits                  | Tests exhaust one subject's MCP allowance, preserve another subject's and REST allowances, and assert actual limit/retry information.                                                                                                                                       |
| Routing and disabling        | Runtime tests cover MCP and metadata routes with static serving enabled/disabled. Production checks confirm SPA fallback, API exclusions and disabled MCP 404s.                                                                                                             |

## Production image

The final image ran with `NODE_ENV=production`, normal JWT authentication,
PostgreSQL and the existing migration entrypoint. An isolated local HTTPS
issuer supplied metadata, JWKS and signed access tokens; its dedicated test CA
was trusted through `NODE_EXTRA_CA_CERTS`. TLS and token verification remained
enabled. Both smoke modes exercised discovery, CRUD, pagination, description
clearing and cleanup. The process ran as UID 1000 and logged no errors.

Production routing checks also verified public metadata and its canonical URL,
unauthenticated REST/MCP challenges, health/readiness, SPA navigation, missing
API/assets/docs, writable ORM metadata cache and startup with MCP disabled and
no public MCP URL. Test containers and fixture processes were removed; the
script-owned development stack was stopped.

## Verified clients and limits

The automated clients use `@modelcontextprotocol/client` 2.4.0 and the v1 SDK
1.32.2. The server uses `@modelcontextprotocol/server` 2.4.0 and the Node adapter
2.1.2.

Claude Code 2.1.329 connected to the local HTTP OAuth fixture using isolated
MCP configuration. Its `/mcp` flow completed browser consent and reported five
tools with protocol `2026-07-28`. Actual host tool calls created, retrieved,
listed, updated and deleted an owned Item. The test server's stored
authentication was cleared afterwards.

These checks establish interoperability with the local test provider and the
listed clients. They do not establish login compatibility with a deployed
identity provider, Inspector or arbitrary hosts. Production providers still
need compatible client registration, redirects and mapping from the public MCP
resource URL to the configured REST audience. Inspector has setup instructions
but was not separately exercised.

CI retains unit, API end-to-end, browser, contract and production boot checks;
the real-stack job also runs both shipped MCP smoke modes. Local results do
not claim a remote CI result.
