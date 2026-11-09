# Body contract protocol

This source interface supports [Scriptorium #148](https://github.com/lutzseverino/scriptorium/issues/148)
and the Seams consumer [#910](https://github.com/lutzseverino/repo-canon/issues/910).
[Activation #920](https://github.com/lutzseverino/repo-canon/issues/920) is blocked
by both source tickets and owns released/adopted/installed compatibility and
live pickup evidence. A source merge closes only #919, never activation.

## Preparation and activation

No configuration file means **prepared** mode. Installing this release leaves
comment selection, revision serialization, v1 results, notice barriers,
authority, `ready.mjs`, native contracts and workflow-state behavior intact.
No package version or installation date activates body mode. An unchanged
legacy source has no expiry date.

Before activation install a bridge host with a v1/v2 reader and both publication
routes. Freeze all new/revised triage publication, including manual posters,
retries and preserved results. Drain completed legacy publication or hold it
for fresh body triage. Include every open issue, including held and skipped
ones; do not filter inventory by factory eligibility. Ordinary implement/review
work retains its existing admission rules.

An authorized operator uses the installed command with the destination explicit:

```sh
node scripts/issue-contract-cutoff.mjs inspect --repo OWNER/REPO
node scripts/issue-contract-cutoff.mjs activate --repo OWNER/REPO \
  --release INSTALLED_TAG --sha INSTALLED_FULL_SHA --epoch UTC_TIMESTAMP \
  --publication-frozen
node scripts/issue-contract-cutoff.mjs inspect --repo OWNER/REPO --issue 123
node scripts/issue-contract-cutoff.mjs evaluate --repo OWNER/REPO --issue 123
```

`--publication-frozen` attests an operator-maintained freeze, not an automatic
host stop. The operator must have the repository's authorization to commit
activation configuration directly to its default branch; enforcement refusals
stand. Do not weaken branch rules to run this command. Repositories requiring
reviewed configuration changes keep publication frozen and deliver the same
verified receipt/configuration through their authorized route, re-reading the
complete inventory immediately before completing the switch.

`contractCutoffInventory(connection)` uses complete Postern issue/discussion
ports and exact GraphQL source-edit identities. `captureContractCutoff` compares
two complete inventories, and `installContractCutoff` checks again before receipt
commit and immediately before mode activation. Any difference or failed read
refuses activation. These functions are exported for controlled host/operator
adapters; they accept authenticated facts, never model-supplied proof.

The command creates the dedicated `repo-canon/issue-contracts` Git branch,
commits `cutoff.json`, initializes `issues/<number>.json` for every open issue,
and writes `.github/issue-contracts.json` on the default branch:

```json
{ "mode": "body", "cutoff": "<immutable full receipt commit SHA>" }
```

A dispatched evaluation carries only a positive issue number. The trusted
trigger re-fetches current issue facts and grants no authority to its sender.
It shares the issue's concurrency group with body, comment and label events.
The `evaluate` command can retry this request during recovery.

Body publication, v2 decisions and refusal of new comment contracts start
together through that configuration. Activation requests fresh evaluation of each
inventoried issue; inspect the resulting v2 decisions before lifting the freeze.
The trusted default-branch workflow reads
it locally; the bridge host uses `readContractSourceConfiguration(connection)`
to pin/read it from the destination, independently of its checkout. An explicit
`{"mode":"prepared"}` also selects preparation before activation.

## Durable trusted facts

The receipt format is `repo-canon/issue-contract-cutoff/v1`. It records repository,
installed release/full source SHA, activation epoch, `publicationFrozen: true`,
`complete: true`, and `issues`. Every inventory entry records issue node identity,
number, body edit identity, independently captured intake, and `legacy` or null.
A legacy entry contains the exact existing revision, published source, full edit
identity, opening eligibility and existing feedback notice/acceptance when
present. Inclusion never approves an unapproved contract. The full receipt
commit SHA is its identity; the receipt is read at that immutable commit.

The mutable ledger records each issue's cutoff identity, immutable intake
(original bytes, author, writer run or null, source edit), migration/retirement
booleans, cutoff body edit, latest durable validator notice, and host publication
proof when present. The publication record retains `noticedAt`, the actual
first publication time of its matching proof notice, separately from the body's
first revision notice. Rewrites never move either barrier; a ready event must
follow both applicable notices. Contents writes use file-SHA compare-and-swap. The adapter
persists migration/retirement before label or feedback writes, then retains the
published notice. Lost writes fail visibly; restarting cannot reset facts.

The repository controls ledger/configuration write access. Keep the ledger
branch across upgrades, releases and cleanup; restrict its writers to the
validator and authorized host/operator. The workflow needs `contents: write`
for this branch and `issues: write` for labels/feedback. Preparation performs
no ledger request/write. Ordinary issue text, copied markers, feedback authors
and agent results cannot write authenticated ledger facts.

A missing/incomplete/wrong-repository receipt, missing record, unreadable edit
history or lost proof holds the affected case with a recovery diagnostic. An
unrecorded new/reopened issue can capture its current intake, but gains no legacy
eligibility: its triage contract must be a body. Recover lost trusted records
from Git history; never reconstruct eligibility from current comments. A
partially prepared ledger before mode activation can be removed and recaptured
by its authorized operator under the freeze; after activation preserve the
receipt and records, repair forward, and never roll back to comment selection.

An eligible comment must keep its exact content revision and edit identity.
A new/replacement Brief, source edit or deletion retires it. Editing and restoring
identical bytes produces a different platform edit ID. A selected body Brief retires the old route; ordinary intake-context edits do
not change an otherwise unchanged legacy comment contract. Once a body Brief is selected,
`migrated` and `retired` remain true: newer comments, deleted feedback/body,
category removal/re-add and reopen cannot resurrect a comment. Original request
is the exact stored text at the body's end, once. A correctly preserved Original request is reused from its trusted intake record.
A heading in an already-replaced body alone is not historical proof: when that
record is missing, recover authenticated original intake or hold migration.
Factory writer proof is never recovered from preserved/model-supplied text.

## Host body publication

The host remains the publisher; the agent's credential remains read-only.
Use the following exported interfaces from `scripts/issue-contract-store.mjs`
and `scripts/issue-contract-sources.mjs`:

1. Read trusted mode and `loadContractSources(connection, number, configuration)`.
   Unknown/conflicting mode holds. In prepared mode keep the existing immutable
   legacy result comment; mutable reports never upsert it.
2. Before replacing intake, call `captureContractIntake`. It reads platform
   author/body/run facts and persists them independently. A factory-authored
   intake requires one known writer run different from this triage run.
   Unknown or same-run intake never gets factory authority. The optional final
   `writerProof` argument to `captureContractIntake(connection, number,
triageResult, facts, issue?, edits?, writerProof?)` comes from the host's
   independently retained issue-publication record, not Markdown or model text:
   `{repository, issue, run, sourceEdit:{id,editedAt}}`. It must match the preserved
   intake identity/edit. Cutoff capture records unknown writers as null; a host
   may fill that unknown once with matching authenticated proof, without
   changing original bytes, author or intake edit. A known writer cannot be
   replaced. Missing historical writer proof preserves person acceptance, not
   the factory exception. Optional issue/edit arguments are authenticated
   platform snapshots only. Existing stored original intake is immutable; a recovered Original request supplies no writer
   proof. Use `bodyWithOriginal(brief, original)` to append the exact original
   once after disclaimer, complete seven-field Brief, applicable Seams and notes.
3. Publish the body; refetch its exact validator revision/source. Publish a
   separate configured-author attestation comment, with exactly one configured
   run line and one payload line:

   ```markdown
   <!-- scriptorium:run {"run":"TRIAGE_RUN"} -->
   <!-- repo-canon:triage-attestation {"format":"repo-canon/triage-attestation/v1","repository":"OWNER/REPO","issue":"ISSUE_NODE_ID","run":"TRIAGE_RUN","outcome":"success","revision":"sha256:...","source":{"type":"issue-body","editedAt":"UTC_TIMESTAMP","editId":"EDIT_NODE_ID"},"intake":{"author":"ORIGINAL_AUTHOR","writerRun":null}} -->
   ```

   The configured author and marker still come from `factoryTriageResult` and
   `.factory/config.json`'s `triageResult`. The evidence is not a run report,
   even when both use the same configured marker name. Ordinary disclaimer
   framing may surround these lines; no contract Brief appears in attestation.

4. Call `recordContractPublication(connection, number, facts, triageResult,
{attestationId})`. It refetches body, evidence author/content and edit IDs,
   verifies the exact payload and intake, and stores immutable publication proof.
   Never edit evidence in place. Retry the same verified evidence or publish a
   new evidence comment for fresh acceptance. A changed body needs new proof.
   After persistence, this operation requests `repo-canon-issue-contract`
   repository dispatch, using the host's existing ledger Contents-write
   authority. It requests evaluation even on an idempotent retry. This closes
   the race where the attestation's workflow evaluated before proof persistence;
   a failed dispatch can be retried without changing evidence or readiness.
5. Wait for a matching current validator notice that includes the verified
   association; only then request readiness through the existing event. Wait
   for `approved` bound to that current ready event before implement admission.
   An intervening body/evidence edit cancels pending acceptance. The validator
   alone decides structure and authority; independent authorized-person review
   remains available when factory proof is absent.

## Exact v2 wire interface

The feedback marker/author remain `repo-canon:issue-contract-state` and
`github-actions[bot]`. The JSON line uses
`format: "repo-canon/issue-contract-state/v2"`. Preparation emits v1 unchanged.
The machine schema is [issue-contract-v2.schema.json](../../test/fixtures/issue-contract-v2.schema.json);
shared positive/negative platform snapshots and literal decisions are
[issue-contract-v2.json](../../test/fixtures/issue-contract-v2.json).

V2 retains every v1 field and its meaning: `status`, `kind`, `revision`, `source`,
`label`, `reviewer`, `reviewEventId`, `event`, `evaluatedAt`, `observedEventId`,
`sourceInvalidation`, `publishedAt`, `rejectionReason`, `rejectedCreationLabel`.
Absent values are null. Body Brief revisions retain revision serialization v1
and add `editId` to the hashed body source (after `editedAt`); the body source
includes issue node `id` internally. Its public source omits issue node `id`.
Native body and eligible legacy comment revisions keep their existing bytes.
Legacy public sources retain comment ID/edit time exactly.

V2 adds:

- `selection`: `{mode:"body", cutoff:{id,release,sha,epoch}|null,
state:"eligible"|"migrated"|"held"|"native", reason:string|null}`.
  `id` is the full receipt commit. `eligible` selects the unchanged comment;
  `migrated` selects the body; `native` retains native contracts/intake;
  `held` refuses selection and names recovery. A held result can expose a
  missing cutoff as null. This is diagnostic state, never approval.
- `factoryTriage`: null, or `{run,revision,source,attestation:{id,revision,
edit:{id,editedAt}},intake:{author,writerRun}}`. The association binds the
  same selected body revision/source to successful independent triage and
  exact configured-author evidence. Attestation `revision` is SHA-256 of its
  complete UTF-8 body; its edit ID is the platform edit node (or
  `created:<comment node ID>` for an unedited comment). No proof grants
  acceptance independently of `status:"approved"` for the current label event.
  Eligible legacy factory authorization retains its existing comment proof;
  `factoryTriage` is null for that route.
- `observation`: SHA-256 of the canonical platform-fact serialization owned by
  `issueContractObservation`. It includes issue identity/body/edit, sorted
  carried labels, all non-feedback comments ordered by numeric ID (body,
  author, update time and exact edit identity), and latest observed readiness
  transition. Only marked feedback by the validator is excluded. Mutable
  reports and selected evidence have no freshness exemption. The adapter
  includes its successful label writes in the observation. Use
  `readIssueContractObservation(connection, issue, comments, events)` to check
  it without parsing contract Markdown. Relevant edits/deletions, including
  same-second restoration, must be evaluated before a result is current.

Readers reject unknown formats and malformed v2, stale observations, wrong
source/edit/revision or absent current-event approval. The bridge verifies
referenced platform evidence and configured identity against the published
association; it does not reparse a contract or independently grant factory
readiness. `issueContractResult`, `decideIssueContract`, notice/ready-event
semantics and the bundled `ready.mjs` remain the single authority. A same-second
notice/acceptance is still refused; every new body revision requires a new
notice and fresh applicable acceptance. A proof edit/deletion/replacement
requires a matching evaluated association and fresh applicable acceptance.

The historical edited-comment defect #866 remains separately tracked. This
source adds no live rollout, mass migration, new roles, timeout, expiry,
run-kind policy or deployment claim.
