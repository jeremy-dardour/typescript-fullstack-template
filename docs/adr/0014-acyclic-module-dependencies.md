# ADR 0014: Feature modules depend on each other without cycles

**Status:** Accepted — 2026-11

**Amends:** [ADR 0010](0010-public-interfaces-and-file-roles.md), which lets a
feature module import another through its public `index.ts`. Its other
decisions remain in force.

## Context

`import-x/no-cycle` detects cycles between files only. Two modules can depend
on each other through their public interfaces without any file-level cycle:
one module's service imports the other's types, and the other's repository
imports the first one's store. Each step is allowed, and together they couple
the two modules so neither can change or be extracted alone.

## Decision

The graph of dependencies between `src/modules/<name>` folders is acyclic.
`apps/api/scripts/check-module-cycles.mts` collapses every non-test file to its
module, counts static, type-only and dynamic imports and re-exports through
relative or `@/` specifiers, and fails on any cycle. It runs in the API's
`lint` script, so `pnpm lint` and CI enforce it.

## Consequences

- A cycle fails lint with the modules involved and one `file:line` per edge.
- Breaking a cycle means moving the shared part to the module both depend on,
  to an `app/` area or to `shared/`, or inverting one dependency.
- The checker discovers modules from the folder; it needs no upkeep when
  modules are added.
