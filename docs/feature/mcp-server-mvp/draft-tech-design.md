# MCP support technical design

**Status: Approved design for a new implementation.** Paired with
[the requirements](draft-spec.md), this document describes intended behavior,
not existing implementation or verified results. The
[decision map](decision-map.md) records approved choices, and the
[implementation plan](implementation-plan.md) defines the commit slices.

## Architecture to carry forward

Keep MCP in the Nest API. REST controllers and MCP tools should be separate
adapters over the same feature services and repositories. This avoids another
deployment and a second network path for the worked example. A separate MCP
process is possible with a different security/deployment design, but is not
needed for this template's initial scope.

Shared transport, discovery, authentication integration and error translation
belong in an `app/mcp` infrastructure area. A feature owns its tool declarations
beside its controller and service. Infrastructure must not import Item or other
feature implementations. Consumers use the area's public index, consistent
with the repository's existing dependency rules.

Conceptual call path:

```text
HTTP request
  -> request context and response identifiers
  -> origin policy and existing authentication
  -> MCP-specific request budget
  -> Nest transport adapter
  -> official MCP SDK
  -> feature tool handler
  -> existing feature service and repository
```

The SDK should own protocol parsing, revision compatibility, message validation
and transport serialization. Use its supported Node integration rather than
implementing these behaviors in the template. The earlier plan selected the
official v2 SDK and its stateless legacy compatibility mode. Verify the current
package APIs and supported revisions against official documentation before
choosing versions; previously used version numbers are not constraints.

A fresh request-bound server was the proposed way to bind authenticated identity
to tool calls without storing sessions. A single discovered tool catalog can be
shared, but mutable per-caller state must not be shared. Confirm disposal,
shutdown, concurrency and request-context propagation with the selected SDK.

## Feature extension interface

Discover decorated injectable feature providers at Nest startup. A small
provider interface describes the operations infrastructure calls, such as
`getTools()`. Each tool is declared through a thin typed factory binding its
schemas, metadata and handler. Adding a feature registers its provider without
editing a central catalog. Duplicate or invalid names prevent startup. Feature
instructions may contribute to overall server instructions. Providers use
singleton-compatible dependencies; identity is explicit per invocation.

Tool definitions need a name, title, description, argument schema, result schema,
annotations and a handler. A tool handler should return its application value;
shared infrastructure should assemble the MCP envelope and apply error policy.

The provider decorator supports runtime discovery; the interface checks the
provider contract; the factory infers individual handler argument/result types
from their schemas. Preserve those relationships through SDK registration.
Runtime discovery must not hide an unchecked schema-to-method cast, and feature
authors must not supply casts to connect their schemas and handlers. No abstract
tool base class is needed.

The `.tools.ts` suffix represents a feature's MCP adapter. Extend both the
documented file-role list and lint enforcement. Do not add generic repositories
or service abstractions solely to support a second transport.

Caller-based authorization belongs in shared application behavior. A controller
permission decorator alone will not protect tools that invoke the same service.
The current example does not justify building a new per-tool permission system,
but its authoring guidance must make this distinction clear.

## Shared schemas and REST contracts

Use a complete move from decorated class DTOs to Zod schemas,
including response documentation shapes, rather than maintaining two validators
for REST and MCP. The motivation is one definition serving runtime validation,
OpenAPI and tool schemas, with TypeScript types inferred from that definition.

Use Nest's native Standard Schema integration and its public customization
hooks, verifying required behavior with the installed versions. Preserve
OpenAPI component names so generated consumers
do not acquire incidental renames. Keep entity-to-response mapping explicit,
including timestamp serialization and nullable descriptions.

Migrate all application-owned structures and validation to Zod, including Item
create/update/read contracts, pagination/search shapes, Problem Details,
current-user and MCP metadata responses. Types are inferred from schemas;
application-owned health projections follow the same rule. Framework-owned
Terminus payloads and SDK-owned protocol messages remain their libraries'
responsibility. Replace optional-but-not-null behavior with its schema
equivalent. Remove old validation packages and helpers after accounting for
all consumers and peer requirements; the final application has one authoring
convention.

Use rejecting object schemas for request contracts: default unknown-key removal
would silently change the REST contract. Share UUID rules between URL parameters
and tool arguments. Preserve 422 for body validation and 400 for invalid
path/query parameters. Keep structured field errors with field name, JSON
Pointer, stable error code and human-readable message; map paths correctly for
nested objects and arrays.

The prior plan allowed validation text to change while preserving error-body
structure. Reject whitespace-only names in both channels, keep meaningful
spacing, and retain omission/null distinctions for updates. Compare old/new
behavior rather than assuming two schema libraries have identical semantics.

Schema integration requirements:

- Prefer a supported validation customization hook over depending on protected
  framework methods.
- Catch omitted REST schema annotations through an enforceable convention or
  route coverage. Inferred types alone do not validate incoming JSON.
- Include application-owned metadata responses in the schema policy.
- Validate compatibility with the selected SDK before startup completes.
  Preserve JSON Schema references when supported; introduce normalization only
  for demonstrated client requirements. Any reference handling must respect
  JSON Pointer escaping and state how recursive schemas are handled.

Do not inline references preemptively. Keep runtime schemas and advertised
schemas aligned through SDK-supported conversion. Sharing semantic constraints
does not require identical transport parsing: REST query strings need explicit
conversion, while MCP arguments use JSON types.

Paginate Item listing through both adapters with a shared page result using
`data`, `page`, `page_size`, `total` and `total_pages`. Inputs default to page 1
and 20 Items per page and permit at most 100 Items per page. Apply a stable
`createdAt DESC, id DESC` order. Include generated contracts, SPA query keys,
page controls and mutation/page-state behavior in the pagination change.

Regenerate frontend contracts from this checkout's running API and review the
result. A required nullable description is a deliberate contract change, not
an incidental detail of adding MCP.

## Authentication and public metadata

Retain the global authentication guard and existing strategies. Adapt the
verified caller into SDK request context without logging or unnecessarily
copying the token. Use that context for each handler invocation. If discovery
needs the provider issuer, expose it through the auth area's public interface.

The application remains an OAuth resource server. Its protected-resource
metadata points to the actual authorization server and identifies the public
MCP URL. Configure that public URL explicitly instead of trusting arbitrary
Host or forwarded headers.

The earlier design added MCP bearer challenges through a route-specific error
adapter while preserving the normal Problem Details bodies and REST behavior.
Distinguish invalid credentials, absent credentials, insufficient scope and
provider outages. Only an authorization failure should advertise missing
scope; an unrelated 403 must not accidentally trigger a scope-upgrade loop.

Reusing REST's audience is the prior choice, conditional on both transports
belonging to the same intended protected resource. Verify the provider's mapping
of MCP resource indicators to token audiences, along with PKCE, client
registration and redirect URIs. A metadata endpoint and a token-verification
test do not establish that automatic sign-in works with a hosted client.

## HTTP integration and operational behavior

Mount `/mcp` and its public metadata outside the REST prefix, exclude them from
SPA fallback and omit protocol routes from REST OpenAPI discovery. Disabled
routes should genuinely be absent. Conditional module loading must agree with
validated configuration rather than rely on undocumented environment-loading
order.

Use the same intended HTTP setup in the real application and integration tests.
Cover prefix exclusions, global filter precedence and early failures. In
particular, tracing headers must be written before guards or middleware can
reject a request. An interceptor alone cannot cover those responses.

Coordinate CORS and the MCP origin check through one effective policy for the
MCP routes. The previously separate global and MCP origin lists were a source
of confusing production behavior. Test browser preflight and response access
under production settings, including discovery and challenges.

The SDK should receive an Express-parsed JSON body through its supported
integration. Check malformed input and unsupported content types against the
actual parser/SDK combination. Preserve HTTP method and status behavior even
when the SDK writes responses directly.

The previous plan kept the existing 15-second request timeout. Reassess how
timeout, disconnect and cancellation interact with SDK-owned responses and
mutations; ending the HTTP wait must not be mistaken for cancelling a write.
Publish only capabilities actually used. For fixed tool definitions, suppress
tool-list-change notifications. Keep discovery caching private and off unless
deliberately configured otherwise.

Use a dedicated MCP throttler after authentication, keyed by the caller's subject.
REST and MCP must not charge the same request twice. Per-process storage is an
acceptable starting point if documented; shared storage can be added when an
operator needs one limit across replicas. Metadata-route limiting should be
explicit and must not require authentication merely to read discovery data.

The earlier planning also approved fixing inaccurate REST rate-limit messages.
Report the allowance, window and retry time of the limiter that actually fired.
Check the current repository for the suspected request-context and filter-order
bugs, reproduce them, then fix them with targeted evidence; previous reports
are not proof of current behavior.

## Result translation and logging

Keep successful structured values JSON-compatible and produce equivalent JSON
text for clients needing it. Validate output against the advertised schema.
Translate expected not-found and application failures into useful tool errors.
Unexpected failures, including server-side HTTP exceptions, need a generic
client message with a request identifier and detailed server diagnostics.

Log the tool name, outcome and elapsed time. Do not log raw arguments or bearer
tokens by default. Protocol errors remain the SDK's responsibility. Tool input
validation should produce actionable field-level feedback without allowing raw
database errors to escape. Verify that any SDK-provided validation messages meet
the contract rather than adding another formatter without need.

## Proposed settings

| Setting                     | Prior intended meaning                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| `MCP_ENABLED`               | Operator switch; defaults to true in every environment, including production. |
| `MCP_PUBLIC_URL`            | External URL of the MCP endpoint; required while enabled.                     |
| `MCP_ALLOWED_ORIGINS`       | Additional permitted browser origins alongside the public URL's own origin.   |
| `MCP_RATE_LIMIT_PER_MINUTE` | Positive request allowance, initially 120 for each user on each instance.     |

Document valid public URL/path combinations and proxy routing so the advertised
metadata location is actually served. Production URL and origin requirements
need explicit validation. Workspace setup must derive the development public
URL from the allocated API port.

Update env examples and test fixtures, CI startup and contract-generation jobs,
the production-image boot check, workspace setup and cache/environment handling
where applicable. These are implementation work in the real repository, not
snippets to leave for the operator to apply later.

Preserve the template's current dependency baseline. Earlier sandbox-driven
downgrades of ORM, Nest helpers, logging, linting and formatting packages are
not requirements for this work. Select compatible supported MCP packages, read
peer warnings, regenerate the lockfile with the package manager and run the
repository's dependency checks.

## Approved decisions

The [decision map](decision-map.md) records the settled architecture. No product
or architecture decision blocks the implementation plan. Keep MCP enabled by
default, pagination in both adapters, the provider decorator/interface/factory
extension point, supported schema references, Zod throughout application-owned
contracts, aligned nullable create descriptions and the existing REST audience.

## Implementation and verification approach

Keep infrastructure corrections, schema migration and MCP transport as distinct
reviewable portions. The exact file inventory and class decomposition remain
implementation choices; this draft does not require reproducing a prior layout.

Use focused unit tests for schemas, typed declarations, error translation,
challenge generation, tool catalog registration and configuration. Exercise real
HTTP plus PostgreSQL for lifecycle, authorization, transport and REST parity.
Use separate callers and a low test limit to verify throttling without making
unrelated cases depend on execution order.

Run representative modern and legacy clients, including an actual legacy SDK
where supported. Cover every advertised revision and the complete supported
revision list on errors. Browser checks need production-mode CORS, and auth
verification uses an official SDK client with a test-only local HTTP OAuth
provider. Run the real API verifier with mock auth disabled and exercise
metadata discovery, PKCE authorization, callback, token issuance and retry.
The existing signing/issuer mock alone is insufficient. Test Claude Code
locally against the same provider when its CLI/account is available. No
production identity provider must be selected to implement the feature;
provider-specific production compatibility requires separate evidence.

Follow repository completion and app-verification instructions: relevant static
checks, dependency alignment, regenerated contracts, running API, real-stack
Playwright coverage and production-image/CI verification. Keep a small client
smoke command for operators. Report unavailable checks honestly; discard all
historical pass counts and mutation-test claims.

Document client setup and provider requirements in the API README, feature
authoring rules in API standards, and an overview in the root README. Write ADRs
for approved placement/access-control decisions and the validation-stack change;
only supersede the existing validation ADR after that change is accepted. Keep
verification instructions with the feature and avoid duplicating durable rules
across design documents and ADRs.
