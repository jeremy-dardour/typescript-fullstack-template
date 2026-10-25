# ADR 0006: Same-parent integrity enforced in the service layer

**Status:** Accepted — 2026-10

## Decision

When an entity references a sibling that must share its parent (an order
line's product variant must belong to the same catalog as the order, a task's
current step must belong to that task), the constraint is enforced as a guard
in the owning service, not as a composite database foreign key.

A simple single-column FK (`variant_id → variant.id`) remains for referential
integrity and cascade/restrict behavior. The same-parent check is a guard at
the top of the service method that sets the reference.

## Why not composite FKs

The natural DB-level solution is a composite FK that includes the shared parent
column — e.g. `(catalog_id, variant_id) → Variant(catalog_id, id)`. With
MikroORM 7 it does not work:

- `TsMorphMetadataProvider` does not resolve `columnTypes` for composite FK
  join columns that reference non-PK unique constraints. The schema generator
  crashes with `TypeError: Cannot read properties of undefined (reading
'toLowerCase')` in `extractSimpleType`.
- The `joinColumns`/`ownColumns`/`referencedColumnNames` options exist in
  MikroORM's type definitions but are undocumented for `@ManyToOne`. The
  [composite keys docs](https://mikro-orm.io/docs/composite-keys) only cover
  composite primary keys, not composite FKs targeting unique constraints.
- The supporting `UNIQUE(parent_id, id)` constraints required as FK targets add
  schema noise for constraints that are redundant with the PK.

## Trade-offs

- **Lost:** a DB-level guarantee that the referenced entity shares the same
  parent. A direct SQL `UPDATE` bypassing the service layer can create an
  inconsistent reference.
- **Gained:** a working migration pipeline, simpler entity definitions, no
  reliance on undocumented ORM features.
- **Revisit** if writes start bypassing the service layer (other services
  writing the same tables, bulk SQL jobs), or once MikroORM documents
  composite FKs on unique constraints.
