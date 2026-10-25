---
name: verify-app
description: Verify a code change in the running app — boot the full dev stack, check the API answers, then drive the web UI in a browser through the changed flow. Use before declaring any code change done, after dependency upgrades, or when asked to run, start, smoke-test, or screenshot the app.
---

# Verify the app

Unit and e2e suites do not prove the app starts: they load modules differently
from the real server (a package that under-declares a dependency can pass every
test and still crash `nest start`). This skill checks the app the way a user
meets it.

1. **Gate first.** Run the workflow gate from [CLAUDE.md](../../../CLAUDE.md)
   (check-types, lint, format, unit, and API e2e when the change calls for it).
   Don't boot the app to debug something the gate already reports.

2. **Boot.** Run `scripts/verify-app.sh`. It starts Postgres, applies
   migrations, starts API and web with the ports from the `.env` files, waits
   for them, and checks `/health/live`, `/health/ready`, `/openapi.yaml`, and
   that no `ERROR` was logged during boot. It must print `verify-app: OK`.
   On failure read `.verify-app/dev.log`. If it warns that migrating rewrote
   files under `migrations/`, the local database holds another branch's
   schema: restore those files and don't commit them.

3. **Contract.** If routes, DTOs, or Swagger decorators changed, run
   `pnpm generate:api-types` against the running API and review the diff to
   `packages/api-contracts/src/openapi.d.ts` (a zero diff after a contract
   change means a stale server answered).

4. **Browser.** Drive the changed flow with the probe runner (Playwright):
   - `pnpm probe --goto <path>` opens a page and prints its accessibility
     snapshot, console errors, uncaught page errors, and HTTP errors.
   - For behavior, write a scenario that default-exports
     `async ({ page, step, expect }) => {}` (full Playwright `page` API, each
     user action wrapped in `step()`), save it under `.verify-app/` (ignored)
     or next to `apps/web/e2e/probe/scenarios/items-crud.ts` if it is worth
     keeping, and run `pnpm probe <file>` from the repo root (paths resolve from there).
   - It exits non-zero on a failed step, a console or page error, or a 5xx,
     and saves screenshots to `.verify-app/probe/`. Chrome logs every 4xx as a
     console error: when the flow expects one, pass
     `--allow-console 'status of 404'`.
   - First run on a machine: `pnpm --filter web exec playwright install chromium`.

5. **Stop.** Run `scripts/verify-app.sh stop`, even after a failure. It stops
   the API and web it started; Postgres keeps running (`pnpm db:stop`).

Report what you exercised and the result of each step — including anything
you could not check.
