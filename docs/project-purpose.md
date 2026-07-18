# Project Purpose

> **⚠ Replace this when you fork the template.** The content below describes the
> _template itself_. Once you start a real project, overwrite it with that
> project's purpose (why it exists, who it's for, scope). Keep this doc short and
> stable — it explains _why_, not _how_. See
> [ADR 0005](./adr/0005-documentation-context-structure.md) for the docs model.

**Why this exists.** To be a professional-grade starting point for TypeScript
fullstack products — a production-ready monorepo you can fork and build a real
project on without re-deciding the plumbing (API, SPA, auth, contracts, CI,
tooling) every time.

## What it is

A Turborepo/pnpm monorepo pairing a NestJS 11 + MikroORM + PostgreSQL API with a
React 19 + Vite + TanStack Query SPA, wired together by OpenAPI contract
generation so frontend types are derived from the backend, never hand-copied. It
ships a working Item CRUD example, pluggable OIDC/JWT auth, a CLI shell, shared
ESLint/TypeScript config, and a comprehensive GitHub Actions CI pipeline.

## Who it's for

Engineers (and their AI assistants) starting a new fullstack product who want
production defaults — type safety end to end, tests, CI, and documented
architectural decisions — from commit zero.

## Scope boundaries

- **In:** the reusable plumbing — monorepo structure, API/SPA wiring, auth
  strategy pattern, contract generation, shared tooling, CI, and the docs model.
- **Out:** any specific product domain. The Item example is a placeholder meant
  to be replaced (see the README's "Adapting This Template").
