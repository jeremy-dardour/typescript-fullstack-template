# ADR 0013: No tracked live-status file

**Status:** Accepted — 2026-11

**Supersedes:** ADR 0005's `docs/current-state.md` — its place in the
documentation map, its loading at session start, and the obligation to update it
at session end. The rest of ADR 0005 and ADR 0011 remain in force.

## Context

A single file holding live status, next steps and open questions, rewritten at
every session close, goes stale between rewrites. It duplicates the issue
tracker and the session logs, and it tends to grow into an execution ledger that
inflates the context loaded at every session start. When agents work in
parallel, every session rewriting the same file is a conflict source.

## Decision

The repository has no tracked live-status file and no replacement for one.
Open work, next steps and open questions live in the issue tracker
([docs/agents/issue-tracker.md](../agents/issue-tracker.md)). History and the
status at the end of each session live in the dated, immutable logs under
`docs/sessions/`. Sessions start by reading the project purpose, glossary and
standards, then consult the issue tracker and the latest session log.

## Consequences

- A cold session orients from purpose, glossary, standards, the issue tracker
  and the latest session log.
- Closing a session writes one new file instead of editing a shared one.
- Projects without an issue tracker need to choose a home for open work.
