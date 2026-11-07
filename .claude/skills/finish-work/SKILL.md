---
name: finish-work
description: Check implementation work against its acceptance criteria, run completion checks and the real app, and review the intended diff before reporting completion or making an authorized commit.
---

# Finish work

The agent responsible for delivery owns this pass: the orchestrator when work
is delegated, or the implementer when working alone. Implementers run scoped
checks before handoff and provide commands, results, and gaps. The owner reviews
that evidence against the final diff and runs remaining integration checks;
rerun checks when changes or uncertainty invalidate the evidence. This workflow
does not require a dedicated subagent.

1. **Acceptance.** Recover the requested behavior and acceptance criteria
   from the task or originating spec. Map each criterion to a check or an
   explicit gap. Resolve failures within scope before claiming completion.

2. **Checks.** Select and explain checks from the affected behavior and its
   dependencies, including consumers of shared code, contracts, configuration,
   or dependency changes. Run the relevant formatting, lint, type, and test
   checks; broaden when failures or uncertainty warrant it. Full CI provides
   the broad safety net. `pnpm dod` is an optional local convenience, not a
   completion prerequisite. Record failures and unavailable checks as gaps.

3. **Real flow.** For changed runtime behavior, follow
   [verify-app](../verify-app/SKILL.md). For API changes, follow the
   [contract rules](../../../.claude/rules/api-contracts.md).

4. **Review.** Inspect the intended diff, including new files, for correctness,
   scope, stale comments, unintended generated or migration changes, and the
   repository's public visibility rules. Preserve unrelated work. Fix issues
   and rerun checks affected by the fixes; acceptance requires evidence for
   the final implementation.

5. **Record and hand off.** Report acceptance results, selected checks and why they cover the impact,
   real flows exercised, diff review outcome, and remaining gaps. Record
   durable evidence in the task's established record when one exists; follow
   `close-session` when asked to close or log the session. Commit only when
   the user has authorized it, stage only the intended files, and review the
   staged diff before committing. A request to verify work alone does not
   authorize a commit.
