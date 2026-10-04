# Adoption compatibility

This document maps Repo Canon's accepted requirements to the Repository
Standards interface that supports them, and records the routes chosen where the
product leaves a gap.

## Supported source and discovery route

Use `repo-standards/v2` and the installed public CLI 5.0.0 with Node.js 24 as
the current validation and adoption baseline. Declare a minimum that was
actually validated against the released source bytes: `requires.repo-standards`
is the open-ended minimum `>=5.0.0`.
[ADR 0005](../adr/0005-require-an-open-ended-minimum-cli-version.md) states the
requirement as a minimum rather than an exact version, because the requirement
gates selection only and an exact one strands adopters. Format version and CLI
version are distinct, and the format version carries compatibility with CLI
releases above the floor.

| Accepted requirement                                            | Supported mapping                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact shared files and complete skill directories               | Exact file and skill declarations; retain disjoint ownership.                                                                                                                                                                                                                                              |
| Project-owned documents with known targets                      | Contextual file declarations where the target is fixed.                                                                                                                                                                                                                                                    |
| Project READMEs at arbitrary locations, including missing files | Repository declarations with separate `guidance` and `discovery` references; an agent resolves membership from repository evidence.                                                                                                                                                                        |
| Documentation reorganization around exact shared files          | Individual contextual source, destination, directory-index introduction, and link-repair paths; exact files remain outside contextual scope.                                                                                                                                                               |
| Scope review before adoption                                    | First `inspect` returns discovery evidence; `inspect --scope` validates a `repo-standards/scope/v2` proposal, whose `documentation` entry the shipped [documentation scope drafter](documentation-scope-drafter.md) drafts. Confirm the complete inspection and pass the same proposal to `start --scope`. |
| Files discovered during an active adoption                      | A confirmed scope never changes during a run; the CLI's [adoption guide](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/adoption.md#correct-a-confirmed-scope) describes correcting it.                                                                                             |
| Scope changes after complete adoption                           | Every later update, including one with unchanged pins, inspects with a fresh proposal and a newly confirmed inspection. Removed paths leave governance without deleting content.                                                                                                                           |

The inspection contract below defines scope proposals. Directory trees, globs,
root write scope, and subtraction of exact descendants are not discovered
targets, and an empty scope retains its declaration and operations.

Use the versioned [author format](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/author-format.md),
[inspection](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/inspection.md),
and [operation protocol](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/script-protocol.md)
contracts when implementing. Discovery supplies scope resolution; the separate
AGENTS preparation and authored GitHub setup routes below remain necessary.
The [release procedure](release.md) states what each release requires.

## Preserving project instructions before replacement

Inspection exposes the current and proposed AGENTS.md contents. The CLI then
installs exact content before running fixes or returning contextual work, so
neither phase can write preserved project instructions before replacement.
Recovering old content from Git afterward would miss the accepted ordering.

The selected route is a separate preparation change: reconcile useful
instructions into `docs/agents/project.md`, commit through the project's normal
workflow, and inspect the prepared repository again before adoption. This uses
no author adoption hook or automatic product commit. Unresolved contradictions
block preparation. Projects with no useful existing instructions receive no
empty project guidance file. Integrated preparation support is not required
for the selected workflow.

Sources: [inspection](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/inspection.md),
[adoption sequence](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/src/adoption.ts).

## GitHub repository settings

Labels, required checks, and squash defaults need remote configuration and
readback. Local templates and workflow files cannot establish those settings.
Trusted author operations can call GitHub, but the current product does not
bind remote before-state to inspection or provide remote ownership baselines.

The selected route uses repeat-safe author operations. Their implementation
and prerequisites must be reviewed and exercised. They verify repository
identity, preserve unrelated settings,
report partial effects, block on missing permission, and verify the result.
They must not imply remote freshness or rollback guarantees from local
inspection. They run during adoption; authoring exercises use disposable
fixtures and do not mutate live GitHub settings.

Sources: [script protocol](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/usage/script-protocol.md),
[architecture](https://github.com/lutzseverino/repo-standards/blob/v5.0.0/docs/development/architecture.md).
