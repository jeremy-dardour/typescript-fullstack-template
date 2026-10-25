# Issue tracker

Build issues are tracked as **GitHub Issues** on the repo. PRDs and specs live
as committed markdown under `docs/specs/`.

## Conventions

- **PRDs / specs:** `docs/specs/<feature-slug>/PRD.md`
- **Build issues:** GitHub Issues, linked from the spec they implement.
- **Triage state:** a GitHub label per role, using the strings in
  [triage-labels.md](./triage-labels.md).

## When a skill says "publish to the issue tracker"

Create a GitHub issue via `gh issue create`, and link it from the spec it
implements.

## When a skill says "fetch the relevant ticket"

Use `gh issue view <number>` or read the linked spec file.
