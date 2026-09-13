# Adoption compatibility

This audit compares the accepted standards design with Repository Standards
1.1.0 and its published `repo-standards/v1` author format. It records facts and
the chosen preparation and setup routes; it does not extend the format or
claim adoption.

## Discovering documentation scope

The format accepts only explicit, disjoint paths and directory trees. It
rejects globs, repository-root targets, overlapping targets, and ancestors of
reserved product storage. Contextual assessment also rejects changed paths
outside the selected scope.

The confirmed requirement to find maintained project READMEs in arbitrary
monorepo layouts cannot be represented by one location-independent source.
Hardcoding common folders would change that requirement. This remains a
product capability gap.

Documentation migration has a related limitation. A contextual
`docs` directory can cover old categories and new destinations if no other
declaration owns a descendant. The shared files under `docs/agents` are
exact-owned, so that parent scope conflicts with them. Naming only the new
categories cannot authorize moving files from arbitrary old locations. Exact
ownership of these setup files is an accepted preference.

Required outcomes for a future scope capability:

- Inspect maintained project README targets in unfamiliar layouts, excluding
  fixtures, generated content, and organizational directories.
- Present concrete write scope before confirmation; changes affecting its
  resolution invalidate the previous confirmation.
- Account for source and destination paths during documentation moves while
  protecting exact content, reserved state, exclusions, symlinks, and unrelated
  project content.
- Preserve current behavior for selections that do not request the capability.

Sources: [author format](https://github.com/lutzseverino/repo-standards/blob/main/docs/author-format.md),
[path validation](https://github.com/lutzseverino/repo-standards/blob/main/src/paths.ts),
[contextual assessment](https://github.com/lutzseverino/repo-standards/blob/main/src/assessment.ts).

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

Sources: [inspection](https://github.com/lutzseverino/repo-standards/blob/main/docs/inspection.md),
[adoption sequence](https://github.com/lutzseverino/repo-standards/blob/main/src/adoption.ts).

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

Sources: [script protocol](https://github.com/lutzseverino/repo-standards/blob/main/docs/script-protocol.md),
[architecture](https://github.com/lutzseverino/repo-standards/blob/main/docs/architecture.md).
