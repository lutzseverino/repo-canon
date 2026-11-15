# Carry a request whose fate a record settles

Status: accepted (2026-11-15).

A triage run that finds a record settling a request's fate, such as the change
that already implemented it, the issue it duplicates, a rejection it repeats
without a new argument, or the ticket whose pull request closes it, asks for
`state:carried` and cites that carrier. No one is mentioned. The orchestrating
agent closes a carried request whose carrier is done, under its existing power
to close issues verified as done
([ADR 0041](0041-answer-in-the-owners-place-except-reserved-decisions.md)); a
request carried by open work stays carried until that work's pull request
closes it. A disposition no record settles, and a rejected request that brings
a new argument, stay with the owner.

Four triage runs on 2026-11-14 stopped for the owner only to ask whether to
close or hold requests whose records already answered it, because the
factory-workflow rules reserved closing a request already implemented or
rejected to the owner. The owner agreed on 2026-11-15 ("Agreed to all").

## Considered options

- Keep `state:owner` and let the orchestrating agent answer: rejected, because
  the owner is still mentioned, and the issue waits in a state defined as the
  owner's.
- The factory closes from its run result: rejected, because closing would move
  from the orchestrating agent into the factory on an agent's judgement that
  code cannot check.

## Consequences

- One state also gives a request carried by another ticket, which had none, a
  place to wait.
- Removing `state:carried` starts nothing.
- A factory that serves the repository treats the configured carried label as
  a stop that mentions nobody, in its own project.
