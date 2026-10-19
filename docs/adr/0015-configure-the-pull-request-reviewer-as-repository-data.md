# Configure the pull request reviewer as repository data

A repository names its pull request reviewer in an optional data file,
`.github/pull-request-reviewer.json`, which gives the reviewer's account, its
exact request comment, how a finished review of a head looks, the replies
that mean it is unavailable, and the time bounds. Without the file, a pull
request merges once its checks pass and its threads are answered, with no
wait. `babysit` reads the file. Repo Canon ships none, and the factory never
reads it. The standard had hard-coded Codex, which is the owner's own setup:
its account, its summary comment, its reply wording and a request pattern that
counted mentions as requests. Every change in Codex's wording therefore became
a Repo Canon release (v0.9.1 to v0.9.4 changed only `babysit`), and an adopter
without Codex waited out bounds for a reviewer it never had. Two alternatives
were rejected: shipping a Codex preset with the standard, because it would
keep the owner's reviewer in every adopter; and reviewer code adapters,
because data covers the one reviewer that exists.

## Platform clarification

[ADR 0023](0023-reach-the-hosting-platform-through-postern.md) retains the optional repository-owned reviewer configuration
and the factory's independence from it. The `.github/` location and GitHub's
review states are the GitHub case; other platforms supply their own location
and review evidence through the platform adapter. Published files remain
GitHub-shaped until a second adapter exists.

## Consequences

- The owner's repositories each carry their own Codex file, outside the
  standard's declarations. A change in Codex's wording becomes an edit there,
  not a release.
- Only a comment whose whole body is the configured request counts as a
  request.
- The contribution guide's merge rule speaks of the configured reviewer and
  names no provider.
