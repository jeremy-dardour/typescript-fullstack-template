# Standards: API

Inherits: [Global standards](../../STANDARDS.md)

## Module structure

```
src/
  app/            → Infrastructure (auth, config, filters, interceptors, health, logger)
  modules/        → Feature modules (one per domain capability)
    <feature>/
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
      repositories/
        <concern>.repository.ts → Persistence operations for an entity,
                                  aggregate, or read model
      dtos/
        input/    → Create/Update DTOs (class-validator + @ApiProperty)
        output/   → Response DTOs (@ApiProperty only)
  database/       → Entities, migrations, seeders, factories
  shared/         → Shared types and utilities
  commands/       → CLI commands (nest-commander)
```

## File roles and ownership

Each `app/` area exposes its public interface through `index.ts`. Keep
framework wiring and shared capabilities without feature HTTP endpoints in
`app/`; feature endpoints belong in `modules/` (health is infrastructure).
Keep single-feature capabilities with their feature. `shared/` holds generic
code without injectable services; area-specific helpers stay with their owner.

Source filenames use a role from this closed list:

| File role         | Responsibility                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.module.ts`      | Wire a Nest capability's providers, controllers, imports, and public exports.                                                                                                                                                      |
| `.controller.ts`  | Translate HTTP requests into service calls and map their results to response DTOs.                                                                                                                                                 |
| `.service.ts`     | Implement an injectable application capability or coordinate business behavior through repositories; a strategy implementation keeps that pattern in its name, such as `JwtAuthStrategyService` in `jwt-auth-strategy.service.ts`. |
| `.repository.ts`  | Encapsulate its owner's queries, persistence, and transaction orchestration behind a service-facing interface.                                                                                                                     |
| `.store.ts`       | Expose the owner's persistence operations for another module's repository to execute within the caller's transaction.                                                                                                              |
| `.guard.ts`       | Decide whether a request may proceed based on authentication or access requirements.                                                                                                                                               |
| `.middleware.ts`  | Perform request-level processing before Nest route handling.                                                                                                                                                                       |
| `.interceptor.ts` | Wrap handler execution to apply cross-cutting behavior such as timeouts or response headers.                                                                                                                                       |
| `.filter.ts`      | Translate exceptions into the application's HTTP error contract.                                                                                                                                                                   |
| `.decorator.ts`   | Declare reusable metadata or extract request values for framework consumers.                                                                                                                                                       |
| `.command.ts`     | Expose a CLI operation and delegate its application behavior to the appropriate capability.                                                                                                                                        |
| `.util.ts`        | Provide a focused plain function without dependency injection or persistence ownership.                                                                                                                                            |
| `.mail.ts`        | Build one email template's subject and content without sending it.                                                                                                                                                                 |
| `.policy.ts`      | Evaluate a business rule as a pure function of explicit inputs, including time when relevant.                                                                                                                                      |
| `.types.ts`       | Declare compile-time types and interfaces without runtime behavior.                                                                                                                                                                |
| `.errors.ts`      | Define named error classes that describe failures owned by the area.                                                                                                                                                               |
| `.constants.ts`   | Hold stable named runtime values that have no computation or lifecycle.                                                                                                                                                            |
| `.config.ts`      | Assemble configuration for a framework, library, or application capability.                                                                                                                                                        |
| `.schema.ts`      | Define runtime validation and parsing for data outside the HTTP DTO validation layer.                                                                                                                                              |
| `.dto.ts`         | Describe an HTTP input or output shape, including validation and API documentation where applicable.                                                                                                                               |
| `.entity.ts`      | Define a persisted domain model, its ORM mapping, and entity-local behavior.                                                                                                                                                       |

ESLint enforces this closed source-role list. These files follow separate conventions:

| File kind                              | Responsibility                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `index.ts`                             | Expose the owning area's deliberate public interface.                                           |
| `main.ts`                              | Bootstrap the application or CLI and its runtime lifecycle.                                     |
| Migration                              | Apply a versioned database schema change and its supported rollback.                            |
| Seeder                                 | Populate an environment with intentional initial or development data.                           |
| Factory                                | Construct test or development entities with reusable defaults.                                  |
| `.spec.ts`, `.test.ts`, `.e2e-spec.ts` | Verify behavior at the appropriate unit, integration, or end-to-end boundary.                   |
| `.d.ts`                                | Describe types supplied by generated code, external libraries, or ambient runtime declarations. |
| Generated source                       | Represent tool-owned output that is regenerated from its authoritative input.                   |

By default, extract on the second consumer.

## Architecture boundaries

- Consumers outside an `app/` area import its public `index.ts`; imports
  within that area can use its internal files.
- Features keep their ordinary repositories and implementation details private.
  Another feature may import the owner's Nest module to wire its exported store,
  and repositories may consume that store through the owner's public interface.
- Feature public indexes use explicit named exports of their own `.module`,
  `.store`, and `.types` files. Import public types with `import type`; store
  re-exports belong only in the owning module or app-area root index. The owning Nest
  module may import its store to register the provider.
- `app/` cannot depend on feature modules. CLI commands use public interfaces
  rather than deep imports into application capabilities.
- Stores may belong to an `app/` capability or a feature module. A store
  exposes its owner's persistence operations when another module needs
  to include them in its own transaction. Introduce it only when that cross-module
  consumer exists. Only repositories call stores; the caller supplies the
  transaction's `EntityManager`. The owner implements its persistence rules.
- Services depend on their own repositories. Operations that don't need a
  shared transaction use an appropriate public application capability rather
  than exposing persistence internals.

See [ADR 0010](../../docs/adr/0010-public-interfaces-and-file-roles.md) for the
architecture decision.

## Persistence seam

Repositories encapsulate persistence. The dependency flow is:

```text
Controller → Service → Repository → EntityManager
```

- Only repository implementations may inject an `EntityManager` or
  `EntityRepository`. Services call their injected repositories — including
  the finders a repository inherits from `EntityRepository` (`findOne`,
  `findOneOrFail`, `find`) with plain criteria — but never touch the
  `EntityManager` or use `populate`, `flush`, `persist`, `assign`, query
  builders, or transactions. Entity definitions, migrations, seeders,
  database configuration, and database-backed tests are the expected
  exceptions.
- Repositories accept and return entities, IDs, query criteria, or
  query-specific entity graphs—never input or output DTOs. Repository `save`
  methods call `persist(entity)` followed by `flush()`.
- Operations that create or update rows identified by a unique key must use an
  atomic database operation (`upsert`, conflict handling, or an appropriate
  lock). Do not implement them as find-then-insert when concurrent requests are
  possible.
- A read model (a dashboard, an aggregate view) gets a query-focused
  repository rather than being forced through an entity CRUD repository.
- Services instantiate and mutate entities from input DTOs; services or
  controllers map entities to output DTOs. Entity methods expose neutral
  collection accessors so DTO mapping never calls MikroORM `Collection` APIs.
- Extend `EntityRepository<T>` for entity-scoped repositories to inherit
  standard CRUD methods (`findOne`, `findOneOrFail`, `find`, `findAll`,
  etc.). Only add domain-specific methods on top. Query-focused repositories
  that span multiple entities inject `SqlEntityManager` directly instead.
- Use one concrete `<concern>.repository.ts` class while MikroORM is the only
  persistence adapter. Do not add a parallel abstract repository plus a
  `MikroOrm*Repository` implementation or generic base repository until a
  second real adapter requires that seam.
- Internal queries remain repository methods or private functions. Cross-module
  atomic operations use the owner's store; `.query.ts` is not a file role.
- The persistence seam is framework-free: repository-layer code (including stores) signals a vanished row with MikroORM's `NotFoundError`
  — which the exception filter maps to 404 — never with a NestJS HTTP
  exception.

## Entity definitions (MikroORM 7)

See [ENTITIES_STANDARDS.md](./ENTITIES_STANDARDS.md).

### Migrations

- Create after entity changes: `pnpm --filter api mikro-orm migration:create`
- Verify zero schema diff: `pnpm mikro-orm schema:update --dump`
- CLI uses SWC as TS loader (`tsLoader: "swc"` in package.json)
- In production, migrations run at container start — see
  [ADR 0001](../../docs/adr/0001-migrations-run-on-container-start.md)

## DTOs

- Input DTOs: `class-validator` decorators + `@ApiProperty` for Swagger
- Output DTOs: `@ApiProperty` only (no validation on responses)
- Plain classes with `!` non-null assertions, no base class
- Actor identity comes from the authenticated request (`@CurrentUser()`).
  Mutation DTOs never accept an actor, author, or current-user ID when the
  server can determine it.
- A field that may be omitted but must not be `null` uses
  `@IsOptionalNotNull()`: `@IsOptional()` also lets an explicit `null` through,
  which reaches a non-nullable column as a 500 instead of a 422.
- A domain error with its own RFC 9457 problem type throws
  `ProblemDetailsException(status, typeSlug, detail)`.
- Use one canonical output DTO per entity by default. Aggregate responses
  compose those DTOs rather than introducing near-duplicate projections.
  Create a read-model-specific entity DTO only when its shape is materially
  different, not merely a subset or a few additional derived fields.

## Route authentication

- `AuthGuard` is global: every route needs a valid token unless the handler or
  controller is `@Public()`.
- `route-auth-coverage.e2e-spec.ts` reads every controller route from
  metadata and enforces it: non-public routes answer 401 without a token, and
  the `@Public()` routes must match a reviewed `PUBLIC_ROUTES` list. Routes
  mounted outside controllers (the dev-only API docs) and controllers
  registered only in other environments are out of its reach.

## Environment config

- Zod schemas for env validation (not class-validator) — the split is
  deliberate, see [ADR 0002](../../docs/adr/0002-dual-validation-stack.md)
- Base schema in `src/shared/types/env.base.schema.ts`
- App-specific schema extends base in `src/app/config/env.schema.ts`

## Error handling

- `AllExceptionsFilter` catches everything, converts MikroORM `NotFoundError` → 404
- `ProblemDetailsFilter` formats HTTP exceptions per RFC 9457
- `nestjs-cls` provides request/correlation/trace IDs

## Testing

- E2E tests: `src/__e2e-tests__/`, named `*.e2e-spec.ts`, serial execution, real PostgreSQL
- Vitest configs: `vitest.config.mts` (unit) and `vitest.e2e.config.mts` (e2e)
- The serial e2e suite can flake under heavy machine load: rotating single
  failures with boot-time 401/404s in unrelated specs. Re-run on an idle
  machine before diagnosing a "failure" that moves between specs.
