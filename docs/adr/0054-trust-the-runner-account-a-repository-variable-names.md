# Trust the runner account a repository variable names

Status: accepted (2026-11-20); amends
[ADR 0034](0034-choose-where-checks-run-at-adoption.md): readiness at
`self-reported` stays with the owner.

At the `runner` check location, results count only when the runner's dedicated
account posted them. The repository names that account in the GitHub
repository variable `REPO_CANON_RUNNER_ACCOUNT`. The readiness command and
merge read the variable through the API, and trust `github-actions[bot]` when it
is unset. The issue-contract validator never reads it: it treats the account it
runs as, its acting login, as the author of its own results. That is
`github-actions[bot]` on Actions and the runner's account off Actions. The
adopter sets the factory's trusted contract-result author to the same account.
At `self-reported`, nobody posts contract results, so the owner applies
readiness. Merge there requires `PR metadata` and the review run's
`Review rerun` status, which reruns the one check command on the exact head.

The owner answered "yes to all" on 2026-11-19. That answer made the runner's
account the trusted author at `runner` and left readiness with the owner at
`self-reported`, knowingly narrowing ADR 0034's "Readiness ... must each work at
every check location". On 2026-11-20 the owner answered "I'll follow your rec
for rc908.", choosing a repository variable because it "adds no new file shape
and keeps 'keeps no runner registry'". The variable is read through the API,
so agents can see it, unlike the retired `REPO_CANON_RUNS_ON`, which only
workflows read.

The Actions token cannot read repository variables through the API. On
2026-11-20 the owner therefore answered the triage grill on #1226 by accepting
the recommendation: "On all the other stuff, I'll follow your recommendation."
The validator trusts its acting login and never reads the variable. Only the
readiness command and merge read it. When either cannot, it trusts no account
beyond `github-actions[bot]`: "This can only refuse, never admit." No installed
workflow changes.

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
- Passing the variable to the validator from the issue-contract workflow:
  rejected, because every adopter's installed workflow would change.
- Giving the issue-contract workflow a credential that can read the variable:
  rejected, because every adopter at `github` would need a new secret or App.

## Consequences

- At `runner`, earlier `github-actions[bot]` results no longer count, and the
  validator, running as the runner's account, posts a fresh result.
- A worker that runs the validator under its own token gets results the
  validator treats as its own, but no reader counts them unless the variable
  names that worker.
- When the readiness command or merge cannot read the variable, HTTP 403
  included, it trusts no account beyond `github-actions[bot]`. At `github`
  nothing changes. At `runner` the runner's results do not count, and the
  refusal names the missing "Variables: read" permission on the caller's
  credential.
- Whoever runs readiness and merge at `runner` needs "Variables: read". No App
  gains a new permission for `github`.
