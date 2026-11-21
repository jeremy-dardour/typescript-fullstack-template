# MCP approved decision map

These choices define the implementation target. Requirements live in
[the specification](draft-spec.md), architecture in
[the technical design](draft-tech-design.md), and proposed commit slices in
[the implementation plan](implementation-plan.md). None of these documents
asserts completed implementation or verified runtime results.

| Decision          | Selected behavior                                                                                                                              | Consequence                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1 — availability | MCP defaults on in every environment, including production. Projects that do not need it may disable or remove it.                             | Enabled deployments configure a valid public MCP URL; setup examples and CI must boot with this default.                                                                                         |
| D2 — listing      | Paginate REST and MCP together: page 1 by default, 20 Items per page by default, maximum 100 Items per page.                                   | Update the REST contract, generated consumers and the SPA's page navigation in one vertical slice.                                                                                               |
| D3 — declarations | Discover decorated injectable feature providers implementing a small provider interface. Each tool uses a thin typed declaration factory.      | Discovery identifies providers at runtime, the interface describes provider operations, and the factory checks each schema/handler relationship with inferred types. No abstract tool hierarchy. |
| D4 — schemas      | Preserve supported schema references and shared definitions; use the SDK's conversion.                                                         | Validate schemas at startup. Add normalization only for demonstrated client incompatibility; do not build blanket reference inlining.                                                            |
| D5 — validation   | Migrate all application-owned structures and validation to Zod.                                                                                | One contributor convention for types, runtime validation and documentation. Native Nest schema bindings remain mandatory; framework/SDK-owned payloads stay with their libraries.                |
| D6 — descriptions | Types, runtime behavior and documentation must agree. Accept omitted/string/null descriptions on create to preserve existing runtime behavior. | Responses always contain a nullable description; updates preserve omission and clear on explicit null.                                                                                           |
| D7 — audience     | Keep the existing REST token audience and accepted-scope policy.                                                                               | The configured provider must map the MCP resource indicator appropriately; transports share verification and identity.                                                                           |

Keep the existing API process/port, `/mcp` outside `/api`, stateless
Streamable HTTP, the four specified protocol revisions subject to actual SDK
support, five Item tools over existing services/repositories, one public
protected-resource metadata document and a separate per-subject MCP allowance
of 120 requests per minute per instance. Do not add a production authorization
server, session store, tool-specific permission system or generic persistence
layer.

For local sign-in verification, use an official MCP SDK client with a
test-only HTTP OAuth provider, then exercise Claude Code against that same
provider when the installed CLI/account is available. These complement each
other: SDK tests run deterministically in CI, while Claude Code checks an
actual user-facing host. The API uses real token verification for both.
The existing development mock identity does not verify OAuth sign-in.

No additional product or architecture decision blocks the plan. Production
provider compatibility and actual client test results must be reported from
evidence rather than inferred from the local fixture.
