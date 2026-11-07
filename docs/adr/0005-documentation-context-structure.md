# ADR 0005: Documentation is structured as one home per fact

**Status:** Accepted — 2026-07

## Decision

Durable project knowledge lives in a fixed set of single-purpose docs, each the
sole owner of its kind of fact:

- `docs/project-purpose.md` — why the project exists, who it's for, scope
- `CONTEXT.md` — domain glossary (entities, statuses, rules; present-tense)
- `docs/domain-decisions.md` — domain/design decisions + rationale (append-only)
- `docs/adr/` — technical/architectural decisions (this directory)
- `docs/current-state.md` — the single live "where we are" (status, next, open questions)
- `docs/sessions/` — one dated, append-only summary per working session

`CLAUDE.md` holds the map of these docs and `@`-imports `project-purpose.md`,
`CONTEXT.md`, and `current-state.md` so they load into every session. Live status
lives only in `current-state.md`; decisions are append-only in their decision
doc; session files record what happened and link out rather than restating
current truth. Project "memory" lives in-repo, in these docs — not in any
external per-machine memory store.

## Why

Agents (and humans) start each session cold and need the right context fast. The
failure mode this replaces is scattered handoff/journal docs — each re-stating
purpose, status, and decisions in slightly different, drifting words until it's
unclear which is true. Giving every fact exactly one home removes
duplication-driven staleness; `@`-imports guarantee the orientation docs are
always loaded; and the append-only decision log + per-session summaries preserve
_how we got here_ without polluting the _what is true now_. The split between
"present-tense truth" (`CONTEXT.md`) and "why" (`domain-decisions.md` / ADRs)
keeps each doc doing one job.

## Trade-off

More upfront structure and discipline than a single `README`/`NOTES` file:
contributors must know where each kind of fact goes, and must update
`current-state.md` at session end instead of leaving status buried in the latest
session log. For a throwaway spike that's overhead; for anything long-lived and
AI-assisted — which is what this template targets — it pays for itself quickly.
The scaffold docs ship with placeholder content that **must be replaced** per
project (see the "⚠ Replace this" banners); left unfilled, they add noise rather
than context.
