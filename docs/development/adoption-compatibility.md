# Adoption compatibility

This document maps Repo Canon's accepted requirements to the Repository
Standards interface that supports them, and records the routes chosen where the
product leaves a gap.

## Supported source and discovery route

Use `repo-standards/v2` and the installed public CLI 7.1.0 with Node.js 24 as
the current validation and adoption baseline. Declare a minimum that was
actually validated against the released source bytes: `requires.repo-standards`
is the open-ended minimum `>=7.1.0`.
[ADR 0005](../adr/0005-require-an-open-ended-minimum-cli-version.md) states the
requirement as a minimum rather than an exact version, because the requirement
gates selection only and an exact one strands adopters. Format version and CLI
version are distinct, and the format version carries compatibility with CLI
releases above the floor.

| Accepted requirement                                            | Supported mapping                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact shared files and complete skill directories               | Exact file and skill declarations; retain disjoint ownership.                                                                                                                                                                                                                                                                                                                                                                                |
| Project-owned documents with known targets                      | Contextual file declarations where the target is fixed.                                                                                                                                                                                                                                                                                                                                                                                      |
| Project READMEs at arbitrary locations, including missing files | Repository declarations with separate `guidance` and `discovery` references; an agent resolves membership from repository evidence.                                                                                                                                                                                                                                                                                                          |
| Documentation reorganization around exact shared files          | Individual contextual source, destination, directory-index introduction, and link-repair paths; exact files remain outside contextual scope.                                                                                                                                                                                                                                                                                                 |
| Scope review before adoption                                    | First `inspect` returns discovery evidence; `inspect --scope` validates a `repo-standards/scope/v2` proposal, whose `documentation` entry the first `inspect` drafts by running the [documentation scope drafter](documentation-scope-drafter.md), the declaration's discovery script. Review the complete inspection and pass the same proposal to `start --scope --identity`; add `--confirmed` only when `confirmation.required` is true. |
| Files discovered during an active adoption                      | A confirmed scope never changes during a run; the CLI's [adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/adoption.md#correct-a-confirmed-scope) describes correcting it.                                                                                                                                                                                                                               |
| Scope changes after complete adoption                           | Every later update, including one with unchanged pins, inspects with a fresh proposal and a fresh inspection identity. Removed paths leave governance without deleting content.                                                                                                                                                                                                                                                              |

The inspection contract below defines scope proposals. Directory trees, globs,
root write scope, and subtraction of exact descendants are not discovered
targets, and an empty scope retains its declaration and operations.

Use the versioned [author format](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/author-format.md),
[inspection](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/inspection.md),
and [operation protocol](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/script-protocol.md)
contracts when implementing. Discovery supplies scope resolution; contextual
project agent guidance and authored GitHub setup use the routes below.
The [release procedure](release.md) states what each release requires.

## Preserving project instructions

Both profiles declare `docs/agents/project.md` as the contextual
`project-agent-guidance` file, with its own
[rules](../../rules/project-agent-guidance.md) and
[adoption guidance](../../guidance/project-agent-guidance.md). Adoption installs
the exact `AGENTS.md`, then the contextual work reads its replaced content from
`HEAD` and reconciles useful repository-specific instructions with any existing
project guidance. No separate preparation change is needed. A contradiction
with the standard requires the maintainer's answer and leaves the declaration
blocked until then. Projects with no useful instructions receive no empty file.

The `documentation` declaration leaves this target outside its scope. An
adopter whose previous confirmed documentation scope includes it uses a fresh
draft without it on update; the file remains under `project-agent-guidance`.

Sources: [inspection](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/inspection.md),
[adoption sequence](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/src/adoption.ts).

## GitHub repository settings

Labels, required checks, and squash defaults need remote configuration and
readback. Local templates and workflow files cannot establish those settings.
Trusted author operations can call GitHub, but the current product does not
bind remote before-state to inspection or provide remote ownership baselines.

The selected route uses repeat-safe author operations. Their implementation
and prerequisites must be reviewed and exercised. They verify repository
identity, preserve unrelated settings,
report partial effects, block on missing permission, and verify the result.
They create missing configuration freely and return `confirmation-required`
without mutation before changing an existing chosen value; the maintainer's
`resume --confirmed` authorizes that fix's overwrite.
They must not imply remote freshness or rollback guarantees from local
inspection. They run during adoption; authoring exercises use disposable
fixtures and do not mutate live GitHub settings.

Both fixes declare `remote-setup` with a readiness probe, so adoption can
complete locally without GitHub access. Inspection runs each probe before any
write. A probe reuses its fix's preparation and role check read-only: it is
`ready` when `gh` meets the fix's minimum version, the remotes name one
github.com repository that GitHub confirms, `gh` is authenticated, and the
account has the fix's role, and `not-ready` otherwise with the reason the fix
would block with. The adopter can defer a remote setup that is not ready; the
record and `status` list it, and every later run probes again and applies it
once ready. A probe reads no setting its fix reconciles, so overwrite
confirmation and the plan-gated `PR metadata` requirement stay with the fixes.
The [label setup](github-label-setup.md#readiness-probe) and
[PR integration setup](github-pr-integration-setup.md#readiness-probe)
documents describe each probe.

Sources: [script protocol](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/script-protocol.md),
[remote setup](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/adoption.md#remote-setup),
[architecture](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/development/architecture.md).
