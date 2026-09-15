# Adoption compatibility

The required scope capability is delivered in Repository Standards 1.2.1.
Product [#41](https://github.com/lutzseverino/repo-standards/issues/41) and
delivery [#50](https://github.com/lutzseverino/repo-standards/issues/50) are
closed. The owner's [acceptance reconciliation](https://github.com/lutzseverino/repo-standards/issues/41#issuecomment-5664401656)
records completed macOS public verification and distinguishes the broader
1.2.0 agent evidence from the 1.2.1 patch evidence. This satisfies Repo Canon's
product dependency. Repo Canon's final CLI 1.2.2 source validation and adoption
evidence are recorded separately in [the adoption record](adoption-evidence.md).

## Supported source and discovery route

Use `repo-standards/v2` and the installed public CLI 1.2.2 with Node.js 24 as the
final validation and adoption baseline. Declare only compatibility actually
validated against the final source bytes; `requires.repo-standards` is the exact
version `1.2.2`. Format version and CLI version are distinct. The successful
1.2.1 local source validation and failed public acquisition remain historical
evidence rather than the final baseline.

| Accepted requirement | Supported mapping |
| --- | --- |
| Exact shared files and complete pinned skill directories | Exact file and skill declarations; retain disjoint ownership. |
| Project-owned documents with known targets | Contextual file declarations where the target is fixed. |
| Project READMEs at arbitrary locations, including missing files | Repository declarations with separate `guidance` and `discovery` references; an agent resolves membership from repository evidence. |
| Documentation reorganization around exact shared files | Individual contextual source, destination, directory-index introduction, and link-repair paths; exact files remain outside contextual scope. |
| Scope review before adoption | First `inspect` returns discovery evidence; `inspect --scope` validates a `repo-standards/scope/v1` proposal. Confirm the complete inspection and pass the same proposal to `start --scope`. |
| Files discovered during an active adoption | Preview with `inspect --amend-scope`, then confirm through `resume --amend-scope`. Amendments retain existing ownership and only add paths; fixes replay and assessment/checks must be renewed. |
| Scope changes after complete adoption | Deliberate retained `inspect --readopt` and confirmed `start --readopt` with fresh discovery and unchanged pins. Removed paths leave governance without deleting content. |

Scope proposals list individual files with evidence, candidate decisions,
coverage rationale, and any unresolved questions. Missing READMEs require
absence evidence and positive evidence of a maintained Project. Directory
trees, globs, root write scope, and subtraction of exact descendants are not
discovered targets. Empty scope retains its declaration and operations;
unresolved coverage blocks start. Changed evidence requires fresh inspection
and review, and writes outside confirmed scope remain invalid.

Use the versioned [author format](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/author-format.md),
[inspection](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/inspection.md),
and [operation protocol](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/script-protocol.md)
contracts when implementing. Discovery supplies scope resolution; the separate
AGENTS preparation and authored GitHub setup routes below remain necessary.
Repo Canon acceptance combines final validation, operation and skill exercises,
whole-source review, and complete adoption with authorized remote readback. The
development records now supply those evidence classes while keeping their
boundaries explicit.

## Historical CLI 1.1.0 scope audit

The following findings describe the original `repo-standards/v1` audit. The v2
route above resolves the missing capability; these v1 limitations remain
useful regression context rather than an outstanding product dependency.

The format accepts only explicit, disjoint paths and directory trees. It
rejects globs, repository-root targets, overlapping targets, and ancestors of
reserved product storage. Contextual assessment also rejects changed paths
outside the selected scope.

The confirmed requirement to find maintained project READMEs in arbitrary
monorepo layouts cannot be represented by one location-independent source.
Hardcoding common folders would change that requirement. This was the
product capability gap that prompted the v2 work.

Documentation migration has a related limitation. A contextual
`docs` directory can cover old categories and new destinations if no other
declaration owns a descendant. The shared files under `docs/agents` are
exact-owned, so that parent scope conflicts with them. Naming only the new
categories cannot authorize moving files from arbitrary old locations. Exact
ownership of these setup files is an accepted preference.

Required outcomes recorded for the scope capability:

- Inspect maintained project README targets in unfamiliar layouts, excluding
  fixtures, generated content, and organizational directories.
- Present concrete write scope before confirmation; changes affecting its
  resolution invalidate the previous confirmation.
- Account for source and destination paths during documentation moves while
  protecting exact content, reserved state, exclusions, symlinks, and unrelated
  project content.
- Preserve current behavior for selections that do not request the capability.

Historical sources: [author format](https://github.com/lutzseverino/repo-standards/blob/v1.1.0/docs/author-format.md),
[path validation](https://github.com/lutzseverino/repo-standards/blob/v1.1.0/src/paths.ts),
[contextual assessment](https://github.com/lutzseverino/repo-standards/blob/v1.1.0/src/assessment.ts).

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

Sources: [inspection](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/inspection.md),
[adoption sequence](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/src/adoption.ts).

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

Sources: [script protocol](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/script-protocol.md),
[architecture](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/architecture.md).
