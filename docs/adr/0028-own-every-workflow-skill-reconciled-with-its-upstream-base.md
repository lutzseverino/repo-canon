# Own every workflow skill, reconciled with its upstream base

Every workflow skill Repo Canon installs is an owned skill: Repo Canon
publishes it as its own, whether written for Repo Canon or taken from an
upstream skill. A skill taken from upstream records its upstream base, the
unedited upstream snapshot it was last reconciled with, and a `CREDITS.md`
that names that base and says how the skill differs from it. A skill Repo
Canon has not edited is identical to its base. The skill setup files under
`docs/agents` are owned files in the same way. Each upstream update is one
reconciliation: the snapshot of the new base replaces the old one, and each
owned skill and setup file takes the upstream change through a three-way merge
from the old base to the new one, with conflicts resolved by judgment. Source
checks fail when a recorded base differs from the vendored snapshot, or when a
file identical to its base claims edits.

Repo Canon had installed the upstream skills and setup files verbatim, and
stated the behaviour its workflow needs as rule text that overrides them. By
2026-10-31 eight installed skills and two setup files carried such overrides,
some contradicting the skill outright, such as `to-tickets` recommending a
shared integration branch that the contribution guide forbids. Every override
left an agent reconciling two documents at run time, and the cost of
reconciliation fell on each run instead of on each upstream update. The owner
chose owned copies in
[#750](https://github.com/lutzseverino/repo-canon/issues/750) and, in the
grill of 2026-10-31, extended them to every workflow skill, so that the
installed skills form one bundle with one source. Three alternatives were
rejected: a patch pointer appended to each verbatim skill, because the agent
still merges two documents at run time; owning only the skills Repo Canon
edits, because an agent would then have to know which kind each skill is; and
keeping the override threshold of
[ADR 0019](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md), because
counting overrides measures the cost in the wrong place.

## Consequences

- This supersedes [ADR 0019](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md).
  Nothing triggers a fork: every workflow skill is already owned, and Repo
  Canon edits one whenever the workflow needs it.
- This supersedes the verbatim-installation rule of
  [ADR 0008](0008-install-skill-setup-files-verbatim-from-upstream-seeds.md).
  The section that the earlier rewrite dropped unnoticed now shows in the
  three-way merge from the base.
- [ADR 0016](0016-keep-requirements-in-installed-rules.md) still keeps
  requirements in installed rules and methods in skills. Its consequences on
  judging a pinned skill's instruction before overriding it, and on when
  overrides give way to a fork, no longer apply: a skill that the rules
  contradict is edited to agree with them.
- [ADR 0001](0001-manage-shared-skills-through-standards-releases.md) still
  governs the reviewed upstream snapshot; that snapshot is now the base for
  reconciliation, not the installed copy.
- An owned skill names the repository files it reads and what it does when
  they are missing, so it can be installed and used without adopting Repo
  Canon.
