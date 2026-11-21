# Template API

NestJS backend for the fullstack template. Exposes a typed, contract-first REST API with OpenAPI and uses MikroORM for PostgreSQL persistence.

## Setup

1. Copy `.env.example` to `.env` and configure variables
2. Start database: `pnpm db:start`
3. Run migrations: `pnpm db:migrate:up`
4. Seed development data: `pnpm db:seed:local`
5. Start API: `pnpm dev`

## OpenAPI Contract

- API contract is exposed at `/openapi.yaml` when running
- Types are generated via `pnpm generate:api-types` at the root and stored in `packages/api-contracts`
- **Never** edit types manually; always update via OpenAPI

## Item Listing

`GET /api/items?page=1&page_size=20` returns a page containing `data`, `page`,
`page_size`, `total` and `total_pages`. The default page size is 20 Items and
the maximum is 100. Results sort by creation time descending, then UUID
descending to break ties. Offset pages can shift when records change between
requests. The response includes `Link`, `X-Total-Count` and `X-Page-Count`
headers; a page beyond the collection returns an empty `data` array.

## MCP Server

See the [verification record](../../docs/feature/mcp-server-mvp/verification.md)
for exercised clients, acceptance coverage and compatibility limits.

The MCP endpoint shares this API's process, port, authentication, Item services
and database. It uses stateless Streamable HTTP, with no application session
identifier or sticky-routing requirement. It supports protocol revisions
`2026-07-28`, `2025-11-25`, `2025-06-18` and `2025-03-26`; the SDK handles modern
discovery and legacy initialization. Stdio and legacy HTTP/SSE transports are
outside this template's MCP interface.

| Route                                           | Access and behavior                                        |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `POST /mcp`                                     | Authenticated MCP JSON messages.                           |
| `GET /mcp`, `DELETE /mcp`                       | Authenticated 405 responses; no persistent stream/session. |
| `GET /.well-known/oauth-protected-resource/mcp` | Public protected-resource metadata.                        |
| Any of these routes with MCP disabled           | 404; never the SPA shell.                                  |

| Setting                     | Meaning                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_ENABLED`               | Defaults to `true` in every environment; `false` removes the routes.                                                                     |
| `MCP_PUBLIC_URL`            | Required while enabled. External HTTP(S) URL with exact `/mcp` path and no credentials, query or fragment. Must use HTTPS in production. |
| `MCP_ALLOWED_ORIGINS`       | Additional exact browser origins, comma-separated. The public URL's own origin is always allowed.                                        |
| `MCP_RATE_LIMIT_PER_MINUTE` | Defaults to 120 authenticated MCP requests per subject per process per minute.                                                           |

The five tools are `list_items`, `get_item`, `create_item`, `update_item` and
`delete_item`. Listing takes optional integer `page` and `page_size` arguments
and returns the same page envelope as REST. Item results have UUID IDs, names,
required nullable descriptions and ISO timestamp strings. Success includes
structured content and equivalent JSON text for older clients. Unknown fields
are rejected. Omitted update descriptions are preserved; explicit null clears
them. Annotations describe behavior to hosts and do not grant permissions.

### SDK smoke check

Start the [real development stack](../../README.md#completing-implementation-work),
then run from the repository root:

```bash
pnpm --filter api mcp:smoke
pnpm --filter api mcp:smoke --legacy
```

The command loads `apps/api/.env`, using `MCP_PUBLIC_URL` or its configured API
port. `MCP_SMOKE_URL` overrides the target. Development mock auth permits the
normal local command without a token; with real auth, supply `MCP_ACCESS_TOKEN`
in the environment. The command checks discovery, all five tools, page
navigation, description clearing, read-after-delete and JSON-text/structured
output equivalence. It retains the advertised tool definitions so the official
client can validate output even when discovery caching is disabled.

Only the command's own records are deleted. Cleanup failures print their IDs
and return a nonzero exit status. A connection failure or timeout during a
mutation can leave the write's outcome unknown; inspect the collection before
retrying. The target hostname must match the configured public hostname in
production; use a local reverse proxy when connecting to an internal listener.
The smoke client runs from this checkout with development dependencies installed,
rather than inside the production image.

This token-based smoke command does not prove browser sign-in. The OAuth check
below exercises that separate flow.

### Local OAuth and Claude Code

An identity provider issues access tokens. An MCP host, such as Claude Code,
connects to `/mcp`, discovers how to sign in and sends those tokens on requests.
The template is the resource server; its production API does not operate an
authorization server.

For an isolated local check, start PostgreSQL and apply this checkout's dev
migrations, then run:

```bash
pnpm --filter api mcp:oauth:local
```

The harness reads the dev database configuration, allocates separate API and
provider ports, prints the MCP URL and starts the real API with `FAKE_AUTH=false`.
Its test-only provider supplies discovery, client registration, a sign-in/consent
page, PKCE authorization-code exchange and signed JWTs. The API validates their
issuer, audience, signature and scopes normally. The harness changes no `.env`
files; Ctrl-C stops its API/provider processes. This fixture is not included in
production images.

To check Claude Code without changing existing MCP registrations, create
`.verify-app/local-mcp.json` with the printed URL:

```json
{
  "mcpServers": {
    "template-local": {
      "type": "http",
      "url": "http://127.0.0.1:<printed-api-port>/mcp"
    }
  }
}
```

Then start an authenticated Claude Code CLI:

```bash
claude --strict-mcp-config --mcp-config .verify-app/local-mcp.json
```

Open `/mcp`, authenticate `template-local`, and choose **Authorize test user**
in the fixture's browser page. Confirm discovery of the five tools, then create,
read, update/clear and delete a uniquely named test Item. In `/mcp`, clear that
test server's stored authentication when finished, remove the temporary config
and stop the harness. Keep this HTTP connection token-free initially so the
test exercises metadata discovery and login. Claude Code's own account login
is separate from the fixture's API login.

The official SDK OAuth regression runs without a Claude account:

```bash
NODE_ENV=test pnpm --filter api exec vitest run --config vitest.e2e.config.mts src/__e2e-tests__/mcp-oauth.e2e-spec.ts
```

It drives the browser with Playwright and checks discovery, PKCE, callback and
authenticated retry over real HTTP. A successful SDK run verifies that client
and fixture combination. Record the installed Claude Code version and observed
host behavior separately; neither establishes compatibility with a particular
production identity provider. See the
[official Claude Code MCP guide](https://code.claude.com/docs/en/mcp) for current
HTTP/OAuth and callback options.

### Inspector

Run Inspector under a Node version supported by its release, independently of
the API's pinned runtime. Launch it with
`pnpm dlx @modelcontextprotocol/inspector`, then choose HTTP/Streamable HTTP and
the configured or printed MCP URL. Connect
without credentials in mock-auth development mode, or use OAuth with the local
fixture. For a real provider, follow that provider's client-registration and
redirect rules. List the five tools and inspect their inputs, output schemas,
annotations and actual result content. If a client sends an Origin header, allow that exact origin in the MCP
policy. Native clients commonly omit Origin. See
the [Inspector guide](https://modelcontextprotocol.io/docs/tools/inspector) for
its Node version requirements and client-specific controls.

### Real identity providers and hosted deployment

Use the existing `AUTH_OIDC_DISCOVERY_URL`, `AUTH_CLIENT_ID`, `AUTH_AUDIENCE`
and `AUTH_ACCEPTED_SCOPES` settings. The expected token audience remains the
REST audience, defaulting to `AUTH_CLIENT_ID` when `AUTH_AUDIENCE` is unset.
The provider must associate the canonical `MCP_PUBLIC_URL` resource indicator
with that audience. MCP clients send the resource URL during authorization and
token exchange; it is not automatically the same string as a provider-specific
audience. Scope checking retains REST's policy of accepting any configured
scope; the provider must issue claims matching the API's verifier.
The shared verifier uses the space-delimited `scp` claim when present, falling
back to `scope` only when `scp` is absent. It never combines conflicting claims.

Register the intended MCP client with the provider, including its allowed
redirect URI and public-client PKCE behavior. Providers may support dynamic
registration/client metadata, or require pre-registered client credentials.
Configure that supported path in the host. The API's protected-resource
metadata points at the actual issuer and accepted scopes; it does not register
clients, proxy login, exchange credentials or relay incoming tokens elsewhere.
March 2025 clients can use the transport while requiring a manually configured
token because their protocol predates the metadata-based discovery flow.

Serve `https://api.example.com/mcp` and
`https://api.example.com/.well-known/oauth-protected-resource/mcp` at those exact
paths. Configure `MCP_PUBLIC_URL=https://api.example.com/mcp`. A reverse proxy
must preserve the public `Host` header and forward authorization, JSON content,
accept and MCP headers. The API validates Host against the configured public
hostname in production and allows loopback hosts additionally in development.
The advertised URLs come from configuration, rather than arbitrary Host or
forwarded headers. Arbitrary external path-prefix rewrites are not supported.

Use `MCP_ALLOWED_ORIGINS` for additional exact browser origins. The MCP origin
check and CORS share one policy, including preflight and readable
`WWW-Authenticate`/tracing headers. Requests without Origin remain usable by
native clients. The REST `ALLOWED_ORIGINS` setting does not independently grant
MCP browser access. Do not cache discovery or tool lists in a shared proxy.

The MCP allowance is separate from REST; failed authentication does not consume
it. Metadata has a public IP-based allowance. Per-process storage means two
replicas provide independent budgets; a global allowance requires shared
limiter storage. `429` responses include actual retry information. The API's
15-second request deadline is a waiting limit, not a rollback or cancellation
guarantee for database mutations. Set proxy timeouts to allow that response to
reach the client. Stateless routing needs no sessions or sticky balancing.

Set `MCP_ENABLED=false` to disable both protocol and metadata routes while
retaining REST. A fork that removes MCP entirely should remove the MCP module
wiring, feature tool providers, SDK-only dependencies/configuration/tests and
matching documentation; retain shared application services and Zod contracts.

## Development Standards

- Controllers are thin, DTOs are explicit and validated
- Entities are not exposed directly; always map to DTOs
- All cross-app types flow through OpenAPI and `packages/api-contracts`

## MikroORM & TsMorphMetadataProvider

- MikroORM uses the TsMorphMetadataProvider, meaning **TypeScript types are the source of truth for your database schema**
- Stay DRY: define your entity structure in TypeScript, and decorators only where they affect runtime (e.g., `@PrimaryKey`, `@Property({ unique: true })`, `@ManyToOne`)
- Avoid repeating type, nullable, or length info in decorators if TypeScript already expresses it
- All entity metadata must be statically analyzable — avoid dynamic decorators or runtime tricks

## API schemas and OpenAPI

- Define application-owned request/response structures with Zod and infer their
  TypeScript types. Keep entity-to-response mapping explicit.
- Bind input schemas through Nest's native parameter options, for example
  `@Body({ schema: createItemSchema })`; inferred TypeScript types alone do not
  validate incoming JSON. The route schema-coverage test checks these bindings.
- Use strict request objects, explicit nullability and transport-appropriate
  parsing. Invalid bodies return 422; malformed path/query values return 400.
- Document responses through `@ApiResponse({ standardSchema: itemSchema })`.
  The same schemas supply REST documentation and MCP contracts. Preserve schema
  component names and regenerate frontend types after API changes.
- The final application uses Zod rather than a parallel class-validator DTO
  path. See [ADR 0017](../../docs/adr/0017-schema-first-application-contracts.md)
  and [API standards](STANDARDS.md#dtos) for the complete convention.

## Database Migration Workflow

1. Modify entities (TypeScript classes)
2. Generate migration: `pnpm mikro-orm migration:create --name=update_my_entity`
3. Review migration — check for data loss, index changes, nullability
4. Apply: `pnpm db:migrate:up`

> Always review generated migrations before applying to production.

`pnpm db:migrate:fresh` drops every table and reruns the migrations. Before running it, investigate a schema mismatch against the migrations and the database state, and confirm the target is this checkout's disposable development database (the configured `DATABASE_URL`; parallel checkouts use different ports, see [PORTS.md](../../PORTS.md)).

## Parallel Workspace Ports

Running multiple workspaces in parallel (e.g. via conductor)? Run
`../../scripts/setup_parallel_workspace.sh` from the repo root — it writes
random free ports into the root `.env`, `apps/api/.env`, and `apps/web/.env`
(see the root [README](../../README.md#running-parallel-workspaces)).

The E2E test database port is handled separately, since `.env.e2e` is a
tracked fixture (default port `5433`) shared across workspaces and CI. The
script never edits it — instead it writes an **untracked**
`apps/api/.env.e2e.local` containing just the workspace's `DATABASE_URL`.
This is loaded after `.env.e2e` (`src/__e2e-tests__/setup.ts`, `override:
true`) and by the `db-e2e:*` scripts, so it wins when present and falls back
to the default otherwise. CI is unaffected: it injects its own `DATABASE_URL`
directly via the workflow, and never reads either file.

## CLI Commands

The template includes a `nest-commander` CLI shell for background jobs or one-off scripts:

```bash
pnpm command:build-and-run:example
```

Add new commands in `src/commands/`. Environment variables required:

- All mandatory env variables in `env.base.schema.ts`
- All mandatory env variables in `commands/env.schema.ts`

## Scripts

| Script                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm mcp:smoke`       | Exercise the five MCP tools against a running API             |
| `pnpm mcp:oauth:local` | Start an isolated API and local OAuth fixture                 |
| `pnpm dev`             | Start in dev mode                                             |
| `pnpm build`           | Build for production                                          |
| `pnpm test`            | Run unit tests                                                |
| `pnpm test:cov`        | Unit tests with coverage                                      |
| `pnpm test:e2e`        | E2E tests (requires running PostgreSQL)                       |
| `pnpm test:cov:merged` | Unit + E2E coverage merged into one report (`coverage/final`) |
| `pnpm db:start`        | Start PostgreSQL via Docker                                   |
| `pnpm db:migrate:up`   | Run pending migrations                                        |
| `pnpm db:seed:local`   | Seed development data                                         |
| `pnpm lint`            | ESLint                                                        |
| `pnpm check-types`     | TypeScript type checking                                      |
