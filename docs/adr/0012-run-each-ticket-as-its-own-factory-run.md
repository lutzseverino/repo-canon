# Run each ticket of a specification as its own factory run

Status: its fixed `implement` prompt and `model:` label prefix are superseded
by [ADR 0014](0014-name-every-factory-convention-in-configuration.md), which
moves both into the repository's factory configuration; running each ticket as
its own run stands.

Every factory run is a direct run: one agent, started with only its provider's
invocation of `implement` and `#<n>`, takes one issue to one pull request. A
parent, a specification or any issue with native sub-issues, never runs. Its
readiness, applied after its latest ticket link, releases its tickets, and each
ticket runs on its own `model:` label, ordered by native blockers, and merges
into its base branch on its own with its checks passing. This supersedes the
run-mode selection in
[ADR 0011](0011-ship-the-factory-with-the-standard.md): `run:orchestrated` and
the `implement-spec` skill declaration are removed, as the
[ticket-by-ticket specification](https://github.com/lutzseverino/repo-canon/issues/327)
records. Two alternatives were rejected: one orchestrated run per
specification, because its orchestrator built every ticket with subagents of
its own provider, so a ticket's `model:` label could not choose its model and
the factory had to hold a parent whose tickets named different models
([#261](https://github.com/lutzseverino/repo-canon/issues/261)); and short
orchestrator turns that the factory starts between ticket workers, the option
recorded on #261, because it adds a second kind of run, state between turns,
and an integration branch to keep green.

## Consequences

- A ticket's `model:` label always chooses its model, and the factory no
  longer compares a parent's model with its tickets'.
- A specification arrives as one pull request per ticket, so review and
  rollback stay per ticket, and work that cannot keep the base branch green
  ticket by ticket becomes a single ticket.
- The vendored `implement-spec` skill stays in the pinned upstream snapshot but
  is no longer installed, and the canonical labels no longer include
  `run:orchestrated`. Label setup leaves an existing `run:orchestrated` label
  alone.
