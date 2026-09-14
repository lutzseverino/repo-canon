Completed the local merge as `c983c23` (`Merge branch 'reference-normalization'`).

The resolution preserves both accepted requests:
- trims and rejects empty Order references
- lowercases and allowlists Order statuses

Validation passed:
- `npm test` — 5/5 passing on Node 24
- `git diff --check` — clean

Repository is no longer in a merge and has a clean working tree. Nothing was published.
