# Mission: Safe release-baseline decisions with Git ancestry

## Why

Maintain a release script that can decide whether a candidate release commit contains a required baseline. This makes releases safe without changing repository history or guessing from commit dates.

## Success looks like

- Choose the required baseline as the first argument and the candidate release commit as the second argument to `git merge-base --is-ancestor`.
- Treat exit status `0` as eligible, `1` as ineligible, and every other nonzero status as an operational error.
- Explain the decision using commit reachability rather than commit dates.

## Constraints

- First lesson takes under 15 minutes.
- Use official Git documentation and immediate retrieval feedback.
- Do not change history.

## Out of scope

- Rewriting, merging, rebasing, or otherwise changing Git history.
- General release-process design beyond the ancestry guard.
