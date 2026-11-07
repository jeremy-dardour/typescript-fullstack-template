---
paths:
  - '**/package.json'
  - 'pnpm-lock.yaml'
  - 'pnpm-workspace.yaml'
---

# Dependencies

- After any dependency change, run `pnpm dependencies:check` (syncpack — the
  CI "Check Dependencies" job). Fix drift with `pnpm dependencies:fix`, then
  `pnpm install` so the lockfile follows.
- Never hand-edit `pnpm-lock.yaml`. On a merge or rebase conflict, take either
  side and run `pnpm install` to regenerate it.
- `overrides` and `packageExtensions` live only in `pnpm-workspace.yaml`. A
  `pnpm` block in the root `package.json` silently takes precedence and is
  invisible to syncpack — do not add one.
- After `pnpm install`/`pnpm up`, read the unmet-peer warnings: a new one means
  a package under-declares or caps a peer. Fix it (`packageExtensions`, an
  override, or holding the upgrade) or record why it is harmless.
- Major upgrades: one commit per ecosystem (e.g. NestJS, Vitest), read the
  migration guide first, then use [finish-work](../skills/finish-work/SKILL.md)
  to select checks for the affected ecosystems and runtime dependencies.
