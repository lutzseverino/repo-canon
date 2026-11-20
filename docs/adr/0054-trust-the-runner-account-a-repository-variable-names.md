# Trust the runner account a repository variable names

Status: accepted (2026-11-20); amends
[ADR 0034](0034-choose-where-checks-run-at-adoption.md): readiness at
`self-reported` stays with the owner.

At the `runner` check location, results count only when the runner's dedicated
account posted them. The repository names that account in the GitHub
repository variable `REPO_CANON_RUNNER_ACCOUNT`. The issue-contract validator,
the readiness command and merge read the variable through the API, and trust
`github-actions[bot]` when it is unset. The adopter sets the factory's trusted
contract-result author to the same account. At `self-reported`, nobody posts
contract results, so the owner applies readiness. Merge there requires
`PR metadata` and the review run's `Review rerun` status, which reruns the one
check command on the exact head.

The owner answered "yes to all" on 2026-11-19. That answer made the runner's
account the trusted author at `runner` and left readiness with the owner at
`self-reported`, knowingly narrowing ADR 0034's "Readiness ... must each work at
every check location". On 2026-11-20 the owner answered "I'll follow your rec
for rc908.", choosing a repository variable because it "adds no new file shape
and keeps 'keeps no runner registry'". The variable is read through the API,
so agents can see it, unlike the retired `REPO_CANON_RUNS_ON`, which only
workflows read.

## Considered options

- A Repo Canon-owned file naming the account: rejected, because it adds a new
  public file shape and a runner registry.
- Reading the factory's configured result author: rejected, because Repo Canon
  reads nothing Scriptorium owns
  ([ADR 0047](0047-read-nothing-scriptorium-owns.md)).
- Any account holding a readiness role: rejected, because an agent on such an
  account could post its own approval.
- Self-reported contract results under the worker's account: rejected, because
  the author and the reviewer can share one account.

## Consequences

- Setting the variable makes earlier `github-actions[bot]` results no longer
  the validator's own, so the next evaluation posts a fresh result.
- An unreadable variable fails closed and never falls back to
  `github-actions[bot]`.
