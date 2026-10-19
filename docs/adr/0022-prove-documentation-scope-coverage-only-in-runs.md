# Prove documentation scope coverage only in runs

The documentation check proves scope membership only in adoption and update
runs. When the operation request's `invocation` is exactly `"check"`, it reports no scope coverage rule violation and no
correction to include the development guide or a root index in the confirmed
documentation scope. A missing field or any other value keeps today's strict
behavior, so older Repository Standards CLIs are unaffected. Every other
correction applies in both cases: the other three documentation rules, missing
or empty indexes, stray entries, broken links, and the entry document language
rule.

A confirmed scope can name only individual files: Repository Standards
materializes it as exact paths and this check rejects directory targets. It
changes only through a new adoption or update run
(Repository Standards ADR 0009),
yet `repo-standards check` passes each check the same request as a run. Every
document added after adoption therefore failed scope coverage, and the only
remedy was a whole update run and its own adoption pull request after the
document's pull request merged, which left the development guide's required
check failing in between. Three alternatives were rejected: dropping the
rule, which contradicts [ADR 0009](0009-enforce-documentation-rules-as-checks.md)'s
aim that scope coverage is proven, not asserted; directory scopes, which
Repository Standards declines to have; and amending the scope between runs.

## Consequences

- This supersedes [ADR 0009](0009-enforce-documentation-rules-as-checks.md) in
  part: scope coverage is no longer an every-invocation check.
- Between runs the confirmed scope is frozen. A pull request that adds a
  document is reviewed for its index and links, and the next update run's draft
  brings the document into scope.
- The check takes effect for an adopter once its Repository Standards CLI sends
  the `invocation` field; this is a patch-level fix and the minimum CLI is
  unchanged.
- The documentation model still computes each member's scope, root inference
  still reads the confirmed paths, and the drafter and its discovery guidance
  are unchanged.
