# MCP implementation plan

This plan implements the approved [requirements](draft-spec.md) and
[technical design](draft-tech-design.md). The [decision map](decision-map.md)
records the settled choices. This document describes intended work and commit
boundaries, not completed implementation or verification results.

## Delivery rules

Each numbered slice is one proposed commit with one conceptual outcome. Keep
its implementation, affected consumers, generated contracts, documentation and
regression tests together. A commit must build and pass its relevant checks on
its own. Dependencies travel with their first consumer; do not create empty
scaffolding, dependency-only or tests-later commits.

Prefer vertical slices through actual HTTP, application behavior, persistence
and clients. The schema cleanup slices are bounded exceptions: they complete
the approved single validation convention. Temporary coexistence during this
sequence is allowed; the final template has one application-owned schema and
validation approach. Intermediate tool catalogs advertise only tools present
in that commit; the final catalog contains all five tools.

Do not reuse a historical implementation or its test results. Preserve the
current NestJS, MikroORM, TypeScript, linting, logging and formatting baseline.
Generate the pnpm lockfile through pnpm, inspect peer warnings and run
`pnpm dependencies:check` after dependency changes. Check the selected MCP
release's actual APIs and revision support against official documentation.

The subjects below define intended commit boundaries. Creating this plan does
not itself create commits or authorize publishing changes.

## Commit sequence

| Slice | Proposed subject                                                  | Complete outcome                                                                                           | Depends on |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| 01    | `docs(mcp): record the approved contracts and architecture`       | Requirements, design and architecture records agree.                                                       | —          |
| 02    | `fix(api): preserve tracing on early HTTP failures`               | Successes and early rejections carry consistent identifiers.                                               | 01         |
| 03    | `fix(api): report the limiter that actually rejected a request`   | REST throttling reports accurate limits and retry times.                                                   | 02         |
| 04    | `refactor(items): define REST contracts with Zod`                 | Item CRUD uses schema-first validation and documentation.                                                  | 02         |
| 05    | `feat(items): paginate listing across API and web`                | A user can browse bounded pages of Items in the real SPA.                                                  | 04         |
| 06    | `refactor(auth): define the current-user response with Zod`       | The authenticated user endpoint uses the same contract convention.                                         | 04         |
| 07    | `refactor(api): define Problem Details with Zod`                  | Error bodies and their documentation have one schema definition.                                           | 03, 04     |
| 08    | `refactor(api): finish the schema-first contract migration`       | Remaining application contracts migrate and the old validation stack is removed where dependencies permit. | 05–07      |
| 09    | `feat(mcp): serve authenticated stateless discovery`              | Clients discover a secured, configurable MCP endpoint in both protocol eras.                               | 08         |
| 10    | `feat(mcp): expose typed Item read tools`                         | Clients list and retrieve real records through discoverable feature providers.                             | 09         |
| 11    | `feat(mcp): create Items through the shared application service`  | MCP creation is visible through REST and the SPA.                                                          | 10         |
| 12    | `feat(mcp): update Items and clear descriptions`                  | MCP updates preserve omission/null semantics and REST parity.                                              | 11         |
| 13    | `feat(mcp): delete Items through the shared application service`  | The five-tool lifecycle works across REST and MCP.                                                         | 12         |
| 14    | `test(mcp): exercise OAuth sign-in with a local provider`         | A real SDK client completes discovery, PKCE, token exchange and retry against real HTTP.                   | 13         |
| 15    | `feat(mcp): ship repeatable client smoke checks and setup guides` | Operators can reproduce SDK checks and a local Claude Code connection.                                     | 14         |

### 01. Record approved contracts and architecture

- Align both drafts and the decision map with the accepted choices: default
  on in all environments, bounded pagination in both interfaces, decorated
  injectable providers with a small interface and typed tool factory,
  supported schema references, all application-owned contracts in Zod,
  accurate nullable descriptions and the existing REST audience.
- State the minimal SPA pagination scope and exact Item page envelope. Reuse
  the existing `page`, `page_size`, `data`, `total` and `total_pages` vocabulary;
  use the same page representation in REST and `list_items`. Default to page 1
  with 20 Items; accept at most 100 Items per page.
- Record architecture decisions for MCP placement/access and the Zod
  convention. Supersede ADR 0002's validation choice while explicitly
  describing intended behavior rather than claiming implementation exists.
- Distinguish SDK automation, Claude Code host testing and production-provider
  compatibility. A production identity provider is not required to start.

**Check:** cross-document consistency and formatting. No runtime checks are
needed for this documentation-only slice.

### 02. Preserve tracing on early HTTP failures

**Outcome:** an operator can correlate a response with server diagnostics even
when the request fails before reaching a controller.

- Inspect `main.ts`, CLS configuration, the context-header interceptor and
  the e2e app helper. Reproduce guard rejection without tracing headers.
- Establish request context and write response identifiers before body-parser,
  CORS, origin-policy or guard rejection. Preserve valid supplied identifiers
  according to the existing tracing convention and share the same identifiers
  with logging and Problem Details.
- Extract only the common HTTP setup needed by the application and HTTP
  tests: prefix handling, middleware, filters, interceptors, validation and
  CORS. Keep real OIDC initialization explicit in the real bootstrap.
- Preserve health endpoints and existing REST routing. Avoid an unrelated
  bootstrap redesign.

**Check:** actual HTTP success, unauthenticated request, malformed JSON and
unknown route, with generated and supplied identifiers. Exercise the real
bootstrap as well as the common test helper.

### 03. Report accurate rate-limit failures

**Outcome:** a throttled REST client receives the actual allowance, window and
remaining retry duration.

- Reproduce the configured-limit/filter-message mismatch and determine which
  exception filter handles the thrown throttler exception in the real app.
- Correct filter dispatch and replace hard-coded values with the rejecting
  limiter's actual limit, window and reset/block information.
- Preserve Problem Details formatting, tracing, useful `Retry-After` and
  privacy. Keep this slice scoped to existing REST behavior; add MCP's
  separate budget with its first endpoint in slice 09.

**Check:** use a low configurable test allowance and controlled time or storage
state to verify successive rejections and decreasing retry time. Cover normal
HTTP exceptions and unexpected failures after filter-order changes.

### 04. Migrate Item REST contracts to Zod

**Outcome:** existing Item CRUD demonstrates one schema definition for types,
runtime validation and OpenAPI.

- Replace Item input/output class DTO definitions with Zod schemas and
  inferred types. Use native Nest Standard Schema bindings and public error
  customization hooks. Keep services and repositories as the existing
  application/persistence boundaries.
- Bind schemas explicitly on body and UUID parameters. Reject unknown input
  keys; preserve 422 body failures and 400 malformed path/query failures.
  Normalize field errors with stable codes and escaped JSON Pointers without
  depending on English error-message matching or protected framework methods.
- Require names of 1–255 characters with a non-whitespace character, preserving
  supplied spacing. Names cannot be null. Accept omitted/string/null create
  descriptions; omission preserves an update description and null clears it.
- Map entities explicitly to JSON responses: required nullable description and
  ISO timestamp strings. Keep stable OpenAPI component names where possible.
- Regenerate frontend contracts and adapt affected consumers in this commit.
  Keep listing unpaginated until the complete pagination slice.

**Check:** real PostgreSQL CRUD and invalid requests, including null/omission,
unknown fields, invalid UUIDs, whitespace, maximum length and failed-write
integrity. Review the generated OpenAPI/type diff and exercise the SPA CRUD
flow after forced web type checking.

### 05. Deliver Item pagination through REST and the SPA

**Outcome:** users can navigate the Item collection without loading the full
table into one response.

- Define pagination constraints once; REST query parsing converts query text,
  while the eventual MCP input accepts JSON integers. Reject null, unknown
  keys, zero/negative/fractional pages and oversized page sizes.
- Add a repository page/count operation, expose it through the Item service,
  and return the approved page envelope from REST. Order by
  `createdAt DESC, id DESC`; document that offset pages may shift during writes.
- Reconcile the existing pagination DTO and Link-header interceptor assumptions
  so body metadata and HTTP links agree. Do not invent a second pagination
  model or add generic repositories.
- Update generated contracts, `use-items.ts`, Item page rendering, query keys,
  mutation invalidation, mock handlers, translations and affected tests.
- Add Previous/Next controls and page information. Handle an empty collection,
  loading/errors, first/last pages and deletion of the last Item on a page;
  return to a valid page after such a deletion. Preserve creation visibility.

**Check:** API page boundaries, default/max size, stable tie ordering, empty
and out-of-range pages; real-stack Playwright navigation with more than one
page, creation and last-row deletion. No hand-written duplicate frontend
response shape or casts to conceal generated-contract mismatches.

### 06. Migrate the current-user response to Zod

**Outcome:** `/api/me` has a schema-owned response contract without changing
identity semantics.

- Replace the current-user DTO class with its schema, inferred type, explicit
  mapping where needed and native Swagger response declaration.
- Preserve the verified caller's fields, optionality, auth failures and public
  auth-area boundaries. Regenerate contracts with this API running.

**Check:** real-auth fixture and allowed development mock identity responses,
unauthenticated rejection, generated type compatibility and the existing
real-stack sign-out/sign-in flow.

### 07. Migrate Problem Details contracts to Zod

**Outcome:** API errors use one structure definition for emitted bodies and
OpenAPI documentation.

- Replace Problem Details DTO and validation-error structure duplication with
  Zod schemas and inferred types; update filters and response decorators.
- Preserve status, problem type, request/correlation identifiers, timestamp
  and field-error representation. Keep unexpected diagnostics server-side.
- Ensure body errors remain 422 while path/query errors remain 400. Include
  nested-object/array pointers and property names containing `~` or `/`.
- Preserve the intended OpenAPI component identity and regenerate contracts.

**Check:** schema-valid 400/401/403/404/422/429/500 responses, actual retry
headers, safe 500 details and existing frontend error rendering. Confirm a
schema conversion error cannot leak a raw ORM error or credential.

### 08. Finish the single-schema convention

**Outcome:** fork authors use Zod for all application-owned structures and
validation, with no residual class-validator DTO path.

- Inventory the entire API, CLI and shared contracts. Migrate remaining
  pagination/search helpers and application-owned wrappers. Shared generic
  structures take schemas as parameters rather than untyped payloads.
- Retain library-owned Terminus health and MCP SDK protocol types. If the
  application defines its own health response projection, define that shape
  with Zod; do not hand-maintain an equivalent structure interface.
- Enforce runtime schema binding on incoming REST bodies/path/query values,
  accounting explicitly for raw MCP transport bodies added later. Add an
  enforceable route convention/check rather than trusting inferred types.
- Remove obsolete decorators, class-based validation setup and direct
  class-validator/class-transformer dependencies once all consumers are
  migrated. Inspect optional/required peers before removal; distinguish a
  library's transitive dependency from a second application authoring path.
- Update API standards, examples and README guidance in the same commit.
  Ensure the architecture lint rules recognize the selected schema/DTO roles.

**Check:** clean build, lint, API/CLI types, schema-binding coverage, dependency
alignment and REST regression suite. Regenerate contracts and force the web
type build; inspect for incidental component/operation renames.

### 09. Serve secured MCP discovery in the real API

**Outcome:** modern and initialization-based clients can discover an MCP server
over the existing API port, with real authentication and deployable defaults.

- Install compatible official v2 server/Node packages and client packages for
  tests. Implement `/mcp` through Nest routing, the SDK factory and its supported
  parsed-body Node adapter. Configure the four approved protocol revisions;
  keep message parsing and compatibility in the SDK.
- Start with discovery and no Item tools. Advertise only existing capabilities
  and use package version, configured identity/title and appropriate server
  instructions. Serve authenticated GET/DELETE as 405 with `Allow`; no session
  identifier or persistent GET stream. Test legacy initialization explicitly.
- Reuse the global auth strategies, accepted-scope policy and REST audience.
  Add route-specific challenges for missing/malformed credentials, rejected
  tokens and insufficient scopes while preserving Problem Details. Keep
  provider outages distinct. Do not wrap all 403s as missing scope.
- Serve exactly one public protected-resource document at the approved path.
  Use an explicit public resource URL and actual issuer/scopes; omit nonexistent
  authorization-server metadata in mock mode. Include this application-owned
  metadata in the Zod policy and route-auth public allowlist.
- Add one effective MCP origin/CORS policy for preflight and actual responses,
  readable challenges/tracing, permitted MCP headers and absent-Origin native
  clients. Include Host/DNS-rebinding protection appropriate to loopback and
  reverse-proxy operation. Preflight is unauthenticated.
- Add the separate authenticated-subject MCP limiter, default 120 requests per
  minute per instance, after authentication. Skip the REST limiter for MCP
  requests. Apply an explicit separate public metadata allowance by IP; reuse
  the existing REST allowance without charging an authenticated MCP subject.
- Enforce content-type/body-size policy and no-store/private discovery.
  Preserve identifiers for parser, origin, auth, protocol and throttle failures.
- Own the 15-second deadline and response lifecycle coherently with the SDK;
  close request-bound servers, propagate request/ORM context and abort signals,
  prevent double writes and clean up on disconnect/shutdown. A closed HTTP
  request does not imply a database mutation was cancelled.
- Validate configuration: enabled by default everywhere; public URL required
  while enabled; HTTPS in production; exact initial external `/mcp` path with
  no credentials/query/fragment. Disabled routes return 404 and never the SPA.
- Include all settings in env examples, tests, allocated-port setup, Turbo
  cache/env handling and every API-starting CI job. Update production image
  routing/boot checks and SPA exclusions with the route introduction, so the
  commit boots from a clean checkout with default-on MCP.

**Check:** real HTTP plus modern/legacy SDK discovery; every advertised
revision and full supported-version error list; auth error matrix, origin and
production CORS with Playwright, preflight, malformed/oversized requests,
unsupported content types, method handling, isolated budgets, disabled 404s,
SPA routing, no-session behavior, cleanup and production-image boot. A host
connection is not yet evidence of Item-tool functionality.

### 10. Deliver typed, discoverable Item read tools

**Outcome:** an authenticated MCP client can list paginated Items and retrieve
one Item from the same records REST serves.

- Add the provider decorator for injectable discovery, a small provider
  contract such as `getTools()`, and a thin typed definition factory. The
  decorator identifies providers, the interface describes provider operations,
  and the factory binds each schema to its handler arguments/results.
- Keep schema types intact through registration. Use no author-supplied casts
  and no unchecked schema-to-method conversion. Avoid an abstract tool class.
- Discover singleton-compatible feature providers, validate names/duplicates
  and advertised schema conversion at startup, preserve supported local
  references and reject unsupported schemas clearly. Do not add blanket
  reference inlining or a schema rewrite engine.
- Register `list_items` and `get_item` in `item.tools.ts` through Item's own
  provider/module wiring, with the approved schemas and annotations. The MCP
  infrastructure imports no feature implementation and has a public index.
- Add `.tools.ts` to standards and ESLint's closed role vocabulary. Document
  the extension contract with the working read example.
- Bind verified caller explicitly per invocation and return application
  values. Infrastructure handles schema-valid structured output, equivalent
  JSON text, safe expected/unexpected errors and tool/outcome/duration logs.
  No raw arguments/tokens in default logs or tool-list-change notifications.

**Check:** actual modern and legacy clients read PostgreSQL-backed records;
REST/MCP page parity, invalid UUID/page/unknown fields, not-found handling and
schema-valid output/text equivalence. Add compile-failure cases for argument
and result mismatches, duplicate catalog/startup failures, concurrent caller
context isolation, and output-failure privacy.

### 11. Deliver Item creation through MCP

**Outcome:** a client creates an Item through MCP and sees it through REST/the
SPA without a second business implementation.

- Register `create_item` over the existing Item service and shared schemas,
  with the approved annotations and central result/error handling.
- Preserve name spelling/spacing and aligned description nullability. Reject
  invalid inputs before persistence and validate the successful output.
- Include any necessary authoring guidance about caller-based authorization
  belonging in shared application behavior, rather than HTTP-only decorators.

**Check:** create through MCP/read through REST, create through REST/read
through MCP; omitted/string/null description, invalid names and unknown fields
leave no row. Exercise real SDKs and the running SPA's paginated list. Test
delayed creation/deadline behavior without claiming a timeout rolled back a
write or makes automatic retries safe.

### 12. Deliver Item updates through MCP

**Outcome:** clients can edit names/descriptions and explicitly clear a
description with the same behavior as REST.

- Register `update_item` using the shared UUID/update/result contracts and
  existing service. Apply the approved destructive/idempotent annotations.
- Keep an omitted description unchanged and clear it on explicit null.
  Reject null/blank/empty/oversized names and unknown keys.

**Check:** both-interface update/read parity, omission and null clearing,
repeat updates, not-found, and failed updates leaving the record intact.
Include structured/text equivalence and a focused real-stack edit flow.

### 13. Deliver Item deletion through MCP

**Outcome:** all five tools are available and the complete cross-interface
Item lifecycle is exercised.

- Register `delete_item` over the existing service and return the UUID plus
  `deleted: true`, using the approved annotations. Preserve safe not-found
  behavior on repeated deletion and REST's existing 204 response contract.
- Complete the fixed five-tool catalog, instructions and discovery assertions.

**Check:** create/list/get/update/clear/delete/read-after-delete with modern
and real legacy clients, including all supported revisions. Assert REST/MCP
parity and schema-valid success/text results for every operation; verify
deletion is reflected in the real SPA without stale page state.

### 14. Automate OAuth with a local test provider

**Outcome:** repeatable tests prove the sign-in flow, rather than merely
supplying a token or bypassing verification.

- Extend/reuse existing signing fixtures where useful, but add a test-only
  local HTTP authorization provider: metadata, JWKS, authorization endpoint,
  token endpoint, appropriate client registration and loopback redirects.
  Serve an explicit fixture sign-in/consent page and enforce PKCE S256,
  redirect binding, code expiry/single use and issuer/resource/scope policy.
- Run the actual API with `FAKE_AUTH=false` and normal issuer, audience and
  signature verification. The existing in-process mock OIDC service is not
  sufficient to prove discovery, browser redirect or code exchange.
- Drive an official MCP SDK client from an initial 401 through metadata,
  browser authorization via Playwright, callback/state/issuer validation,
  token exchange and authenticated tool invocation. Keep this fixture outside
  production app modules/images; it is not an application OAuth server.
- Allocate provider/callback ports rather than hard-coding shared defaults.
  Supply one documented command/harness that can also serve Claude Code
  locally. Inspect the installed Claude Code OAuth requirements when running
  that check; use supported pre-registration or dynamic registration as needed.
- Cover wrong audience/issuer, expired/tampered tokens, insufficient scope
  and provider/JWKS outage. Keep mock-identity tests separate from these
  real-verification tests. Test any added scope-claim normalization through
  the common REST verifier so transports cannot disagree.

**Check:** the SDK flow runs unattended in CI with real HTTP and PostgreSQL.
Assert the resource indicator maps to the configured REST audience in the
fixture and that credentials never enter logs. This verifies the fixture's
OAuth behavior, not a particular production identity provider's configuration.

### 15. Ship operator checks and verify Claude Code locally

**Outcome:** a fork author can reproduce discovery, sign-in and tool usage
without reading implementation code.

- Add a small SDK smoke command covering discovery, page navigation and an
  isolated CRUD lifecycle. Read the endpoint/ports from this checkout's
  configuration, support a token supplied through an appropriate local
  mechanism and avoid printing credentials. Remove only records created by
  the smoke run and report cleanup failures.
- Include that smoke path in CI/production-image verification where applicable;
  retain focused tests from earlier slices rather than copying their assertions
  into a second custom test framework.
- Document Inspector and Claude Code HTTP setup, local fixture sign-in,
  provider registration/redirects/resource mapping, shared audience/scopes,
  proxy routes, production public URL/origin requirements, limits, timeout
  ambiguity, disabling/removing MCP and adding a new feature provider.
- Test Claude Code locally with the fixture, default browser sign-in and all
  five tools, subject to the installed CLI/account being available. Use
  isolated local MCP configuration, preserve existing user registrations,
  and clean up temporary config and test data. Do not require Claude Code or
  an LLM account for CI.
- Record actual client/CLI versions and evidence separately from intended
  compatibility. If interactive sign-in requires user participation or the
  CLI is unavailable, report that specific verification gap; do not replace
  it with an unsupported claim based on SDK success.

**Check:** smoke a running development API and production image; follow the
Claude Code runbook with the fixture when available. Review root/API README,
standards, env examples and ADR links against actual commands and behavior.

## Verification and evidence throughout the sequence

Each slice owns the tests for its behavior. Run affected formatting, lint,
types, tests and architecture/dependency checks before committing. Regenerate
contracts for API behavior/schema changes from this checkout's running API:

```sh
pnpm generate:api-types
pnpm --filter web exec tsc -b --force
```

Review the generated diff, including a zero diff when appropriate. Never edit
the generated file or lockfile manually. Read applicable API, web, test,
dependency and ADR instructions before implementation.

Follow [finish-work](../../../.claude/skills/finish-work/SKILL.md) and
[verify-app](../../../.claude/skills/verify-app/SKILL.md) for runtime changes.
Read [PORTS.md](../../../PORTS.md), run `scripts/verify-app.sh` against the
allocated checkout ports and require `verify-app: OK`; execute relevant native
real-stack Playwright flows. Restart affected processes when necessary so
verification cannot silently exercise stale code. Stop the verification stack
with `scripts/verify-app.sh stop`, including on failures. Inspect migrations
for incidental rewrites; MCP itself does not require a new Item table.

After the final slice, map every requirements acceptance row to retained tests
and observed results: discovery, authentication, sign-in, all tool lifecycles,
validation, privacy, REST parity, protocol revisions, tracing, browser access,
rate isolation, routing and production integration. Run the relevant full
regression suites and clean production build/image checks once. Review the
combined diff, dependency peers, generated contracts and public-repository
privacy. Fix failures in the owning conceptual slice; no empty final
"verification passed" commit is needed. Store actual results in the established
feature verification record/session or issue evidence, without turning this
plan into a second live-status tracker.

## Local authentication verification targets

An **identity provider** issues access tokens; an **MCP host** is the application
that connects to the MCP server and presents its tools to a user. The template
remains a resource server and does not implement production login itself.

Use both the official MCP client SDK and Claude Code locally. The SDK supplies
deterministic CI assertions; Claude Code checks real host setup, browser login
and tool presentation. They can share the same test-only provider and real API
JWT verification. A development mock identity is useful for CRUD tests, but
cannot establish OAuth sign-in compatibility.

The official SDK documents its OAuth redirect/callback flow, and Claude Code
documents HTTP MCP connections and OAuth authentication. These are supported
test approaches, not evidence that this template already passes them:
[SDK OAuth guide](https://ts.sdk.modelcontextprotocol.io/v2/clients/oauth),
[Claude Code MCP guide](https://code.claude.com/docs/en/mcp).

No production-provider selection blocks this plan. Compatibility with a
particular deployed provider remains conditional on that provider's client
registration, redirect policy and mapping from the MCP resource URL to the
existing REST token audience.
