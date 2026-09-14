## Standards

No documented-standard violations found. `npm test` passed under Node.js v24.21.0.

- **Judgement call — Mysterious Name** in `src/ledger.mjs`: `const x = entries.filter(entry => entry.state === 'posted');` uses an opaque variable name. Rename `x` to `postedEntries` or inline it.

No other baseline smells identified.

## Spec

- Missing/partial — “returns independent posted and pending totals”: `pending` is always `0`; pending Entries are never accumulated.

- Missing — “It rejects an Entry whose state is neither `posted` nor `pending`”: invalid states are silently filtered out rather than rejected.

- Missing tests — “Tests must cover both totals and the rejection behavior”: the sole test covers one posted Entry only.

- Scope creep: None identified.

- Implemented-but-wrong — “returns independent posted and pending totals”: the posted-only filter discards pending Entries and misreports their amounts.

Summary: Standards: 1 finding (worst: possible Mysterious Name). Spec: 4 findings (worst: pending totals and invalid-state rejection are unimplemented). No repository changes made.
