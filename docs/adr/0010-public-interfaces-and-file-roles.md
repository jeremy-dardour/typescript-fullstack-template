# ADR 0010: Public interfaces, transaction stores, and file roles

**Status:** Accepted

## Decision

Application capabilities and feature modules expose deliberate public interfaces.
Cross-area imports use those interfaces rather than depending on internal files.
ESLint enforces the boundaries and the closed source filename taxonomy documented
in [API standards](../../apps/api/STANDARDS.md).

A store is the owner's public persistence interface for operations another module
must include in its transaction. Introduce a store only when that consumer exists.
Repositories call stores with the caller's transaction EntityManager; services
continue to use their own repositories. Ordinary repositories stay private.

Queries internal to a module remain repository methods or private functions.
There is no separate `.query` file role. This supersedes ADR 0007's shared-query
convention. By default, extract on the second consumer.

## Rationale

These rules provide a reusable structure across products: recognizable file
roles, explicit dependencies, and an owner for persistence rules. They do not
prescribe product-specific authentication flows, entities, or hosting.

Explicit transaction arguments let a cross-module operation commit atomically
without making persistence available to services or exposing private queries.
The template does not add unused stores merely to demonstrate the pattern.

## Consequences

Existing source files and imports must conform when the rules are introduced.
New filename roles require a deliberate change to standards and enforcement.
Stores expose the ORM transaction type within the persistence layer; consumers
must respect the owner's locking and integrity requirements.
