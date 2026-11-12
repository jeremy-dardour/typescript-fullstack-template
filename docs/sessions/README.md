# Sessions

One dated summary per working session — an append-only history of what was done,
what was learned, and the status at the time. These are immutable records: don't
edit past sessions when things later change.

- **Naming:** `session-NN-YYYY-MM-DD-slug.md`
- **Link, don't restate:** domain decisions live in
  [../domain-decisions.md](../domain-decisions.md); open work lives in the
  [issue tracker](../agents/issue-tracker.md).

See [ADR 0005](../adr/0005-documentation-context-structure.md) for why the docs
are structured this way.

## Template

Use this template when logging or closing a session.

```markdown
# Session NN — <title> (YYYY-MM-DD)

## What was done

- <concrete actions taken this session>

## Decisions

- <domain decisions → link to the ../domain-decisions.md rows they added;
  technical decisions → ../adr/. Write "None" if the session made none.>

## Learnings / tensions surfaced

- <non-obvious things learned, trade-offs weighed, dead-ends — skip if none>

## Status at end of session

<brief historical outcome; link unfinished work to its issue>
```

How to fill it: keep bullets terse and factual; **link, don't restate** —
decisions live in `../domain-decisions.md` / `../adr/`, open work lives in the
issue tracker. The session file is an immutable record of _what
happened_, so don't edit past sessions when things later change.
