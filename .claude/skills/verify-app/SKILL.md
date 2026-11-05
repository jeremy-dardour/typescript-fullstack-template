---
name: verify-app
description: Verify a code change in the running app — boot the full dev stack, check the API answers, then drive the web UI in a browser through the changed flow. Use for changed runtime behavior, dependency upgrades that affect startup or execution, or when asked to run, start, smoke-test, or screenshot the app.
---

# Verify the app

Unit and e2e suites do not prove the app starts: they load modules differently
from the real server (a package that under-declares a dependency can pass every
test and still crash `nest start`). This skill checks the app the way a user
meets it.

1. **Scope.** Identify the affected user flows and dependencies from the task
   and diff. Select relevant native real-stack tests and the acceptance
   criteria that need exploration. Use `finish-work` for completion checks;
   starting or inspecting the app alone does not require a completion pass.

2. **Boot.** Run `scripts/verify-app.sh`. It starts Postgres, applies
   migrations, starts API and web with the ports from the `.env` files, waits
   for them, and checks `/health/live`, `/health/ready`, `/openapi.yaml`, and
   that no `ERROR` was logged during boot. It must print `verify-app: OK`.
   On failure read `.verify-app/dev.log`. If it warns that migrating rewrote
   files under `migrations/`, the local database may hold another branch's
   schema. Review the changes against the pre-boot diff and preserve any
   intentional migration work. Keep incidental rewrites out of the intended diff.

3. **Contract.** If routes, DTOs, or Swagger decorators changed, run
   `pnpm generate:api-types` against the running API and review the diff to
   `packages/api-contracts/src/openapi.d.ts`. Follow the diagnostic rules in
   [CLAUDE.md](../../../CLAUDE.md#workflow) when an expected schema diff is missing.
   After generation run `pnpm --filter web exec tsc -b --force`; incremental
   build state can otherwise hide errors in changed generated types.

4. **Browser.** Run relevant native Playwright tests against the running stack
   with `pnpm --filter web test:e2e:real [test-file...]` (configuration:
   `apps/web/playwright.real.config.ts`). These permanent regression tests
   also run in CI. Add coverage under `apps/web/e2e/real/` using native
   assertions, fixtures, and reporting. Failure screenshots and traces go to
   `apps/web/test-results/real/`; the HTML report is in
   `apps/web/playwright-report/real/`. The separate `test:e2e` suite uses a
   mocked API.

   Explore acceptance criteria the retained tests do not cover with the probe:
   - `pnpm probe --goto <path>` opens a page and prints a concise accessibility
     snapshot, console errors, uncaught page errors, and HTTP errors.
   - For behavior, write a temporary scenario under `.verify-app/` (ignored)
     that default-exports `async ({ page, step, expect }) => {}`. Use the full
     Playwright `page` API and wrap user actions in `step()`. Run
     `pnpm probe <file>` from the repository root; paths resolve from there.
   - The probe exits non-zero on a failed step, console or page error, or 5xx,
     and saves screenshots to `.verify-app/probe/`. Chrome logs every 4xx as a
     console error: for an expected response, pass
     `--allow-console 'status of 404'`.
   - Promote reusable exploratory flows to native real-stack Playwright tests
     rather than retaining custom probe scenarios as the regression suite.
   - First run on a machine: `pnpm --filter web exec playwright install chromium`.

5. **Stop.** Run `scripts/verify-app.sh stop`, even after a failure. It stops
   the API and web it started; Postgres keeps running (`pnpm db:stop`).

Report what you exercised and the result of each step — including anything
you could not check.
