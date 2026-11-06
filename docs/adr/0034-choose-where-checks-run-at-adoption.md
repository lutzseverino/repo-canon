# Choose where checks run at adoption

An adopting repository chooses its check location when it adopts: `github`
(GitHub's hosted runners), `runner` (a machine the repository names, such as
its own server or the factory's host, posting each result as a commit status),
or `self-reported` (the authoring agent runs the checks and reports them in the
pull request, and the review run repeats them before merging). Every location
runs the same check command, and Repo Canon's merge tooling, not GitHub's
plan-gated branch rules, enforces the merge gate. The choice is part of the
Repository Standards selection, like the hosting platform, so it decides which
workflows install, and it replaces the `REPO_CANON_RUNS_ON` repository variable,
which agents could not see and which `ci.yml` ignored.

A private repository on a free plan, or on an account whose Actions billing
fails, otherwise has no working checks, readiness or standards updates: odonta
started no Actions job from 2026-11-03 and stayed on Repo Canon v0.17.0. The
owner decided in grill G2 of 2026-11-06 that adopters must not need to pay and
that skipping independent checks is a legitimate choice. Rejected: requiring
GitHub Actions, because private repositories are common and the payment is the
user's; keeping the runner variable, because it is invisible to agents and
still needs Actions; and choosing per check group now, because one repository
needs the choice today (recorded as a deferred seam).

## Consequences

- A self-reported check never needs owner approval to merge; the pull request
  says it is self-reported, and a designated owner review still applies.
- Readiness, pull request metadata, standards updates and the sandbox image
  must each work at every check location.
