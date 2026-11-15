# Answer a stop by applying the issue's next state

Status: accepted (2026-11-15).

A person answers a factory stop, whatever its run kind, by applying the state
the issue should move to. They apply `state:ready` to resume work whose
contract the answer left unchanged, `state:triage` to have it triaged again,
`state:carried` when another record carries it, or close it. The one-state
rule already replaces the stop with the applied state, and a person's label
already carries the authority readiness and triage need, so the answer adds no
mechanism. A comment alone starts nothing. The factory's stop names the exact
state to apply. A `state:grill` stop returns only through its grill.

The owner agreed on 2026-11-15 ("Agreed to all"), after a count of 43 factory
stops in which every return needed readiness re-applied by hand, and the goal
"Yes let's fix this up with priority so the factory can resume normally"
(2026-11-14). The owner asked on 2026-11-15 for a design that is "predictable
for agents, also, less paths is better so agents don't have to navigate
parallel designs all the time."

## Considered options

- Any new comment from an authorized account: rejected, because it also
  catches evidence comments and "hold" answers, and reads issue prose as
  authority.
- Removing the stop label, with the issue-contract validator restoring
  readiness at an unchanged contract: rejected, because the validator's label
  is a bot's, which readiness never accepts, because knowing which stop is the
  factory's would read Scriptorium's configuration
  ([ADR 0047](0047-read-nothing-scriptorium-owns.md)), and because the result
  would depend on the order of label events.
- A machine marker in a comment: rejected, because it adds a public name for
  what a label already says.

## Consequences

- The issue-contract validator keeps its label writes. Whether it should post
  verdicts and write no labels is a separate request, decided on its own.
