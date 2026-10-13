# Install only workflow skills

Repo Canon installs a skill only when it is a workflow skill: its output lands
in the repository or the issue tracker, or the rules, a check, or another
workflow skill rely on it. Personal skills, whose output serves the person
using them, such as `teach` and `to-questionnaire`, are left to each person to
install from upstream, and Repo Canon stops vendoring them. Skills that only
set up or route the others, `setup-matt-pocock-skills`, `ask-matt` and
`grill-me`, are dropped as well. Repo Canon had installed every regular
upstream skill but `implement-spec`, so each adopting repository carried
methods that its workflow never used, every agent session loaded their
descriptions, and their routes to uninstalled skills needed overrides in
`CONTRIBUTING.md`. Two alternatives were rejected: keeping every skill at
repository scope, because the factory's runs and the shared workflow need only
the workflow skills; and an optional-skills mechanism in Repository Standards,
because people already install their own skills without one.

## Consequences

- The criterion is checked against the skills' text: a workflow skill that
  calls another skill makes that skill a workflow skill, as `wayfinder` does
  for `prototype` and `research`.
- Repo Canon's usage documentation names the personal skills it recommends and
  how to install them for oneself.
- The managed upstream set shrinks, and so does each upstream snapshot review
  under [ADR 0001](0001-manage-shared-skills-through-standards-releases.md).
- Removing installed skills is a breaking standards change. It ships in the
  same breaking release as the profile split of
  [ADR 0017](0017-make-the-factory-an-optional-profile.md), so adopters cross
  one breaking change rather than two.
