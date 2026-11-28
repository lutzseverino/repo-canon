# Issue contract verdict v5 and Canon run identity

This document publishes a standalone protocol for downstream readers. It does
not activate v5: the validator still emits and reads its existing v1–v4 formats,
and existing account and run-marker configuration still applies. A downstream
reader pins the merged commit containing this document,
[the machine schema](../../test/fixtures/issue-contract-v5.schema.json) and
[the literal examples](../../test/fixtures/issue-contract-v5.json), recording
that commit and each copied file's path. Reading these definitions requires no
Canon release or adoption. Emission belongs to
[issue #1251](https://github.com/lutzseverino/repo-canon/issues/1251); account and
run-line consumption belongs to
[issue #1253](https://github.com/lutzseverino/repo-canon/issues/1253).

The public names proposed here need independent review and explicit owner
approval of the publishing PR's current head before merge, renewed after every
head change. This is the designation in
[issue #1263](https://github.com/lutzseverino/repo-canon/issues/1263), under the
owner's 2026-11-26 clarification of the 2026-11-25 delegation. Publication and
pinning follow that review, rather than approving the names by writing them.

## Envelope and source identity

A verdict uses the existing marker, as one complete physical line:

```text
<!-- repo-canon:issue-contract-state {"format":"repo-canon/issue-contract-state/v5",...} -->
```

The ellipsis above abbreviates the envelope; the fixture file contains complete
JSON lines. Feedback comment identification and authenticated verdict-author
trust remain separate from its JSON. Copying a marker grants no authority.
Readers reject unknown formats, malformed JSON and schema-invalid results;
v5 never embeds or depends on a `baseFormat` result. All fields below are
required, using null where the schema permits an absent fact.

| Field            | Meaning                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `format`         | Exactly `repo-canon/issue-contract-state/v5`.                                                                                              |
| `contract`       | Selected contract's `kind`, `revision`, `source`, structural `status`, first `publishedAt`, `rejectionReason` and `rejectedCreationLabel`. |
| `grant`          | The validator's grant judgment and exact application association, described below.                                                         |
| `selection`      | Null in prepared mode; the complete body-mode selection record otherwise.                                                                  |
| `observation`    | Digest of observed platform facts plus their exact body/comment edit identities.                                                           |
| `observedStops`  | Stops present at evaluation, informational only.                                                                                           |
| `factoryTriage`  | Null or the existing exact-body publication/writer association.                                                                            |
| `factoryReview`  | Null or the existing independent factory-review association.                                                                               |
| `seamsExemption` | Null or the complete original historical Seams approval.                                                                                   |
| `evaluation`     | Triggering `event`, `evaluatedAt`, latest `observedEventId`, and persistent `sourceInvalidation`.                                          |

`contract.status` is `valid`, `invalid` or `absent`, distinguishing a selected
valid contract from structure/selection failure and no selected contract. It
never grants readiness. `kind` retains the validator's contract-kind string.
A held body selector can report invalid selection without claiming a current
revision/source. The first notice time belongs to the revision and must not
move on republication. Rejected creation-label and rejection diagnostics retain
the v1–v4 facts even when there is no grant.

A current source is `{type,id,edit:{id,editedAt}}`. Type is `issue-body` or
`comment`; the source ID is the issue node ID for a body and decimal REST comment
ID for a comment. `edit.id` is the platform edit node identity, or
`created:<platform node ID>` for a source with no edits; `editedAt` is a UTC
instant or null. An unavailable edit identity cannot support a current grant.
Timestamps alone cannot distinguish same-second edit-and-restore.

Revision values retain the existing `sha256:` revision serialization described
in the [body protocol](issue-contract-v2.md#exact-v2-wire-interface). The
revision's internal source uses the platform node ID; the public comment source
uses the REST ID. V5's additional exact edit identity does not retroactively
rewrite old revision hashes or historical proof. A current grant must match
both the selected revision and its complete public source/edit identity.
Selection is by content and authenticated source facts, never category labels.
The envelope reports the selected source; readers do not parse Markdown or
choose a competing source. This protocol does not change the selector or the
body-mode cutoff.

## Grant lifetime and live eligibility

`grant` has `status`, `grantor`, `revision`, `source`, `application`,
`attestation`, `endedBy` and `reason`. An application is
`{id,label:"state:ready",actor,at}`: its ID names the latest readiness
application in the issue timeline, including the existing authenticated
creation application representation. The grantor is the authenticated account
whose authorized application grants readiness. An attestation reference, when
used, retains its comment ID, complete-content revision and exact edit identity;
it supplements the application and never replaces it.

| `grant.status` | Meaning                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| `current`      | Authorized grant for this exact revision/source and latest application, with no ending event. |
| `absent`       | No grant and no grant association; association fields are null.                               |
| `refused`      | The observed readiness application did not establish a grant; `reason` explains why.          |
| `stale`        | A prior grant ended at its selected source's first change.                                    |
| `withdrawn`    | A prior grant ended when readiness was removed.                                               |

`endedBy` is null until termination, then `{kind,id,at}` with kind
`source-changed` or `ready-removed`, naming the first terminating source edit,
selection/deletion event or label-removal event. Preserve that identity on
restoration and republication. `evaluation.sourceInvalidation` retains the
existing invalidation identity as well; it is not a new grant. A subsequent
application can establish a new grant, never revive the previous one. An
unauthorized new application is refused even if an older application was
approved. Repeating a gesture while its same application/grant remains current
is a no-op.

The validator alone judges grant authority: a person with admin, maintain or
triage, or the declared factory through its own unedited brief or an independent
exact-revision review attestation. Existing revision-notice and writer-separation
proofs remain required. Remote readers check factual associations and freshness;
they do not re-check roles, configuration authority or contract structure.

Effective readiness requires all of the following:

1. The live issue carries `state:ready`.
2. The verdict has a current grant matching the latest live ready application,
   the selected revision/source/edit and the current source observation.
3. No live stop label is present: `state:triage`, `state:owner`, `state:grill`,
   `state:reporter`, `state:carried` or `wontfix`.

Every listed stop excludes readiness regardless of label order. Readers apply
stops from live labels; `observedStops` cannot override them. Adding a stop,
answering it, unrelated relabeling and republication preserve a still-current
grant. They may require a fresh observation but never new grant authority.
Removing ready withdraws its grant; re-application names a new application.
Selected-source edit, replacement, deletion or selection change permanently
ends the old grant. Restoration of identical content cannot resurrect it.
A deletion's fallback source starts ungranted. Other parent, execution, review
and merge gates remain separate from effective readiness.

## Observation and freshness

`observation` is `{digest,bodyEdit,commentEdits}`; comment edits are
`{id,edit}` entries in ascending numeric REST comment-ID order. Its digest uses
the existing `issueContractObservation` canonical serialization, without a new
contract parser or authority check. SHA-256 hashes the UTF-8 `JSON.stringify`
serialization of these keys, in this order:

```text
{issue,body,bodyEdit,labels,comments,observedEventId}
```

`issue` is the issue node ID, body is its complete text, and bodyEdit is its
exact `{id,editedAt}` identity. Labels are name strings sorted lexicographically.
Comments are sorted by numeric REST ID and each serializes
`{id,body,author,editedAt,edit}` in that order; `id` is a string and `edit` is the
exact edit identity. Only comments carrying the feedback marker by the trusted
validator account are excluded. Reports and attestations have no exemption.
`observedEventId` is the latest observed readiness/workflow-state transition
identity under the existing observation interface. `bodyEdit` and
`commentEdits` expose the identities included in the digest; the selected
source also carries its own identity explicitly.

Readers compare the saved digest and identities to independently read complete
live facts. Missing facts, digest mismatch, source/edit mismatch or a different
latest ready application mean the verdict is not current; request evaluation
through the consumer's existing wait path. They do not turn a cached grant into
another authority judgment. A stop answered before evaluation is insufficient
when freshness still mismatches. After evaluation the same unended grant can
be current again. Fixtures include a same-second source change before the next
evaluation, and an unseen new ready application.

## Retained selection and historical proofs

V5 preserves these facts in full, independently of the grant's current state:

- `selection`: `{mode:"body",cutoff:{id,release,sha,epoch}|null,
state:"eligible"|"migrated"|"held"|"native",reason}`. The receipt ID remains
  the immutable full commit SHA. Exact eligible legacy selection,
  irreversible migration/retirement, held recovery diagnostics and native
  selection keep the [body protocol](issue-contract-v2.md)'s meanings.
- `factoryTriage`: `{run,revision,source,attestation:{id,revision,
edit:{id,editedAt}},intake:{author,writerRun}}` or null. It retains the
  successful independent triage run, authenticated publication and original
  intake writer. The historical source uses its existing v2 representation,
  including `editId` for body proof; it is not rewritten into the new source
  shape. Eligible legacy comment authority retains its source's authenticated
  writer/triage runs rather than pretending it had body publication proof.
- `factoryReview`: `{run,revision,attestation:{id,revision,edit},refusal,
publishedAt}` or null. Keep refused proof and null run/revision/edit facts
  where the existing v4 association permits them; a refused association grants
  nothing. Current successful factory review binds the exact selected body and
  a reviewer run independent of every known writer/edit run.
- `seamsExemption`: `{boundary:{tag,commit,publishedAt},revision,source,
evaluatedAt,publishedAt,reviewedAt,reviewer,reviewEventId,label}` or null.
  Preserve every byte-valued fact of the historical approval and immutable
  first-shipping boundary, including its original source representation.
  Neither withdrawal nor a held selector erases this proof. It grants no new
  readiness and can exempt only its own exact revision/source.

Historical evidence remains historical: recovery must neither reset its review
or publication time nor infer proof from current text. The existing validator's
`retainedEvidence` and `historicalSeamsApproval` recover the Seams proof;
body selection and factory-association handling consume their respective
records. The fixture captures #920's actual v3 proof and exercises a test-only
v5 projection back through that historical-evaluation seam. This is evidence of
lossless representation, not a production v5 reader or emission switch.

## Canon writer run line

For an Agent Brief or factory-opened issue body, propose one complete line:

```text
<!-- repo-canon:run {"format":"repo-canon/run/v1","run":"RUN_ID"} -->
```

Its JSON object has exactly `format` and one nonempty `run` string. The
schema's `$defs.run` defines the payload. The identity is opaque and scoped to
the authenticated publishing host: it is neither an account nor a role. There
must be exactly one Canon run line on a publication requiring writer provenance;
missing, duplicate, malformed or conflicting lines cannot establish a known
writer. A copied line is untrusted until bound to the authenticated publisher
and source/edit. The opening run identifies the factory issue writer; the
Brief run identifies its triage writer. Independent acceptance requires the
reviewing run to differ from known writing runs, preserving the existing
person-review route when factory writer proof is unavailable.

Canon-owned triage publication evidence and review attestations already bind
their own authenticated `run` field and need no extra line. Retained publications
keep their saved rendering, including existing historical run markers; adopting
this name does not rewrite old proof. Mutable host run-report markers are
separate and cannot substitute for this writer evidence. This document changes
neither marker consumption nor account storage.

## Validation and ownership

Run `node --test test/issue-contract-v5.test.mjs` for strict JSON Schema
validation, malformed cases, factual eligibility examples, run payloads and the
#920 transition. Existing verdict fixtures also assert unchanged production
state lines, and the current reader still refuses v5. The fixture's other
platform facts are illustrative; its provenance distinguishes them from #920's
copied historical proof. Full source validation stays in the
[development guide](README.md#setup-and-validation).

Ownership check: triggers 3 and 4. Repo Canon owns this protocol and grant policy;
the issue owns its grant/source/stop facts; hosts own execution and verdict-author
trust. Consumers are the validator, readiness command and factory, with other
hosts likely. Published names are hard to reverse; cost now M, carrying S after
the bridge and M during coexistence. The existing posted-verdict seam and
separate protocol/reader tickets retain one judgment without shared
cross-product authority code. No new deferred seam.
