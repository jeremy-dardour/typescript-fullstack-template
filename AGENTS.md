# Agent instructions

NestJS API + React SPA monorepo. See [README.md](README.md) for setup and commands.

## Start here

At session start, read [project purpose](docs/project-purpose.md),
[domain glossary](CONTEXT.md), and [global standards](STANDARDS.md). Open work,
next steps and open questions live in the
[issue tracker](docs/agents/issue-tracker.md). Consult relevant
[ADRs](docs/adr/) before changing documented architectural decisions; record
new trade-offs there.

## Visibility and memory

This repository is public. Use generic placeholders; keep personal information,
secrets, and private plans out of files and commit messages. Projects created
from this template should replace this visibility posture.

Keep durable project memory in-repo, with one home per fact:

| Document                                             | Owns                                            |
| ---------------------------------------------------- | ----------------------------------------------- |
| [docs/project-purpose.md](docs/project-purpose.md)   | Purpose, audience, scope                        |
| [CONTEXT.md](CONTEXT.md)                             | Domain terminology and rules                    |
| [docs/domain-decisions.md](docs/domain-decisions.md) | Domain decisions and rationale                  |
| [docs/sessions/](docs/sessions/)                     | Dated session history, linking to current truth |
| [docs/adr/](docs/adr/)                               | Architectural decisions                         |

## Task context

Read the linked instructions when the path or task applies. These are shared
sources for Codex and Claude Code; read their linked references as directed.

| Path or task                                                                | Instructions                                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| API work (`apps/api/**`)                                                    | [API context](.claude/rules/api.md)                                                                                  |
| API controllers                                                             | [Route authentication](.claude/rules/api-controllers.md)                                                             |
| Entity changes                                                              | [Entity standards](.claude/rules/entities.md); regenerate and verify migrations per [API README](apps/api/README.md) |
| API behavior, routes, DTOs, Swagger, auth responses, or generated contracts | [API contracts](.claude/rules/api-contracts.md)                                                                      |
| Web work (`apps/web/**`)                                                    | [Web context](.claude/rules/web.md)                                                                                  |
| Tests                                                                       | [Test conventions](.claude/rules/tests.md)                                                                           |
| Dependencies, manifests, lockfile                                           | [Dependency rules](.claude/rules/dependencies.md)                                                                    |
| Before declaring implementation complete                                    | [finish-work](.claude/skills/finish-work/SKILL.md)                                                                   |
| Changed runtime flows; run, inspect, or screenshot the app                  | [verify-app](.claude/skills/verify-app/SKILL.md)                                                                     |
| Close or log a session                                                      | [close-session](.claude/skills/close-session/SKILL.md)                                                               |
| Decisions to ask the user for                                               | [ask-decisions](.claude/skills/ask-decisions/SKILL.md)                                                               |
| Issues, specs, or triage                                                    | [Issue tracker](docs/agents/issue-tracker.md), [triage labels](docs/agents/triage-labels.md)                         |
| Architecture decisions (`docs/adr/**`)                                      | [ADR lifecycle](.claude/rules/adr.md)                                                                                |
| Domain modeling                                                             | [Domain documentation](docs/agents/domain.md)                                                                        |

Before connecting to services or taking screenshots, read [PORTS.md](PORTS.md):
parallel checkouts use configured ports rather than assumed defaults.
