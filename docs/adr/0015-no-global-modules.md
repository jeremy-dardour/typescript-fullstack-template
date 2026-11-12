# ADR 0015: Feature modules and app areas are not global

**Status:** Accepted — 2026-11

**Amends:** [ADR 0010](0010-public-interfaces-and-file-roles.md), which makes
an area's or feature's `index.ts` the only way to reach its public interface.
Its other decisions remain in force.

## Context

A `@Global()` Nest module makes its exported providers injectable anywhere
without an import. A consumer then depends on the module without any import
statement, so the boundary rules and the module cycle check cannot see the
dependency.

## Decision

No module under `src/modules/**` or `src/app/**` is `@Global()`. Consumers
import the owning module through its public `index.ts`. App-wide guards,
filters and interceptors are registered as `APP_GUARD`, `APP_FILTER` or
`APP_INTERCEPTOR` providers in the root module. The `boundariesModules` lint
addon rejects the `Global` decorator in those folders.

## Consequences

- Every injected dependency on a module appears in the import graph.
- Root wiring (`src/*.module.ts`) and library options such as
  `ConfigModule.forRoot({ isGlobal: true })` stay outside the rule.
- Dynamic modules returning `global: true` are not caught by lint and are
  left to review.
