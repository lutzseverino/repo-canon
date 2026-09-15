Published and committed the two approved local tickets:

- [01: Accept Intake batches through the public endpoint](/tmp/repo-canon-skill-exercises-11/planning/.scratch/intake-batches/issues/01-accept-intake-batches-through-the-public-endpoint.md)
- [02: Commit Intake batches atomically under data-store conflicts](/tmp/repo-canon-skill-exercises-11/planning/.scratch/intake-batches/issues/02-commit-intake-batches-atomically-under-data-store-conflicts.md)

Both are `ready-for-agent`. The implementation frontier is ticket 01; ticket 02 is blocked by ticket 01 and remains implementation-ineligible until it closes. No operator-summary ticket was created. The spec is unchanged.

Validated with `git diff --check` and `npm test` (passes; no tests defined). Committed as:

`373c1e1 docs: add intake batch implementation tickets`
