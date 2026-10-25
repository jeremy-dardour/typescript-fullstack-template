# CLAUDE.md

Production-ready fullstack monorepo template: NestJS API + React SPA + shared tooling.

See [README.md](./README.md) for project overview, setup, and CI pipeline.

## Visibility

**This repository is public.** Never commit personal information, secrets, or
private plans — in files, docs, code comments, examples, or commit messages.
Use generic placeholders instead. A project created from this template should
replace this note with its own visibility posture.

## Documentation map

Project knowledge — one home per fact. Read these to get oriented (rationale in
[ADR 0005](./docs/adr/0005-documentation-context-structure.md)):

| Doc                                                    | Holds                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [docs/project-purpose.md](./docs/project-purpose.md)   | Why the project exists, who it's for, scope boundaries              |
| [CONTEXT.md](./CONTEXT.md)                             | Domain glossary — entities, statuses, rules                         |
| [docs/domain-decisions.md](./docs/domain-decisions.md) | Domain/design decisions + rationale (append-only)                   |
| [docs/current-state.md](./docs/current-state.md)       | The live "where we are" — phase, status, next steps, open questions |
| [docs/sessions/](./docs/sessions/)                     | One dated summary per session (what was done, learnings, status)    |
| [docs/adr/](./docs/adr/)                               | Technical/architectural decisions                                   |

**Always loaded at session start** (imported so they're in context from the start):

@docs/project-purpose.md
@CONTEXT.md
@docs/current-state.md
@STANDARDS.md

Documentation conventions:

- **Project memory lives in-repo** (the docs above). Do **not** create external
  memory files for this project — record durable project facts here instead.
- **Single home per fact.** Live status lives only in `current-state.md`; domain
  decisions only in `docs/domain-decisions.md`; session files record what
  happened + learnings and link out rather than restating current truth.
- **Session summaries.** When logging or closing a session, use the
  `close-session` skill: it writes the summary in `docs/sessions/` from the
  template there ([docs/sessions/README.md](./docs/sessions/README.md)) and
  updates `current-state.md`.

## Monorepo structure

```
apps/
  api/          → NestJS REST API
  web/          → React SPA
packages/
  api-contracts/  → OpenAPI-generated TypeScript types
  eslint-config/  → Shared ESLint flat config
  shared/         → Shared utilities
  typescript-config/ → Shared tsconfig presets
```

## Commands

```bash
pnpm dev                        # Start all apps
pnpm check-types                # TypeScript type checking
pnpm lint                       # ESLint
pnpm test                       # Unit tests
pnpm --filter api test:e2e      # API E2E tests
pnpm --filter web test:e2e      # Web E2E tests
pnpm generate:api-types         # Regenerate OpenAPI types from running API
```

## Ports

**Never assume the default ports (5432 / 3000 / 5173)** — this checkout may be a
parallel workspace with randomized ports. Read the value from the right file
before curling, screenshotting, or connecting: [PORTS.md](./PORTS.md).

## Standards

[Global standards](./STANDARDS.md) — TypeScript, code style, comments — is
imported above, so it is always in context. The app-specific ones below are
loaded on demand by the path-scoped rules in `.claude/rules/`:

See [API standards](./apps/api/STANDARDS.md) — entities, modules, DTOs, architecture boundaries
See [Web standards](./apps/web/STANDARDS.md) — components, hooks, API layer, auth, i18n

## Decisions

Architectural trade-offs live in [docs/adr/](./docs/adr/) as compact ADRs
(migrations at container start, zod vs class-validator split, trust proxy).
Consult them before "fixing" what they document; record new decisions of that
kind as the next numbered ADR.

## Workflow

- Before declaring work done: `pnpm check-types && pnpm lint && pnpm format:check && pnpm test`
- After changing API routes, authentication, persistence, transactions, or
  concurrency behavior, also run `pnpm --filter api test:e2e`.
- After changing entities: regenerate and verify migrations (see
  [apps/api/README.md](./apps/api/README.md)).
- After adding, removing, renaming, or changing API controllers, routes, DTOs,
  Swagger decorators, auth responses, or any endpoint behavior: run
  `pnpm generate:api-types` and commit the regenerated
  `packages/api-contracts/src/openapi.d.ts`. Never hand-edit that generated
  file. Running `pnpm generate:api-types` is always authorized, including its
  connection to the configured local API.
- After `pnpm generate:api-types` with route/DTO changes, verify
  `openapi.d.ts` actually changed — a zero diff means a **stale API server**
  answered (a killed background dev task can leave its nest child holding
  the port; kill the listener on the API port and regenerate).
- After regenerating API types, run the web typecheck with `tsc -b --force` —
  turbo's incremental buildinfo has false-passed a stale generated-type change.

## Agent skills

### Issue tracker

GitHub Issues; PRDs and specs as committed markdown under `docs/specs/`. See
[docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical roles with their default strings (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See
[docs/agents/triage-labels.md](./docs/agents/triage-labels.md).

### Domain docs

Single-context — one root `CONTEXT.md` + `docs/adr/`; `CLAUDE.md` is the
documentation map. See [docs/agents/domain.md](./docs/agents/domain.md).
