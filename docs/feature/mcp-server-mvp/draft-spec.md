# MCP support draft requirements

**Status: Approved requirements for a new implementation.** This document
describes intended behavior, not existing implementation or verified results.
Architecture is in [the technical design](draft-tech-design.md); approved
choices are in [the decision map](decision-map.md), and commit slices are in
[the implementation plan](implementation-plan.md).

## Purpose and scope

A project created from this template should be usable by remote MCP clients
without needing a separate product integration. The Item example should show
fork authors how to expose a feature while reusing its existing application
behavior, identity, validation and persistence.

The first version covers tool discovery and the five Item operations. It
should work with both the modern request-based protocol and the earlier
initialization-based clients. Changes through REST and MCP must affect the
same records and obey the same business rules.

Client connection instructions, identity-provider configuration, feature
authoring guidance and repeatable verification are part of the feature.

Excluded from this version:

- A separate OAuth authorization server operated by the application.
- A local stdio transport or the older HTTP/SSE transport.
- MCP resources, prompts and an identity-inspection tool.
- A new read/write permission system specific to tools.
- SPA changes beyond adapting Item listing to pagination.
- Client-directed sampling, elicitation, roots or protocol notifications.
  Normal server-side logs remain required.

## Choices carried forward

| Topic              | Prior choice to preserve unless explicitly revised                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Deployment         | Add MCP to the existing API process and port.                                                                              |
| Protocol revisions | Target `2026-07-28`, plus `2025-11-25`, `2025-06-18` and `2025-03-26`. Check current official support before implementing. |
| Endpoint           | Use `/mcp`, outside the REST `/api` prefix.                                                                                |
| Transport          | Streamable HTTP without application-managed sessions.                                                                      |
| Identity           | Reuse the REST identity provider, token audience and accepted scopes.                                                      |
| Availability       | Enable MCP by default in every environment, including production; projects may disable or remove it.                       |
| Request budget     | Give MCP a separate configurable allowance of 120 requests per user per minute.                                            |
| Item listing       | Paginate REST and MCP together, newest first: page 1 and 20 Items per page by default, maximum 100 Items per page.         |
| Metadata           | Publish one protected-resource document at `/.well-known/oauth-protected-resource/mcp`.                                    |
| Name validation    | Reject whitespace-only Item names through both interfaces, without trimming stored values.                                 |

## HTTP and protocol behavior

| Request                                                | Expected behavior                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Authenticated `POST /mcp`                              | Dispatch an MCP message through the official protocol implementation.               |
| Authenticated `GET /mcp` or `DELETE /mcp`              | Return 405 because this version has no persistent stream or session to manage.      |
| Public `GET /.well-known/oauth-protected-resource/mcp` | Return information identifying the protected resource and its authorization server. |
| Any of those routes while MCP is disabled              | Return 404, without falling through to the SPA.                                     |

Requests use JSON. An unsupported request content type receives 415. A revision
the server does not implement produces the protocol-defined error and a list of
all supported revisions. Malformed protocol messages and unknown tools produce
protocol errors rather than fabricated tool results.

The server must not issue an MCP session identifier or depend on sticky routing.
Legacy clients can still perform their required initialization exchange.

Reject an explicitly disallowed browser origin before running tools. Requests
without an Origin header remain usable by non-browser clients. CORS and origin
validation must agree about which browser callers are permitted. Browser clients
need authorization, JSON, accept and MCP transport headers, including
`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` and `Last-Event-ID`; they must be
able to read `WWW-Authenticate`.

Every MCP HTTP response, including rejections, must expose `X-Request-Id` and
`X-Correlation-Id`. Preserve a supplied request identifier according to the
repository's tracing conventions. Discovery and tool-list caching must remain
private to the caller and disabled by default.

## Authentication and discovery

Use the existing authentication modes: real bearer-token verification in
production and the existing development identity where mock auth is allowed.
Tool handlers receive the verified caller. The application must not relay the
incoming token to another service.

An unauthenticated client learns the metadata URL from a bearer challenge,
fetches that document, then uses the configured provider to obtain a token.
The provider handles authorization and PKCE; the application is the resource
server. Document client registration, redirect URIs and resource/audience mapping.

The metadata describes the public MCP resource URL, provider issuer, supported
scopes, bearer-header authentication and a human-readable resource name. Public
addresses must remain correct behind a reverse proxy. When mock auth has no
issuer, do not advertise a nonexistent authorization server.

| Failure                                                        | HTTP result and challenge information                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Missing or malformed authentication                            | 401 with the protected-resource metadata location.                    |
| Expired token, invalid signature or unexpected issuer/audience | 401 with `invalid_token` and the metadata location.                   |
| Valid identity without an accepted scope                       | 403 with `insufficient_scope`, required scopes and metadata location. |
| Provider infrastructure unavailable                            | 503, without treating it as an invalid credential.                    |

Authentication error bodies follow the existing RFC 9457 Problem Details
contract. Classify missing/malformed credentials separately from rejected
tokens; header presence alone does not establish that a token was supplied.

Clients using the March 2025 protocol may need a token configured manually:
their protocol generation predates the intended metadata-based discovery flow.
Transport compatibility and automatic sign-in compatibility must be documented
separately.

MCP's request budget is keyed by the authenticated subject and does not consume
the REST budget. Authentication failures do not count toward that budget. A
limit violation returns 429, a usable `Retry-After` and Problem Details reporting
the actual limit. The initial storage choice is per process; multiple replicas
do not share one global allowance.

## Item tool contract

The server's initial machine name is `template-api`, its display title is
`Template API`, and its version follows the API package. Forks can rename it.
Instructions should briefly explain the available data, UUID identifiers and
how listing can help find an unknown identifier. Advertise only implemented
capabilities, without tool-list change notifications for a fixed tool set.

An Item result contains its UUID, name, nullable description and creation/update
timestamps serialized as ISO 8601 strings. The description key is always present
in this proposed result contract, even when its value is null. REST and MCP
representations should agree; review the generated REST types for this change.

| Tool          | Arguments                                                            | Successful structured value                                                |
| ------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `list_items`  | Optional positive integer `page` and integer `page_size` from 1–100. | Page envelope with `data`, `page`, `page_size`, `total` and `total_pages`. |
| `get_item`    | Item UUID.                                                           | The matching Item.                                                         |
| `create_item` | Required name and optional description.                              | The newly created Item.                                                    |
| `update_item` | Item UUID plus optional name and description changes.                | The updated Item.                                                          |
| `delete_item` | Item UUID.                                                           | The UUID and `deleted: true`.                                              |

Names have 1–255 characters and at least one non-whitespace character. Preserve
the supplied spelling and spacing. Update names may be absent but cannot be
null. An omitted update description preserves its value; an explicit null
clears it. Identifiers must be valid UUIDs. Unknown input fields are rejected.
Creation descriptions may be omitted, strings or explicit null; omission and
null both produce a null response description. Types, validation and generated
documentation must describe that same behavior.

REST and MCP list results use the same page envelope. Defaults are page 1 and
20 Items per page. Order by creation time descending, then UUID descending to
break ties. Offset pages may shift during concurrent writes; snapshot
consistency is not promised. The SPA includes Previous/Next navigation and
page information, including empty and last-row-deletion handling.

Each tool needs a concise description of its purpose and result. Intended
annotation values are:

| Tools             | Read only | Destructive | Idempotent | Open world |
| ----------------- | --------- | ----------- | ---------- | ---------- |
| List and get      | true      | Omit        | Omit       | false      |
| Create            | false     | false       | false      | false      |
| Update and delete | false     | true        | true       | false      |

These annotations describe behavior to clients; they do not grant permission.

Successful responses include both schema-valid structured output and a text
representation of the same JSON for older clients. Invalid arguments yield an
error tool result describing the relevant fields and constraints. A missing
Item yields a safe, identifiable not-found message. Unexpected failures expose
only a generic message and request identifier; detailed diagnostics stay in
server logs.

For REST, invalid bodies retain 422 and malformed path/query values retain 400.
Rejecting blank names is an intentional REST behavior change. Changes to
validation wording or response nullability must be documented and checked
against generated frontend contracts.

## Acceptance coverage

Use the current protocol for the complete suite. Also exercise discovery and
the Item lifecycle with a legacy client; verify the other advertised legacy
revisions rather than inferring their support from one successful client.

| Area           | Evidence needed                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery      | Public metadata is accurate; supported clients see the expected identity, capabilities and five tool definitions with schemas and annotations.                                                    |
| Authentication | Missing, expired, tampered, wrong-issuer and wrong-audience tokens are rejected correctly; insufficient scope and provider outage are distinct. Only the reviewed metadata route is newly public. |
| Sign-in        | A standard client understands the challenge. Separately test discovery, authorization with PKCE, token issuance and authenticated retry; a 401 alone does not verify sign-in.                     |
| Item lifecycle | Create, read, list, update, clear description, delete and read-after-delete. Validate every successful structured result and its equivalent JSON text.                                            |
| Validation     | Reject empty, oversized and blank names, invalid UUIDs, null update names and unknown fields. Failed changes leave the record intact.                                                             |
| Error privacy  | Not-found and unexpected failures do not expose ORM queries, SQL, stack traces or credentials.                                                                                                    |
| REST parity    | Create through either interface and read through the other; deletions and invalid inputs produce equivalent application outcomes.                                                                 |
| Transport      | Verify unsupported revisions, malformed JSON-RPC, JSON content type, allowed/disallowed origins, authenticated 405s and disabled-route 404s.                                                      |
| Tracing        | Check generated and incoming IDs on success, authentication failure, origin rejection, throttling and malformed requests.                                                                         |
| Browser access | Exercise production CORS preflight and readable responses with the documented origin settings.                                                                                                    |
| Rate limiting  | Exhaust one user's MCP budget; another user and the REST allowance remain unaffected. Assert real retry and limit values.                                                                         |
| Routing        | MCP and metadata paths never return the SPA shell, whether enabled or disabled; existing routes retain their behavior.                                                                            |
| Integration    | Verify a real API process, the production image and the repository's CI paths, with configured workspace ports.                                                                                   |

Provide a repeatable client smoke check and instructions for Inspector and a
local Claude Code connection. Automate the complete OAuth flow using the
official MCP client SDK and a test-only local HTTP provider, with real API
token verification rather than development mock identity. Exercise Claude Code
against that provider when available. Document actual verified clients and
providers separately from intended compatibility; no production-provider
selection is required to implement the feature.

## Documentation to deliver with implementation

Explain local and hosted connections, provider/client registration, adding a
feature's tools, input/output conventions, safe errors, rate limits, disabling
MCP and deploying behind a proxy. Update the root/API READMEs and applicable
standards. Record architectural decisions in new ADRs only after review, and
provide verification commands with their actual results and remaining gaps.
