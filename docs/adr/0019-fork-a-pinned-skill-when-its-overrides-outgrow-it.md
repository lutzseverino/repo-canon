# Fork a pinned skill when its overrides outgrow it

A pinned upstream skill stays verbatim while Repo Canon's rules override only
the instructions that break its workflow. When the overrides it needs would
restate most of its procedure, or would number more than two, Repo Canon forks
it: the skill becomes Repo Canon's own, credits its upstream, and leaves the
upstream pin. Verbatim pins kept each upstream snapshot a review rather than a
merge, as [ADR 0001](0001-manage-shared-skills-through-standards-releases.md)
decides, but each override is rule text that agents must reconcile with the
skill at run time, and Repo Canon's own `babysit` showed that a skill shaped
to the workflow can stay short. Two alternatives were rejected: forking every
overridden skill now, because three small overrides cost less than merging
each upstream snapshot by hand; and a patch layer over the upstream snapshot,
because it carries the merge cost of a fork without the clarity of owning the
skill.

## Consequences

- A fork is a decision backed by evidence, such as the overrides the skill has
  accumulated or a run that the upstream instruction broke, recorded in the
  change that makes it.
- A forked skill follows [ADR 0016](0016-keep-requirements-in-installed-rules.md)
  like any other: it is a method and states no requirement.
- Upstream updates to a forked skill reach adopters only when Repo Canon
  chooses to port them.
