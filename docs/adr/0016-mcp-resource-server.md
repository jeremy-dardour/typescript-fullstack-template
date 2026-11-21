# ADR 0016: MCP is an adapter in the API resource server

**Status:** Accepted — 2026-11

## Context

Fork authors need remote MCP access to existing application behavior without
operating a second service or duplicating identity and business rules.

## Decision

Serve stateless Streamable HTTP at `/mcp` in the existing Nest API process and
port. REST controllers and feature-owned MCP tools call the same services and
repositories. Shared MCP infrastructure discovers decorated injectable feature
providers through a small interface; typed tool declarations bind schemas and
handlers. Infrastructure has no dependency on feature implementations.

Reuse REST's identity provider, token audience and accepted-scope policy. The
application remains an OAuth resource server; it publishes protected-resource
metadata and does not operate a production authorization server. Authorization
that protects application behavior must cover calls through both adapters.

MCP is enabled by default in all environments. Operators may disable it and
forks may remove it. Keep a separate per-subject, per-instance request budget.
Do not create application-managed MCP sessions or require sticky routing.

## Rationale

One application process preserves the template's deployment model and avoids a
second network path to persistence. Explicit callers and schema-bound handlers
keep identity and type relationships visible when tools are discovered.

## Consequences

Enabled deployments configure the public MCP URL and proxy paths. The provider
must map the MCP resource indicator to the existing REST audience. Per-process
rate limits multiply with replicas. The official SDK owns protocol behavior;
the application owns authentication, browser policy, tracing and safe errors.

Local OAuth fixtures and SDK clients verify the template's sign-in flow.
Production-provider and user-facing host compatibility require separate
observations, not assumptions based on protocol support.
