# Make the validator's posted result the only contract decision

Repo Canon's issue-contract validator is the only program that decides what an
issue's implementation contract is and whether its readiness holds. It posts
that decision on the issue as its state line, which carries a format version,
the approval status, the Agent Brief revision and the readiness label event it
approves. The factory reads that posted result and parses no Markdown. It
checks the result against platform facts: the result's author is the trusted
account, the result approves the current readiness label event, and the Agent
Brief it names has not been edited since. The factory configuration names the
result's marker and its trusted author, so the factory still knows no Repo
Canon convention, as
[ADR 0014](0014-name-every-factory-convention-in-configuration.md) decides. The
factory still checks the reviewer's role itself, against its host
configuration, and keeps its own checks on link and edit times.

The validator and the factory had each interpreted the same comment format,
and by 2026-10-31 they disagreed on who may apply readiness, the ready label
names, whether an issue body edit cancels readiness, whether a removed
category label still requires an Agent Brief, and how a deleted Agent Brief is
detected. A disagreement showed as readiness the validator accepted and the
factory held, with no reason a reader could find. The owner chose, in the
grill of 2026-10-31, one interpreter, and one rule for each disagreement:
only an edit to the implementation contract cancels its readiness, only
current category labels count, readiness binds to one revision of one Agent
Brief, and a host may narrow the authorized roles but never widen them. Two
alternatives were rejected: one shared module that the factory copies from a
Repo Canon release, because the factory had imported Repo Canon's
issue-contract runtime before and ADR 0014 removed it so that the factory
works outside a Repo Canon adopter; and a written protocol implemented by both,
because two implementations drift, as these had.

## Consequences

- The factory deletes its own contract interpretation. Moving an identical copy
  elsewhere would not satisfy this decision.
- A missing or stale result holds the issue with a visible reason until the
  validator runs again. The readiness procedure already waits for the
  validator's notice before readiness is applied, so a current result is the
  normal state.
- The state line is a published format: a change to it is a format version
  change that the factory's reader accepts or refuses explicitly.
- The `triage` readiness command and the validator keep one interpretation
  inside Repo Canon.
- [ADR 0023](0023-reach-the-hosting-platform-through-postern.md) still keeps
  Postern factual.
