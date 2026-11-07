# ADR 0011: Shared instructions for Codex and Claude

**Status:** Accepted

**Supersedes:** ADR 0005's Claude-specific documentation map and startup loading
mechanism. Its one-home-per-fact documentation structure remains in effect.

## Context

The template supports both Codex and Claude sessions. Keeping the documentation
map and startup instructions only in `CLAUDE.md` leaves Codex without its native
repository entrypoint; copying instructions would introduce maintenance drift.

## Decision

`AGENTS.md` owns shared startup instructions, the documentation map, and task/path
triggers for the canonical rules. `CLAUDE.md` imports it as a thin adapter.
Skills and rules remain under `.claude/`; Codex discovers the same skill bodies
through directory symlinks under `.agents/skills/`.

Rules use explicit reading instructions and ordinary Markdown links. Claude
applies its path metadata; Codex follows the shared task/path triggers.

## Consequences

Each instruction has one maintained body. Checkouts need symlink support for
native Codex skill discovery. Tool-specific permissions remain separate from
shared behavioral guidance. ADR 0005 is preserved as history rather than amended.
