# Update a non-overlapping stale base within the attempt

Status: accepted (2026-11-15).

A delivery attempt's first branch update stays unconditional. When the base is
stale again after it and the advance is not an overlapping advance, meaning
its commits change none of the pull request's paths and the pull request's head
merges cleanly onto it, the attempt updates again, at most two further times.
A further update whose stable patch identity is unchanged repeats only the
required checks; any other replacement head also repeats review. An
overlapping advance, or a stale base after the last update, still ends in the
owner handoff with its reason. A script decides overlap and patch identity,
with tests, rather than a reading of the rule.

On 2026-11-14 two reviewed pull requests with passing checks stopped for the
owner because the base moved again, with commits touching none of their files,
after the attempt's one update. The owner agreed on 2026-11-15 ("Agreed to
all"). Freshness itself is unchanged: checks still pass against the current
default branch, as the owner decided on 2026-10-27.

## Considered options

- End the attempt as retryable and leave the next update to a later attempt:
  rejected, because no bound holds across attempts, and because a later
  attempt would rely on how Scriptorium relaunches
  ([ADR 0047](0047-read-nothing-scriptorium-owns.md)).
- Count either changed paths or a clean merge alone as no overlap: rejected,
  because an advance that touches the pull request's files but merges cleanly
  still changes what was reviewed.
- Repeat review on every further update: rejected for an unchanged patch,
  because it adds a full review round that can find nothing new.
