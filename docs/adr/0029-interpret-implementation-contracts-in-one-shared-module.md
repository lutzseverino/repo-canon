# Interpret implementation contracts in one shared module

Repo Canon owns one issue-contract module that decides, from the issue facts
Postern returns and a policy, what an issue's implementation contract is,
whether its readiness holds, and whether a parent's readiness releases its
tickets after their links. The policy carries the values each caller sets: the
authorized roles and the label names. Repo Canon's issue-contract validator
and the `triage` readiness command use the module, and the factory copies it
from a Repo Canon release, as Repo Canon copies Postern. The comment markers
carry a format version, so one module reads the comments of every adopting
repository's version. Everything about running work, such as pickup, models,
capacity, merges and blocker holds, stays in the factory.

The validator and the factory had each implemented the same comment format,
and by 2026-10-31 they disagreed on who may apply readiness, the ready label
names, whether an issue body edit cancels readiness, whether a removed
category label still requires an Agent Brief, and how a deleted Agent Brief is
detected. A disagreement showed as readiness the validator accepted and the
factory held, with no reason a reader could find. The owner chose one module
in the grill of 2026-10-31, together with one rule for each disagreement:
the roles are a policy input that a host may only narrow, the label names are
a policy input, only an edit to the implementation contract cancels its
readiness, only current category labels count, and readiness binds to one
revision of one Agent Brief. Two alternatives were rejected: a written
protocol with shared test examples, because two implementations drift as
these had; and the factory running each served repository's installed
validator, because the factory host would execute repository files.

## Consequences

- The factory deletes its own contract interpretation; moving an identical
  copy elsewhere would not satisfy this decision.
- A host that narrows the authorized roles refuses with a visible hold that
  names the role, which is the one difference between the two callers that
  remains, and it is stated.
- Shared test examples exercise edited, deleted and newer Agent Briefs, bot
  authors, simultaneous events and parent link changes through the module.
- [ADR 0023](0023-reach-the-hosting-platform-through-postern.md) still keeps
  Postern factual: the module interprets the facts, and Postern only reports
  them.
