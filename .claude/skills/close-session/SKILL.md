---
name: close-session
description: Wrap up a working session — write the dated session log, refresh the live current-state doc, propose durable facts to record, then offer to commit. Use when the user says "close the session", "wrap up", "log this session", "end of session", or is stopping work for the day.
---

# Close Session

End a working session in these steps. Each artifact has a home that already
defines its format and rules — follow those, don't restate them here.

1. **Write the session log.** Create the next `docs/sessions/session-NN-YYYY-MM-DD-slug.md`
   from the template and rules in [docs/sessions/README.md](../../../docs/sessions/README.md).

2. **Refresh the live status.** Update [docs/current-state.md](../../../docs/current-state.md)
   — the single home for "where we are" (bump its date; revise phase / done /
   open questions / next steps). Don't copy status into the session log; link.

3. **Propose durable facts — ask before persisting.** Review the session for
   reusable facts _not already written down_: working conventions, project
   constraints, external references, domain terms, decisions. **Propose them
   to the user and persist only the ones they approve**, each in its single
   home per the documentation map in [CLAUDE.md](../../../CLAUDE.md). This
   project keeps memory **in-repo** — never write to an external memory store.

4. **Offer to commit.** Show `git status`, then commit the docs if the user wants.

Honor the Visibility rule in [CLAUDE.md](../../../CLAUDE.md) — nothing personal
or secret goes into the session log.
