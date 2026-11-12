# TypeScript Fullstack Template

A production-ready fullstack monorepo template with a **NestJS** API, **React** frontend, and shared tooling — designed to be forked and adapted for real projects.

## Tech Stack

| Layer        | Technologies                                                                       |
| ------------ | ---------------------------------------------------------------------------------- |
| **Monorepo** | Turborepo, pnpm workspaces                                                         |
| **Frontend** | React 19, Vite 8, TanStack Query 5, shadcn/ui (Tailwind CSS 4), Playwright, Vitest |
| **Backend**  | NestJS 11, MikroORM 7, PostgreSQL, Swagger/OpenAPI, jose (JWT)                     |
| **Shared**   | TypeScript 6, ESLint 10 (flat config), Prettier, OpenAPI contract generation       |

## Architecture

```
apps/
  api/                → NestJS REST API (see apps/api/README.md)
  web/                → React SPA (see apps/web/README.md)
packages/
  api-contracts/      → OpenAPI-generated TypeScript types
  eslint-config/      → Shared ESLint flat config
  shared/             → Shared utilities (see packages/shared/README.md)
  typescript-config/  → Shared tsconfig presets
```

## Quick Start

### Prerequisites

- Node.js (see `.nvmrc`)
- pnpm >= 10
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start the database
pnpm db:start

# Run migrations
pnpm --filter api db:migrate:up

# Seed development data
pnpm --filter api db:seed:local

# Start all apps in dev mode
pnpm dev
```

The API runs at `http://localhost:3000/api` and the frontend at `http://localhost:5173`.

- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI spec: `http://localhost:3000/openapi.yaml`

### Running Parallel Workspaces

Postgres, the API, and the Vite dev server all read their ports from `.env`
files, so multiple checkouts of this repo (e.g. parallel conductor
workspaces) can run `pnpm dev` at the same time without fighting over host
ports. To set one up:

```bash
scripts/setup_parallel_workspace.sh
```

This copies `.env.example` → `.env` for the root, `apps/api`, and
`apps/web`, filling in random free ports for Postgres, the API, and the web
dev server. The E2E test database port is handled separately — see
[apps/api/README.md](./apps/api/README.md#parallel-workspace-ports).
[PORTS.md](./PORTS.md) lists which file holds which port, and the gotchas
(Vite's IPv6-only bind, its silent fallback to the next free port).

## What's Included

### Item CRUD Example

A complete working example demonstrating the full stack:

- **API**: `GET/POST/PATCH/DELETE /api/items` with Swagger documentation
- **Frontend**: Items list page with create/edit/delete dialogs (shadcn/ui)
- **Type Safety**: OpenAPI contract → generated types → typed React Query hooks
- **i18n**: Translations in English, French, and Spanish
- **Tests**: Unit tests (Vitest) and E2E tests (supertest for API, Playwright for web)

### Authentication

A pluggable JWT authentication system ready for any OIDC provider:

- **Strategy pattern**: `AuthGuard` → `AuthStrategy` interface → `JwtAuthStrategy` / `MockAuthStrategy`
- **JWT verification**: JWKS, audience, issuer, and scope validation via `jose`;
  the expected audience is `AUTH_AUDIENCE`, defaulting to `AUTH_CLIENT_ID`
- **OIDC discovery**: Automatic metadata and JWKS endpoint resolution
- **Caller identity**: both strategies produce `{ sub, email?, name? }`; read it
  in a handler with `@CurrentUser()`, or from `GET /api/me`. Key anything you
  persist about a user on `sub`, the only claim OIDC guarantees to be stable.
- **Dev mode**: `FAKE_AUTH=true` bypasses auth for local development. It
  refuses to start unless `NODE_ENV` is explicitly `development` or `test`, and
  the `AUTH_*` variables are then optional. Every request is the mock user;
  send `Authorization: Bearer mock-second-user` to act as a second user.

Configure your OIDC provider with three env vars:

```env
AUTH_OIDC_DISCOVERY_URL=https://your-provider/.well-known/openid-configuration
AUTH_CLIENT_ID=your-client-id
AUTH_ACCEPTED_SCOPES=your.scope
```

The token's `aud` claim must equal `AUTH_CLIENT_ID`, or `AUTH_AUDIENCE` when set.

> **Upgrading from an earlier version of this template:** the expected audience
> used to be hardcoded to `api://<AUTH_CLIENT_ID>` (the Entra ID convention). If
> your provider issues that audience, set `AUTH_AUDIENCE=api://<client-id>`, or
> every request will be rejected with 401.

On the web side, auth is an `AuthSession` (observable state, bearer token,
sign-out) plus a `SignInButton` component, so redirect, popup, and
provider-rendered buttons all fit the same interface. The template ships only
the development adapter (`VITE_FAKE_AUTH=true`); with it off, the app refuses
to start until you add an adapter for your provider —
see [ADR 0008](./docs/adr/0008-web-auth-module-boundaries.md).

### CLI Commands

A `nest-commander` CLI shell for background jobs, data migrations, or one-off scripts:

```bash
pnpm --filter api command:build-and-run:example
```

### API Contract Generation

The frontend consumes types generated from the backend's OpenAPI spec — no manual type duplication:

```bash
# Start the API, then regenerate types
pnpm generate:api-types
```

CI checks for contract drift to prevent frontend/backend type mismatches.

## Deployment

`deployment/Dockerfile` builds one image holding the API and the built SPA.
NestJS serves the SPA (with an `index.html` fallback for client routes) when
`SERVE_STATIC_DIR` is set, which the image does; API paths (`/api/*`,
`/health/*`, `/openapi.yaml`) never fall through to it. Unset the variable to
host the SPA elsewhere and run the image as a JSON API. Rationale and when to
split: [ADR 0009](./docs/adr/0009-spa-served-by-the-api.md).

The container entrypoint applies pending migrations before starting
([ADR 0001](./docs/adr/0001-migrations-run-on-container-start.md)) and runs
as the unprivileged `node` user. It needs `NODE_ENV`, `DATABASE_URL`, and the
real-auth `AUTH_*` variables (fake auth is refused in production); set
`DB_SSL=false` for a database without TLS.

```bash
pnpm build:docker   # builds template-app:local
```

VITE\_\* values are inlined at build time (`--build-arg VITE_FAKE_AUTH=…`);
`VITE_API_URL` is left unset so the SPA calls the API on its own origin. The
template ships no production web auth adapter, so add one before deploying
([ADR 0008](./docs/adr/0008-web-auth-module-boundaries.md)).

## CI Pipeline

The template ships with a comprehensive GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every PR and push to `main` (the test jobs can [reuse a passing result](#reusing-passing-checks)):

| Job                       | What it checks                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Format Check**          | Prettier formatting compliance                                                                                                                            |
| **Check Dependencies**    | Dependency health                                                                                                                                         |
| **Check Types**           | TypeScript `--noEmit` across all packages                                                                                                                 |
| **Lint**                  | ESLint (flat config) across all packages                                                                                                                  |
| **API Contract Check**    | Starts the API, regenerates OpenAPI types, and fails if the generated contract differs from what's committed — catches frontend/backend drift             |
| **Unit Tests**            | Vitest for API and Web (parallel matrix), with coverage upload                                                                                            |
| **API E2E Tests**         | Supertest against a real PostgreSQL service container — tests auth (JWT lifecycle) and CRUD endpoints, collects coverage                                  |
| **Coverage Report**       | Merges API unit + E2E coverage into one report and posts sticky PR comments (API and Web) with the evolution vs `main` (baseline cached from main builds) |
| **Web E2E Tests**         | Playwright in headless Chromium, with report and screenshot artifacts on failure                                                                          |
| **Real-stack Web E2E**    | Native Playwright regression tests against the running API and PostgreSQL                                                                                 |
| **Production Image Boot** | Builds `deployment/Dockerfile`, boots it with `NODE_ENV=production` against Postgres, and checks migrations, health, SPA routing and API 401/404s         |

Jobs that install dependencies use a shared `ci-setup` composite action for consistent Node.js/pnpm setup and caching.

### Reusing passing checks

Commits that only touch documentation or agent instructions do not rerun the
test jobs ([ADR 0012](docs/adr/0012-ci-reuses-passing-checks.md)).

**Select Checks** hashes every committed file except the paths listed in
`NON_TEST_INPUTS` in [`scripts/ci/check-reuse.mjs`](scripts/ci/check-reuse.mjs)
and looks for a passing result saved under that hash. On a hit, API Contract
Check, Unit Tests, API E2E, Coverage Report, Web E2E, Real-stack Web E2E and
Production Image Boot are skipped; GitHub treats a skipped job as passing for
required status checks. Format, dependencies, types and lint run on every
commit, and they are what covers the excluded paths.

**Save Passing Checks** records the hash once every job has succeeded.

| Situation                                                | Test jobs                |
| -------------------------------------------------------- | ------------------------ |
| PR or `ci/**` push, a passing result exists for the hash | Skipped                  |
| No passing result for the hash                           | Run                      |
| Push to `main`, manual run (`workflow_dispatch`)         | Always run               |
| **Re-run all jobs**                                      | Always run               |
| **Re-run failed jobs**                                   | Keeps the first decision |

The job summary of Select Checks names the commit and run whose result was
reused. A result is visible to the branch that saved it and to branches based
on `main` when `main` saved it (GitHub cache scoping), and expires with the
cache (seven days unused).

When you change the pipeline:

- A new check job goes in the `needs` list of `save-passing-checks`; a job
  missing from it does not guard the saved result. A new test job also takes
  the same `needs`/`if` gate as the existing ones.
- A new kind of file that no test reads goes in `NON_TEST_INPUTS`, with a case
  in `scripts/ci/check-reuse.test.mjs`. Unlisted paths count as test inputs, so
  forgetting this costs a test run and never skips one.
- To drop every saved result, bump the `passing-checks-v1` prefix in the
  workflow.

## Completing Implementation Work

Use the `finish-work` skill to select and explain verification for the affected
behavior and its dependencies, check acceptance criteria, and review the diff.
Scope checks by impact: shared code, contracts, configuration, and dependency
changes can affect consumers beyond the edited component. Report the checks,
results, and gaps in the task or PR. Full CI supplies the broad safety net;
`pnpm dod` optionally runs broad local checks. Start PostgreSQL with
`pnpm db:start` first when those checks need it. Migration verification uses a
disposable database on the configured E2E server and needs database creation
privileges.

For changed runtime flows, use the `verify-app` skill:

```bash
scripts/verify-app.sh
pnpm --filter web test:e2e:real           # Native real-stack Playwright tests
pnpm --filter web test:e2e:real items-crud # Select tests by file while iterating
pnpm probe --goto /                       # Explore the running app
scripts/verify-app.sh stop
```

The web has three complementary test layers: Vitest integration tests use real
providers with MSW; `test:e2e` exercises browser behavior with a mocked API;
`test:e2e:real` uses native Playwright tests against the running API and database.
CI runs both browser suites. The probe produces concise accessibility snapshots,
errors, and screenshots for agent exploration and accepts temporary scenarios;
promote reusable exploratory flows to native real-stack regression tests.
Stop the verification stack after use, including on failure. Committing remains
subject to the user's authorization.

## Scripts

| Script                       | Description                               |
| ---------------------------- | ----------------------------------------- |
| `pnpm dev`                   | Start all apps in dev mode                |
| `pnpm build`                 | Build all apps                            |
| `pnpm check-types`           | TypeScript type checking (all packages)   |
| `pnpm lint`                  | ESLint (all packages)                     |
| `pnpm format`                | Prettier + ESLint fix                     |
| `pnpm test`                  | Unit tests (all packages)                 |
| `pnpm --filter api test:e2e` | API E2E tests (supertest)                 |
| `pnpm --filter web test:e2e` | Web E2E tests (Playwright)                |
| `pnpm generate:api-types`    | Regenerate OpenAPI types from running API |

## Agent Instructions

[AGENTS.md](AGENTS.md) is the shared instruction source for Codex and Claude
Code. [CLAUDE.md](CLAUDE.md) imports it for Claude Code. Canonical workflows live
in [.claude/skills/](.claude/skills/) and path rules in
[.claude/rules/](.claude/rules/); the root instructions tell both agents when to
read them. Codex discovers the same skills through `.agents/skills/` symlinks,
so workflow bodies stay in one place. Checkouts need symlink support; on Windows,
enable Developer Mode or configure Git symlink support before cloning.

## Coding Standards

For coding conventions, architecture patterns, and entity definitions, see the standards files:

- [Global standards](./STANDARDS.md) — TypeScript, imports, naming
- [API standards](./apps/api/STANDARDS.md) — NestJS modules, MikroORM entities, DTOs
- [Web standards](./apps/web/STANDARDS.md) — React components, API hooks, auth, i18n
- [Architecture decisions](./docs/adr/) — compact ADRs for the trade-offs the template ships with

## Adapting This Template

1. **Fork or clone** this repository
2. **Replace the Item example** with your own domain entities and features
3. **Configure auth**: set the `AUTH_*` env vars for your OIDC provider on the API, and add a web `AuthSession` adapter for it ([ADR 0008](./docs/adr/0008-web-auth-module-boundaries.md))
4. **Generate a fresh migration** after modifying entities: `pnpm --filter api mikro-orm migration:create --name=initial`
5. **Regenerate API contracts** after changing endpoints: `pnpm generate:api-types`

## License

[MIT](LICENSE)
