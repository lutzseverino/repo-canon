# Name every factory convention in configuration

The factory knows no Repo Canon convention. A repository's factory
configuration names its labels, its model label prefix and its prompt, and
the factory has no default for any of them. The host configuration names the
repository roles whose readiness the factory accepts, and the factory checks
each readiness itself: its label's actor must hold one of those roles now, and
it must be newer than the issue body's last edit. Before this, the factory
hard-coded Repo Canon's labels and its `implement` skill, imported Repo Canon's
issue-contract runtime to recognise specifications, and relied on Repo Canon's
issue-contract workflow to remove readiness that an unauthorized user had
applied, so it worked safely only in a Repo Canon adopter. Two alternatives
were rejected: defaults matching Repo Canon, because a default is unstated
knowledge of another product; and authorized roles in the repository's
configuration, because agents merge into the default branch that holds it, and
who may spend the operator's subscriptions is the operator's policy.

## Consequences

- Repo Canon ships its factory configuration as an exact file, which states the
  factory configuration version it targets. The factory creates its own state
  labels from that configuration, and the repository owns its ready label.
- Readiness applied by a bot or GitHub App never dispatches an agent. Tickets an
  agent publishes wait for a person to apply readiness.
- The factory reads relationships from the issue tracker port, as
  [ADR 0023](0023-reach-the-hosting-platform-through-postern.md) clarifies without reversing configuration ownership.
  The adapter reads native links where offered, and `Parent` and `Blocked by`
  sections otherwise, with section names supplied by the consumer and no
  default. A specification is any issue with child issues; the factory core
  never parses an issue body.
- Agents tell the factory things through the hosting platform: comments,
  labels, pull requests, and the run's branch. The factory reads no file an
  agent writes.
