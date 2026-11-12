# ADR 0012: CI reuses a passing test result for identical test inputs

**Status:** Accepted — 2026-11

## Context

AI-assisted work produces many commits that change only documentation, session
logs, rules or skills. Each one reran the database, browser and image jobs,
which cannot be affected by those files. `paths-ignore` on the workflow would
skip them, but it also skips the format check that covers Markdown, leaves
required status checks pending, and decides from the diff of one push rather
than from what was actually tested.

## Decision

CI hashes the committed tree minus a short list of paths no test reads
(`NON_TEST_INPUTS` in `scripts/ci/check-reuse.mjs`). When a run with the same
hash has already passed every job, the test jobs are skipped. Format,
dependency, type and lint jobs always run. Pushes to `main`, manual runs and
full re-runs always run everything. Operating details are in the
[README](../../README.md#reusing-passing-checks).

The list names what is excluded, so an unknown path counts as a test input.
The result is saved by a job that depends on every check, so it exists only
for a fully green run.

## Consequences

- Documentation-only commits finish in the time of the static checks.
- The hash is of content, so a revert or a rebase onto an already-tested tree
  is reused too.
- A PR whose first run is a reuse gets no coverage comment; the coverage is
  that of the run named in the Select Checks summary.
- Two things need upkeep and both fail safe or are stated at the edit site: the
  exclusion list (a missing entry only costs a test run) and the `needs` list of
  `save-passing-checks` (a check missing from it would not guard the result).
- A test that starts reading an excluded path, such as a docs link checker,
  must remove that path from the list.
