# Engineering skill runtime transcript

This index contains curated excerpts from the authoritative runtime sessions
for issue #12. The [session-finals directory](engineering-skill-session-finals/)
preserves every complete final response. The SHA-256 beside each response
hashes its exact original UTF-8 file. Routine tool output, system instructions,
and prompts are excluded; this is a curated transcript, not the complete Codex
JSONL event stream.

## `ask-matt`

Session: `01a0a19a-0387-7151-b78f-0d644f6ef0fa`
Final-response SHA-256: `affb22ce06ab271f5da343fd817416fda2e1756823497bcf230480db1a4c32f4`

> Route: `/diagnosing-bugs` → `/implement` (driving `/tdd`) → `/code-review`.
>
> Start with `/diagnosing-bugs`: this is an intermittent regression with no
> trusted cause. Establish one reliably failing reproduction before
> theorising, then carry its regression test and confirmed cause forward.
>
> Before implementation, ensure the bug has an agreed issue/acceptance
> criteria; use `/triage` only if this maintainer report is still raw intake.
> At the diagnosis → implementation boundary, **continue in the same
> session**: implementation needs the diagnostic reasoning as a primary
> source, so no `/handoff`, `/clear`, or compaction is warranted.
>
> `/implement` makes the fix test-first and then hands the resulting diff to
> `/code-review` before committing/shipping. The pinned review flow requires a
> fixed comparison point and the bug issue/spec; it runs separate Standards
> and Spec reviews in parallel, reports both axes independently, and any
> findings return to implementation before shipping.
>
> `/setup-matt-pocock-skills` remains a prerequisite if it has not already
> been run. No repository changes were made.

## `code-review`

Session: `01a0a19a-034c-7f13-8b1a-cfa19352cace`
Final-response SHA-256: `908817977126bd92afa09ecd4f923e9bd10ba3d4e24e9a8ebeeb8757dc041a2f`

> **Standards**
>
> No documented-standard violations found. `npm test` passed under Node.js
> v24.21.0.
>
> - **Judgement call — Mysterious Name** in `src/ledger.mjs`: `const x =
>   entries.filter(entry => entry.state === 'posted');` uses an opaque variable
>   name. Rename `x` to `postedEntries` or inline it.
>
> No other baseline smells identified.
>
> **Spec**
>
> - Missing/partial — “returns independent posted and pending totals”:
>   `pending` is always `0`; pending Entries are never accumulated.
> - Missing — “It rejects an Entry whose state is neither `posted` nor
>   `pending`”: invalid states are silently filtered out rather than rejected.
> - Missing tests — “Tests must cover both totals and the rejection behavior”:
>   the sole test covers one posted Entry only.
> - Scope creep: None identified.
> - Implemented-but-wrong — “returns independent posted and pending totals”:
>   the posted-only filter discards pending Entries and misreports their
>   amounts.
>
> Summary: Standards: 1 finding (worst: possible Mysterious Name). Spec: 4
> findings (worst: pending totals and invalid-state rejection are
> unimplemented). No repository changes made.

## `codebase-design`

Session: `01a0a19a-03af-7d03-94df-418c28d1eddb`
Final-response SHA-256: `123ba90739a352631794da1335f465635509a725ebafe840cfc9fa8bd451b811`

The complete response is identified by the digest above. This excerpt retains
all three interfaces, the recommendation, and the observed decision gap:

> I explored three independent designs for the Order intake cluster; no
> repository files changed.
>
> 1. Minimal interface: `acceptOrder(submittedJsonText) -> Order`. Parsing,
>    reference validation, and currency canonicalization stay behind it.
> 2. Flexibility-first catalog:
>    `createOrderIntake({ preparations, defaultPreparation }).accept(...)`.
>    This gains leverage only if multiple concrete Order forms become real.
> 3. Common-caller-first interface: `fulfill(acceptOrder(submittedJsonText))`.
>    Fulfillment stays outside Order intake while its dominant caller remains
>    simple.
>
> My recommendation is the minimal/common-caller hybrid: retain a single
> synchronous `acceptOrder(submittedJsonText)` interface, document its ordering
> and error modes, and keep parsing, validation, and canonicalization private.
> Defer the preparation catalog until a second concrete Order form proves that
> seam necessary.
>
> One decision-to-implementation gap surfaced: ADR 0001 requires uppercase ISO
> currency codes, but current behavior only uppercases whatever string is
> supplied; it does not validate ISO membership. That should remain unchanged
> unless separately agreed as a behavior change.

## `improve-codebase-architecture`

Session: `01a0a19a-03c7-7441-aa74-5dc8824458be`
Final-response SHA-256: `af0f42b5b0106284d76e05f2343e6b10a4df2bcfbe0389214250228ff3ae53b3`

> Created the fresh visual report:
> `/tmp/architecture-review-20260914T202737Z.html`.
>
> Top recommendation: deepen the Order intake module at the `acceptOrder`
> seam. The report includes two before/after visual candidates and respects
> ADR-0001.
>
> The repository remains unchanged. I attempted to open the report, but
> `xdg-open` is unavailable in this environment.

Browser verification session: `01a0a1b9-7aa0-72e1-b545-b1e8b3cbc9ed`

Browser-verification final SHA-256:
`df7436aad5e6fe039e86754cb6b284e5dd743490b74ca6beaad0c2b83a7a6048`

> Verification is blocked by Chromium sandbox startup in this environment.
> The requested Playwright CLI command and DOM checker both failed before page
> load with “Operation not permitted.” Static inspection found two articles,
> four figures, and one Mermaid source block. The repository remained clean.

Browser completion session: `01a0a1ba-a291-73d3-b735-efe1ab5044a9`

Browser-completion final SHA-256:
`35bf06e325a163000ec8e30b7067a867856412d259ecfcb71914083ca4f1f362`

> Verification passed. The 9,852-byte HTML has SHA-256 `bc78f65f…`, and the
> 375,968-byte verified PNG has SHA-256 `c1cce255…`. One Mermaid SVG rendered;
> the Candidate 01 visual grid ended before its details began, so the measured
> no-overlap result was true. The repository remained clean. Operator visual
> inspection was recorded separately in the
> [visual-inspection record](engineering-skill-architecture-visual-inspection.md).

## `diagnosing-bugs`

Initial session: `01a0a19d-193a-75e2-85cf-9538607448d5`

Initial final SHA-256: `c7f528f9566b01d3123fa55a5427cafb1dc84c46210591f9a74fdd270b067502`

Completion session: `01a0a19f-e2ce-7022-91b2-833c95133fdd`
Completion final SHA-256: `e8001652ef0846379911210bfa28200492e90b6adbde38bb66042ff213016600`

> Fixed the Invoice-line mutation in `src/invoice.mjs`: rendering now sorts a
> copied array, preserving the public `renderInvoice(lines)` seam and ADR.
>
> Confirmed cause: in-place `Array.sort()` reordered the caller’s Invoice
> lines.
>
> Validation passed: focused red-capable reproduction, `npm test`, no debug
> instrumentation, and `git diff --check`.
>
> Commit could not be created because this environment mounts `.git` read-only
> (`index.lock: Read-only file system`).

Completion:

> Committed locally: `4c83243 fix(invoice): avoid in-place sort that reorders
> caller lines`. The public reproduction and `npm test` pass, no debug
> instrumentation remains, and the working tree is clean.

## `domain-modeling`

Session: `01a0a19d-1971-7273-b0a3-8a70e7c6839a`
Final-response SHA-256: `2fb84e679b6577d0f5a3a4f5abd688aae0295747751bfcb1444c9cc8313d7644`

> Updated `CONTEXT.md` as a glossary only:
>
> - **Authentication Identity** — externally owned, represented by stable
>   subject ID.
> - **Billing Party** — person or organization legally and financially
>   responsible for a subscription.
>
> This matches the Subscription code’s separate `subject` and `legalName`
> values and ADR 0001’s external-authentication boundary. No new ADR is
> warranted: this records existing terminology rather than a new,
> hard-to-reverse trade-off or architectural decision.
>
> Validation passed with Node 24: `npm test` (1/1 passing). No implementation
> behavior changed.

## `research`

Session: `01a0a19f-1a83-7950-8c6a-87d6db4e25de`
Final-response SHA-256: `846a90b8563797dd51fbcd2bf124e013c372e84baedd75c6a39e7385d30cebd1`

> Created `docs/development/git-ancestry-research.md` with official Git
> documentation citations for every finding.
>
> Validated with `git diff --check`. Only the requested file was added; the
> pre-existing `CONTEXT.md` change remains untouched.

## `resolving-merge-conflicts`

Initial session: `01a0a19d-19d3-7260-ba87-9ca79ec51e23`

Initial final SHA-256: `900c7a2067695706c92ce58215a7fa447702d334ad368b5536d6dc71b6657c6e`

Completion session: `01a0a19f-e308-75e1-9a4e-7eedde735731`
Completion final SHA-256: `3ca78fb4402ecf58a56161738c4235a72da97c3968d254cee785b621c3f45bca`

> Resolved the conflict in `src/order-intake.mjs`, preserving both accepted
> requirements. `npm test` passes (3/3).
>
> I could not stage or commit: this session mounts `.git` read-only, and `git
> add` fails creating `.git/index.lock`. The merge remains in progress with
> the resolved file unstaged.

Completion:

> Completed the local merge as `c983c23` (`Merge branch
> 'reference-normalization'`). The resolution trims and rejects empty Order
> references and lowercases and allowlists Order statuses. `npm test` passes
> 5/5, `git diff --check` is clean, and the repository is no longer in a merge.
> Nothing was published.

## `tdd`

Initial session: `01a0a19d-199a-7373-a8c5-0db527abc4f6`

Initial final SHA-256: `6596ada3ad9551856bb756ee78929bb893f831d247a2a6b04ac7e9ef1e9fef8b`

Completion session: `01a0a19f-e2f1-7721-8758-cc6a74a2ef9e`
Completion final SHA-256: `655c75b92dcc7c14647a9305e7dac4e7aa9d310ee60bfa0979903d6618c4b9ac`

> Implemented Invoice reference formatting and invalid-sequence rejection.
>
> - Added public-seam tests for formatting, zero, negative, and fractional
>   sequences.
> - `npm test` passes.
> - `git diff --check` passes.
>
> I could not create the requested commit: `.git` is mounted read-only, so Git
> cannot create `.git/index.lock`. Intended commit: `feat(invoice): format
> Invoice references`.

Completion:

> Implemented and committed Invoice reference formatting as `55b1590
> feat(invoice): format Invoice references`. The focused test, `npm test`, and
> `git diff --check` validated successfully. The working tree is clean.
