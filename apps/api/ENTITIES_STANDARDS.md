# Standards: MikroORM Entities

Inherits: [API standards](./STANDARDS.md).

## Decorator imports

```typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/core';
```

Legacy decorator mode is required by NestJS. Decorators come from
`@mikro-orm/decorators/legacy`, types from `@mikro-orm/core`.

## Metadata provider

`TsMorphMetadataProvider` reads TS source files. TypeScript types are the
single source of truth. Never duplicate in decorators what TsMorph infers from
the TS type (nullability, basic column type for `string`/`number`/`boolean`).

### Explicit vs inferred decorator options

| Scenario                  | Explicit?             | Why                                       |
| ------------------------- | --------------------- | ----------------------------------------- |
| `string` property         | No                    | Maps to `varchar(255)` by default         |
| `string` -> `text`        | `type: 'text'`        | TsMorph can't distinguish varchar vs text |
| UUID primary key          | `type: 'uuid'`        | TS type is `string`, can't infer UUID     |
| `Date` -> `timestamptz`   | `type: 'timestamptz'` | Explicit DB type for schema stability     |
| `Date` -> `date`          | `type: 'date'`        | Calendar day, not a timestamp             |
| Nullable                  | No                    | TsMorph infers from `?` / `\| null`       |
| `length: 255`             | No                    | Default for varchar                       |
| `length: N` (non-default) | Yes                   | TsMorph can't know the intended max       |
| `defaultRaw`              | Always                | Database-level default, not type info     |

### Nullability

Let TypeScript drive nullable inference. Do NOT add `nullable: true` in
decorators.

```typescript
@Property({ type: 'text' })
description?: Opt<string> | null;
```

- `?` - property omittable in `em.create()`
- `| null` - database column is nullable
- `Opt<T>` - property has a default or is optional in create operations

**Keep `| null` outside `Opt<>`.** `Opt<T>` is `T & Opt.Brand`, so
`Opt<string | null>` distributes to `(string & Brand) | (null & Brand)` and the
second half collapses to `never` — the property ends up typed
`(string & Brand) | undefined` and **cannot be assigned `null`**. Any service
that clears the column (`item.description = null`) fails to compile. Both
forms generate the same schema, so this is a TS-only distinction with no
migration impact.

## Property modifiers

| Modifier            | Meaning                                                              | Use for                                                                        |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `!: Opt<T>`         | Required at TS level, has DB default, omittable in `em.create()`     | Non-nullable columns with a DB default (`gen_random_uuid()`, `now()`, `false`) |
| `?: Opt<T> \| null` | Optional in `em.create()`, nullable in DB, set later by domain logic | Nullable columns populated by domain operations after creation                 |
| `?: T \| null`      | Optional in `em.create()`, nullable in DB, no default                | Nullable relations where assignment is optional                                |
| `!: T`              | Required, non-nullable, no DB default                                | Non-nullable columns the caller must always provide at creation                |

## Timestamps

```typescript
@Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
updatedAt!: Opt<Date>;

@Property({ type: 'timestamptz', defaultRaw: 'now()' })
createdAt!: Opt<Date>;
```

`createdAt` uses `defaultRaw` only. `updatedAt` adds `onUpdate` so MikroORM
sets it on every flush.

## Relationships

### Simple ManyToOne (owning side)

```typescript
import { ManyToOne } from '@mikro-orm/decorators/legacy';
import { Order } from '@/database/entities/order.entity';

@ManyToOne(() => Order, { deleteRule: 'cascade' })
order!: Order;
```

Use a lazy callback `() => ClassName` with a value import when there is no
circular dependency.

### OneToMany (inverse side)

A OneToMany always pairs with a ManyToOne pointing back, so the two entity
files import each other: the inverse side always uses the circular-reference
form below (type-only import + string entity name).

### Circular references

> **Why not just use value imports everywhere?** The MikroORM CLI uses SWC as
> its TS loader (`tsLoader: "swc"`). SWC compiles `import { Foo } from '...'`
> into live bindings with `let`/`const`. When two entity files import each
> other (e.g. Order ↔ OrderLine), whichever module loads second tries to access
> a `let`-bound export that hasn't been initialized yet — a TDZ (Temporal Dead
> Zone) `ReferenceError`. Standard `tsc` uses `var` which would silently yield
> `undefined`, but SWC throws. Even wrapping the reference in a lazy callback
> (`() => OrderLine`) doesn't help because SWC eagerly destructures the import
> binding at module load time, before any callback is called.

**Rule**: only one direction of each cycle uses a value import. The owning side
(ManyToOne, where the FK column lives) keeps the value import. The inverse side
(OneToMany, or a ManyToOne that can't hold the value import) uses a **type-only
import** with a string entity name + `as any`:

```typescript
// order-line.entity.ts — owning side keeps value import
import { Order } from '@/database/entities/order.entity';

@ManyToOne(() => Order, { deleteRule: 'cascade' })
order!: Order;
```

```typescript
// order.entity.ts — inverse side uses type-only import + string
import type { OrderLine } from '@/database/entities/order-line.entity';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
@OneToMany(() => 'OrderLine' as any, (line: OrderLine) => line.order)
lines = new Collection<OrderLine>(this);
```

The `as any` is needed because MikroORM 7's legacy decorator types don't accept
string entity names from callbacks (`EntityName<T>` requires a class), but the
runtime resolves strings from its entity registry. The cast is narrow — only on
the string literal. Every `as any` line requires an eslint-disable comment for
`no-unsafe-return` and `no-explicit-any`.

### Same-parent integrity

Do not use composite FKs (`joinColumns`/`ownColumns`/`referencedColumnNames`)
to enforce that a referenced entity shares the same parent. MikroORM 7's
metadata pipeline does not resolve column types for composite FKs targeting
non-PK unique constraints, breaking the schema generator. Enforce these
constraints as guards in the service layer instead. See
[ADR 0006](../../docs/adr/0006-same-parent-integrity-in-service-layer.md).

### Native Postgres enum

```typescript
export enum OrderStatus {
  Draft = 'draft',
  Placed = 'placed',
}

@Enum({ items: () => OrderStatus, nativeEnumName: 'order_status' })
status!: Opt<OrderStatus>;
```

`nativeEnumName` creates a Postgres `CREATE TYPE` instead of a check constraint.

## Unique constraints

### Unique ordered positions

```typescript
@Unique({
  properties: ['order', 'position'],
  deferMode: 'deferred',
})
```

`deferMode` belongs at the top level of `@Unique`. Do not put it under
`options`; MikroORM accepts that dictionary but does not apply it to the
constraint. Ordered mutations run in a transaction so the deferred uniqueness
check occurs only after final contiguous positions have been assigned.
Renumbering is **single-phase**: rewrite the final positions directly in one
locked transaction and let the deferred constraint absorb transient
collisions — never write temporary positions in a first pass.

## Explicit indexes

Postgres does **not** index FK columns automatically, and neither does this
MikroORM setup — an FK column is only indexed when an explicit `@Index`
declares it or a `@Unique` constraint leads with it (e.g. `order_line.order_id`
via `(order_id, position)`). So declare `@Index` on every FK used to load
children by parent, unless a unique constraint already covers it as the
leading column.
