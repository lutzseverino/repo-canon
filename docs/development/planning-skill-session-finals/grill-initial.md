Created the durable [Intake batch public HTTP plan](/tmp/repo-canon-skill-exercises-11/planning/docs/planning/intake-batch-plan.md) and sharpened the [Parcel glossary](/tmp/repo-canon-skill-exercises-11/planning/CONTEXT.md).

Already answered: JSON-only input, ≤100 Parcel declarations, complete validation reporting, duplicate carrier references reject the whole Intake batch, atomic acceptance, preserved single-Parcel endpoint, unchanged auth/rate limits, no prototype, and a non-blocking later operator summary.

Resolved contradiction: “row errors” now means errors for each JSON Parcel declaration.

Still unresolved: HTTP route/schema/statuses, empty-batch rule, validation catalogue/error addressing, carrier-reference uniqueness scope/normalization, concurrency/idempotency, and the concrete auth/rate-limit contract. A local tracker spec and issues are also required before implementation eligibility.

Validated with `npm test` and `git diff --check`.

Committed:

`08b0d58 docs: add intake batch delivery plan`
