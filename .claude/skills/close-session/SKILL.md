---
name: close-session
description: Wrap up a working session — write the dated session log, refresh the live current-state doc, propose durable facts to record, then handle an authorized commit. Use when the user says "close the session", "wrap up", "log this session", "end of session", or is stopping work for the day.
---

# Close Session

End a working session in these steps. Each artifact has a home that already
defines its format and rules — follow those, don't restate them here.

1. **Write the session log.** Create the next `docs/sessions/session-NN-YYYY-MM-DD-slug.md`
   from the template and rules in [docs/sessions/README.md](../../../docs/sessions/README.md).

2. **Refresh the live status.** Update [docs/current-state.md](../../../docs/current-state.md)
   — the single home for "where we are" (bump its date; revise phase / done /
   open questions / next steps). Don't copy status into the session log; link.

3. **Propose durable facts to record.** Review the session for reusable facts
   not already recorded: conventions, constraints, references, domain terms,
   and decisions. Propose them to the user and persist only those they approve,
   each in its single home per [AGENTS.md](../../../AGENTS.md).

4. **Commit when authorized.** Show `git status` and review the intended diff.
   If committing is already authorized, stage only the intended files and
   commit; otherwise report the changes without committing.

Follow the visibility and in-repo memory rules in [AGENTS.md](../../../AGENTS.md).
