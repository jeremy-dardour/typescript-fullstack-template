# ADR 0017: Zod defines application-owned contracts

**Status:** Accepted — 2026-11

**Supersedes:** [ADR 0002](0002-dual-validation-stack.md)'s split between Zod
configuration validation and class-validator HTTP DTOs.

## Context

REST and MCP expose the same application behavior. Separate schema libraries
would require contributors to repeat constraints, nullability and structure.
The installed Nest and Swagger versions support Standard Schema integration,
making a common schema definition available without a third-party Nest wrapper.

## Decision

Use Zod for application-owned structures and boundary validation, infer their
TypeScript types, and derive OpenAPI and MCP schemas from those definitions.
Use native Nest schema bindings and public customization hooks. Framework-owned
health payloads and SDK-owned protocol messages remain owned by those libraries.

REST parameters must bind runtime schemas explicitly. Preserve body validation
status 422, path/query status 400, rejecting unknown input fields and structured
field errors. Share semantic constraints while retaining transport-specific
parsing where REST query strings and MCP JSON inputs differ.

Keep entity-to-response mapping explicit and JSON-compatible. Preserve supported
schema references; introduce normalization only for demonstrated client needs.
Generated frontend contracts remain derived from the running API's OpenAPI.

## Rationale

One authoring convention reduces disagreement between types, validation and
documentation. Schema inference does not itself validate incoming JSON, so
runtime binding coverage is part of the convention.

## Consequences

Migrate application-owned DTOs, pagination/search, current-user, errors and
metadata. Remove obsolete application validation helpers and dependencies after
accounting for consumers and peers. Migration slices must compare behavior and
generated contracts; schema-library replacement alone is not proof of parity.
Business authorization and database integrity remain application/persistence
responsibilities, not JSON-schema constraints.
