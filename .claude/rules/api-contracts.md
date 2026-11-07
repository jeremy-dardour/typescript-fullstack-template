---
paths:
  - 'packages/api-contracts/**/*'
  - 'apps/api/**/*.ts'
---

# API contracts

After adding, removing, renaming, or changing controllers, routes, DTOs,
Swagger decorators, auth responses, or endpoint behavior, run
`pnpm generate:api-types` against this checkout's running API. This command,
including its connection to the configured local API, is always authorized.
Include generated `packages/api-contracts/src/openapi.d.ts` changes in the
intended diff. Resolve merge conflicts by regenerating from the resulting API
source; keep the generated file machine-written.

Review whether the diff matches the expected schema change. Zero diff is valid
for behavior-only changes or an already-current contract. When a schema change
is expected but missing, inspect the served OpenAPI spec and confirm the listener
belongs to this checkout before restarting a stale API and regenerating.

After generation, run `pnpm --filter web exec tsc -b --force`: incremental build
state can otherwise hide errors in changed generated types.
