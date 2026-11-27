# Issue contract validation

The `Issue contracts` workflow validates issue structure from the repository's
trusted default-branch code. It runs when issues open, reopen, or close, for
issue body and label changes, and for created, edited, or deleted issue comments.
Pull request comments are ignored. A `repo-canon-issue-contract` repository
dispatch requests a fresh evaluation after host proof persistence or activation;
it carries an issue number, shares that issue's serialization and grants no
acceptance to its sender.
Its `validate` job runs on `ubuntu-latest`. The workflow installs only at the
`github` check location; the [runner rules](../../rules/github-repository-configuration.md#installed-workflow-runners)
describe the location and the retired runner variable.
The workflow checks out the default branch explicitly and treats issue and
comment Markdown only as data.

The explicit prepared/body protocol, durable cutoff, exact v2 wire schema and
host publication interface are documented in [body contract protocol](issue-contract-v2.md).
Preparation preserves every v1 behavior below. After cutoff, source selection,
edit identities and factory attestation use that protocol; native contracts and
readiness role, timeline, notice and workflow-state rules remain applicable.

The adapter fetches the issue itself before reading its discussion, timeline,
relationships, edit revision, or actor roles. If that fetched issue is closed,
it removes every `state:*`, `gate:*` and `factory:*` label, then skips
validation with exit status 0. It preserves `wontfix` as the closure outcome,
`type:*`, `priority:*`, `model:*`, unrelated labels and the feedback comment. An already-clean issue causes no writes.
Discussion, timeline, relationships, edit revision, and roles are not fetched.
This applies to every issue kind, Wayfinder included, and every close reason.
The fetched state decides this path whatever the trigger, even when the
triggering event says the issue was open.

The validator exports `decideIssueContract`, a synchronous
decision that reads one snapshot and returns the label changes, the feedback
comment write, and the exit status, with no network or file access. Its closed
path needs only the fetched issue, and its open path needs the contract snapshot.
The file also exports `readinessTriggerUnrecorded`, a pure predicate over the same
snapshot, and, for the `triage` readiness command, `readyLabels`, the notice
barrier `noticePrecedes` and `observedChangeId`, so the command copies none of
the rules they decide. Its
GitHub adapter runs only when the workflow executes the file: for an open issue,
it fetches the complete snapshot before deciding, waiting within a bound for the
issue-event timeline to record a human readiness trigger, then applies the
returned writes.
The decision reads the issue's current state: its labels, body and body
revision, comments with the feedback record, timeline, and reviewer roles. The
triggering event never supplies labels, body, or comments. It supplies only
what current state cannot show: a deleted Agent Brief, the creation review's
facts (the labels an `opened` issue was created with, and whether a `labeled`
run's sender is the issue's opener), and a human readiness trigger the
timeline has not recorded yet. Two runs that read the same state therefore make the same
decision, and a run on the state its own writes produced changes no label and
records the same decision again.
One timeline helper inside the decision answers every question about whether
one issue event came after another, and it orders events by one rule: the
timeline's order decides when GitHub has recorded both events. A carried label
whose application the timeline has not recorded follows every recorded event
only when its latest recorded change is a removal or nothing. A label the issue
was opened with is the exception.
Timestamps are used only for what has no timeline position (the feedback
comment and Agent Brief comments) and to recognize labels applied at creation.
In prepared legacy mode, Agent Brief comments are ordered by comment ID: the latest
Agent Brief is the Brief comment with the highest comment ID, for both the
contract lookup and a deleted Brief.

The validator recognizes these contracts, and the
`github-repository-configuration` rules state the Agent Brief and Wayfinder
shapes for adopters:

- bug and feature request forms, including optional unanswered fields;
- specification forms and native specifications;
- implementation forms and native tickets, with an optional parent;
- triaged requests whose selected Agent Brief starts with a lead line, the
  upstream AI preamble, or that preamble then a lead line, with the
  `Agent Brief` heading directly after it and any triage notes below the
  brief. A lead line is one line holding a status marker from the comment
  rules' table, then bold text; the bare lead line carries no disclosure, and
  no host frame or footer is read. The two disclaimer shapes stay accepted for
  one release, as ADR 0044 decides;
- Wayfinder maps, whose initial `Decisions so far` section alone may be empty;
  and
- Wayfinder children with exactly one planning label and a parent map.

Heading levels and casing do not affect recognition. Required fields reject
empty content, template comments, and GitHub's `_No response_` placeholder.
The validator uses the repository's pinned Marked and parse5 resources so
contract syntax in fenced or indented code, inline code, and HTML comments
remains example content, and required fields are evaluated by their rendered
visible content. Prepared mode retains the latest-comment contract and intake
body context. Active body mode selects a body Agent Brief or the exact
unchanged legacy source inventoried at cutoff; it never selects a new comment.
Native specifications and implementation tickets remain authoritative when the
issue does not carry a triage category. Wayfinder labels select the Wayfinder
contract before either form. The validator alone identifies a contract's kind
from these labels and the body's headings; the factory reads no issue body. A
category-labeled `wontfix` outcome does not require an Agent Brief.
Native parent and blocking relationships are read through Postern. On GitHub,
body-only links in `Parent` and `Blocked by` sections do not supply
relationships. An open blocker does not make a complete contract invalid.

Rendered visibility, text, links, heading provenance, and outermost section
regions come from the shared pure interpreted-document runtime installed at
`operations/lib/rendered-markdown.mjs`, as do the token-span and inline-text
helpers the validator imports. Issue policy remains in the validator:
contract-source selection and exact revision bytes still use the original
Markdown, Agent Brief syntax still uses source tokens, and relationship
evidence remains prose-only. HTML `title` content stays non-rendered for issue
contracts. Parse5's fragment handling continues to expose text from a bare
`head` wrapper as body text. Keyboard-input text remains visible relationship
evidence, while image alt text does not establish a relationship. These retain
the issue-specific edge behavior.

Triaged bug and feature requests must carry exactly one category label
(`type:bug` or `type:enhancement`), matching their Agent Brief's `bug` or
`enhancement` Category; the validator settles their workflow state, as described under
[workflow state](#workflow-state). Direct specifications and implementation
tickets do not need intake categories or an Agent Brief. Wayfinder planning
labels remain separate from intake labels.

## Seams release boundary

New Agent Brief revisions require non-placeholder **Seams** after Out of scope.
The writer and independent reviewer use `codebase-design`'s
[Ownership check](../../.agents/skills/codebase-design/OWNERSHIP.md).
`No trigger` passes structure; the validator makes no semantic ownership judgment.
Native specifications and implementation tickets keep their existing shapes.

`release:prepare <version>` pins `seamsReleaseTag` once in the distributed
validator for the first stable shipping release. Later releases retain that tag.
At evaluation, `resolveSeamsBoundary(connection)` uses the authenticated GitHub
transport against Repo Canon, reading the pinned tag's annotated object/commit
and its ordinary release's `published_at`. The resulting
`{tag,commit,publishedAt}` is the standard-owned immutable identity. No new
receipt, adopter configuration, clock, issue-age or install-date inference is used.
A missing/unprepared/mismatched/lightweight tag, missing/draft/prerelease release,
or failed read reports an unresolved Seams boundary and writes no labels or
feedback. The [release procedure](release.md) gates publication and verifies and
records the resolved identity. Publication and tags remain immutable.

The synchronous `decideIssueContract` consumes that resolved identity as
`snapshot.seamsBoundary`; offline callers supply the authenticated fixed facts,
as the fixtures do. A Brief without a resolved identity holds without mutation.
The adapter resolves it before any source-ledger or readiness mutation. Its
optional final resolver argument is a dependency-injection seam, not a repository
policy or environment setting; the neutral CLI and trusted trigger use the same
resolver and accept an injected resolver in their programmatic options.

Before enforcing Seams, classification uses the body migration's selected
source and unchanged revision serialization. Only a trusted versioned validator
approval of that exact revision/source can establish an exemption. Its evaluation,
first revision publication and actual authorized label-review event must all
strictly predate the cutover; equality is new work. The publication precedes the
review, the review precedes or equals its evaluation, and any source edit time
also predates cutover. Missing/unreadable/unrelated or awaiting-review evidence
never qualifies. Pre-release age alone never qualifies an unapproved Brief.

A stored approval naming a former name of `state:ready`, currently
`ready-for-agent`, counts as `state:ready`. The same standard-owned former-name
declaration drives canonical-labels setup's in-place renames. The exemption's
review-event lookup accepts either name while still requiring the recorded event
ID and actor. Written results use `state:ready` in both `label` and
`seamsExemption.label`, including when retaining v3 evidence under a former name;
the result format is unchanged. Readiness transitions still require the current
name: `ready-for-agent` events cannot establish or retain readiness after a rename,
so a fresh review is required as the adoption guidance states.

For a carried non-readiness workflow state, timeline ordering attributes an event
under a former name to its canonical label only when that former name is absent
from the repository's live labels and the event precedes the first event under
the current name on this issue (or there is no current-name event). The shared
canonical-label declaration supplies the former names. Latest change, latest
application and actor, position against a review, the validator's `state:triage`
fallback exemption, selection among carried states and `wontfix` settlement all
use that attributed history. Results and messages keep canonical names.

A live former label has its own history, and former-name events after the first
current-name event are ignored for canonical ordering. A carried state whose
latest attributed change is a removal, or whose history has no attributed event,
still follows every recorded event under the existing ordering rule. The adapter
reads the complete live repository label names alongside the timeline; a failed
label read aborts before any label mutation. A decision snapshot without live
label names cannot attribute former-name events.

### Exemption result v3

An exempt revision publishes `format: "repo-canon/issue-contract-state/v3"`,
with every field and meaning of its `baseFormat` (`v1` prepared or `v2` body),
plus `baseFormat` and `seamsExemption`. The
[machine schema](../../test/fixtures/issue-contract-v3.schema.json) describes the
shape; [offline migration fixtures](../../test/issue-contract-seams.test.mjs)
exercise both bases. Nonexempt results retain their existing v1/v2 format.
Body-mode selection, proof and observation remain authoritative in v3; this
extension introduces no source selector or activation mode.

`seamsExemption` records `{boundary,revision,source,evaluatedAt,publishedAt,
reviewedAt,reviewer,reviewEventId,label}`. `boundary` is the resolved release
identity. The remaining values identify the original exact pre-cutover approval,
its publication and its authorized review. A held source selection can retain
this historical proof while its top-level revision/source are null; it grants
no eligibility until the selector again proves that exact unchanged revision.
Except for canonicalizing former readiness names, they persist unchanged on repeated
evaluations, readiness removal, superseding states and fresh review of that same
revision. The top-level current approval fields keep their existing meanings:
exemption is never authorization. A changed revision/source loses the exemption
and requires Seams. Recovered body-mode ledger notices preserve it through
replaceable feedback deletion by the existing storage mechanism.

Readers explicitly accept v3, validate its base and exemption, and continue
checking the current ready event and v2 observation when its base is v2. Unknown
formats, malformed evidence and revision/source mismatches refuse eligibility.
Update downstream result readers before adopting the shipping release; this is
separate from #919's body-mode activation. No bulk brief edits or readiness
renewal are needed for unchanged eligible approvals. Readiness removal does not
restore a label: fresh authorized review follows the existing notice/event rules.
Add Seams when a Brief is actually revised, then obtain its new notice and review.

### Review attestation result v4

A result that names a factory review attestation publishes
`format: "repo-canon/issue-contract-state/v4"`, with every field and meaning
of its `baseFormat` (`v1` prepared or `v2` body), plus `baseFormat` and
`factoryReview`. The [machine schema](../../test/fixtures/issue-contract-v4.schema.json)
describes the shape; the
[review attestation fixtures](../../test/fixtures/issue-contract-review-attestation.json)
hold literal v1, v2 and v4 lines over both bases. Results without an observed
attestation retain their existing format, so nothing changes until a host
posts one. A Seams exemption belongs to an Agent Brief and a review
attestation to a direct contract, so no result carries both.

`factoryReview` records `{run,revision,attestation:{id,revision,edit},refusal,
publishedAt}` on an `approved` or `awaiting-review` direct contract. `run` and
`revision` are the attested values, or `null` when malformed. `attestation`
names the comment ID, the SHA-256 of its complete body and its edit identity,
`{id,editedAt}`, whose `editedAt` is `null` for an unedited comment, or `null`
when unread. `refusal` is `null` when the attestation backs readiness, and
then `run` is named, `revision` equals the result's revision and the comment is
unedited. `publishedAt` is when a notice first named this same observation,
carried by later results, and `null` in the result that first names it, like a
revision's `publishedAt`. A host tells from the state line alone that a notice
followed its attestation and names its revision: `factoryReview.attestation.id`
is its comment, `refusal` is `null` and `revision` is the attested one. Readers
explicitly accept v4 and validate its base and review; unknown formats and
malformed reviews read as no result.

## Published result

The validator's result on an issue is its feedback comment: the latest comment
by its acting account containing `<!-- repo-canon:issue-contract-feedback -->`.
Its second line, `<!-- repo-canon:issue-contract-state {…} -->`, holds one JSON
object in a published format. The factory reads that result instead of
interpreting contracts, as
[ADR 0029](../adr/0029-make-the-validators-posted-result-the-only-contract-decision.md)
decides, and the `triage` readiness command reads it through the validator's
exported `issueContractResult`. A marked comment by any other account, person
or bot, is not a result.

The validator identifies its own results by its acting login at all six sites:
previous feedback, readiness-trigger senders, its label removals, its
`state:triage` fallback, the saved body-mode notice author, and feedback
excluded from the v2 observation digest. On Actions the trusted trigger supplies
`github-actions[bot]` without a platform read. Off Actions the neutral entry
point resolves the token's GraphQL viewer, including the REST `[bot]` suffix for
App accounts, and fails before writes if identity cannot be resolved. The
validator never reads a repository variable.

Readers resolve trust separately through `readTrustedResultAccount(connection)`.
It reads the repository-variables endpoint for `REPO_CANON_RUNNER_ACCOUNT`:

- Success trusts the variable's value, a REST account login.
- Not found, HTTP 404 only, means unset and trusts `github-actions[bot]`.
- Every other failure, including HTTP 403 and 410, trusts only
  `github-actions[bot]` and returns the failed-read diagnostic to the caller.
  An empty or malformed successful response also adds no trusted account; its
  diagnostic says the variable names no login.

The readiness command and cutoff inspection/inventory pass that account to
`issueContractResult` and use it when computing the observation digest. With
an override, earlier Actions results and worker-posted results are ignored.
When readiness refuses after a failed variable read, its error names the
caller's missing **Variables: read** permission. With an Actions-authored
result, readiness still works without that permission. A runner result needs
readable configuration naming the runner. The reader is also the shared
interface for the merge gate's runner support.

At `self-reported`, nobody posts contract results: the owner applies readiness.
Without a validator notice, the readiness command reports that it is missing.

Scriptorium v2.3.0's factory host remains compatible with this result. Its
reader checks `status`, `revision`, `label`, `reviewEventId` and `reviewer`,
which remain present with their existing meaning; the added `format` field
does not change those checks. Scriptorium v3.0.0 will consume the versioned
result as its contract decision. Publishing this source does not update the
host or adopt it into Scriptorium; that adoption is a separate rollout step.

`format` names the format version, `repo-canon/issue-contract-state/v1`. Any
change to the fields or their meaning is a new version, which a reader accepts
or refuses explicitly. Every v1 line carries every field below, in this order,
with `null` where the evaluation has no value:

- `format`: the format version.
- `status`: `approved` when readiness is bound to the contract;
  `awaiting-review` for a complete contract without bound readiness, including
  after a rejection; `needs-attention` for an incomplete structure; and
  `no-contract` for a valid issue without an implementation contract, such as
  a `wontfix` outcome. Only `approved` approves readiness.
- `kind`: the kind the validator identified, such as `triaged Agent Brief`,
  `implementation ticket`, or `specification`.
- `revision`: the complete contract's `sha256:` revision.
- `source`: the contract source, either
  `{"type":"comment","id":"<Agent Brief comment ID>","editedAt":"<its update time>"}`
  or `{"type":"issue-body","editedAt":"<the body's last edit time>"}`, whose
  `editedAt` is `null` for a body never edited.
- `label`, `reviewer`, `reviewEventId`: for an approval, the readiness label it
  approves, the reviewer's login, and the ID of the readiness label event it
  approves. A creation review the timeline has not recorded yet uses an
  `opened:` ID until a later run records the event's own ID. A reader compares
  `label` with its own ready label and `reviewEventId` with the current
  readiness label event.
- `event`: the event this evaluation decided: its neutral `kind`, such as
  `labeled` or `commentEdited`, the `actor` login, the `label` of a label event,
  and the `commentId` of a comment event.
- `evaluatedAt`: the second the validator decided in. It makes every result's
  bytes differ from the one it replaces, so each write updates the comment even
  when two events of the same kind leave the decision unchanged.
- `observedEventId`: the latest readiness transition the evaluation observed,
  other than the validator's own removal of readiness.
- `sourceInvalidation`: the deleted newer Agent Brief, `deleted-comment:<ID>`,
  that invalidated a restored source.
- `publishedAt`: when the validator first published this revision, carried by
  later results for it. The result that first publishes a revision records
  `null`; its own update time is that time.
- `rejectionReason` and `rejectedCreationLabel`: the last readiness rejection's
  reason and, for a creation review, the label it rejected.

`observedEventId`, `sourceInvalidation`, `publishedAt` and the rejection fields
are the validator's records for its next evaluation; a reader of the decision
need not interpret them.

Every evaluation of an open issue writes its result, even when the decision is
unchanged, after its label writes. A result older than the issue's latest
comment, edit or label change therefore means the validator has not evaluated
the issue since. An issue without an implementation contract that has never had
a result, such as an intake form or a Wayfinder issue, gets none; it carries no
readiness. Closed issues are not evaluated and keep their last result.

The result applies one rule for each point where the factory once interpreted
contracts itself:

- Only an edit to the implementation contract cancels readiness: the latest
  Agent Brief of a triaged request, or the body of a directly authored ticket or
  specification. Editing a triaged request's body or another comment does not.
- Only current category labels count. Removing a triaged request's category
  label leaves its Agent Brief without the matching category, so the result
  needs attention and readiness is removed; a native ticket whose category was
  removed needs no Agent Brief.
- Readiness binds to one revision of one Agent Brief. Editing or deleting that
  Brief, or posting a newer one, cancels it; deleting an older, superseded
  Brief does not.
- Only the `admin`, `maintain` and `triage` roles, or the factory's
  [triage result](#factory-triage-readiness) or
  [review attestation](#factory-review-attestation), authorize readiness, as the
  [readiness roles](../../rules/github-repository-configuration.md#readiness-roles)
  rules state.
- The result names the readiness label it approves.

The validator and the readiness command also read the earlier line without
`format`, which the next evaluation replaces. Such a line under a "needs
attention" or "structure corrected" notice carried an earlier state forward;
it is read as `needs-attention` or `no-contract` and approves nothing.

## Feedback and readiness

The validator maintains one marked feedback comment, which holds its [published
result](#published-result). Below the result line, the notice leads with its
outcome under the `comments` rules' Lead line: a status marker and the outcome
in bold, followed by the short revision when the result records one. Corrections
a person must make stay visible below it; the full revision and the explanation
are collapsed in `<details>`, whose summary states the decision. A refusal's
lead line carries its reason's first sentence, cut to the lead line's length
limit, and its details hold the full reason. Incomplete contracts list the
structural corrections there, under a `needs-attention` result that approves
nothing and records no revision unless a retained Seams exemption supplies its
Agent Brief's. It carries forward only the source invalidation, so a corrected
contract's revision is published again before readiness is applied. A later
structural pass replaces a "needs attention" notice with a "structure corrected"
notice; an issue that no longer carries a contract gets a "not required" notice.
Complete specifications, tickets, and Agent Briefs publish a `sha256:` revision
and wait for authorized review. The same comment records the reviewer, revision,
and resulting readiness state after an accepted review event, so repeated
workflow events can verify the association without reapproving or duplicating
feedback. Every result also records the latest readiness-label transition it
observed. Approved state records the exact GitHub issue-event ID that supplied
the review. The observed transition is the latest readiness transition other
than the validator's own removal of readiness, so the run after that cleanup
records the same one.

Every readiness rejection records its reason, such as an unauthorized
reviewer's "is not authorized to grant readiness", and so does a workflow state
that supersedes a review. Once a run has recorded that rejection, later runs
retain the reason while the contract revision is unchanged and no new readiness
transition has occurred. If the opening run rejected from its payload before
the timeline recorded the opener's creation label, that label appearing later
does not replace the reason. Timeline recognition of the opener's creation label
requires its application in the same second the issue was created. The bot's
removal of readiness as rejection cleanup also retains the reason.

A rejection or supersession that removes readiness publishes a "Readiness
removed" notice. Its details start with `Readiness was removed:` and the
reason, name each readiness label the validator removed, and say that
restoring readiness needs a fresh authorized review of the exact revision, after
its revision notice for an Agent Brief. Its result keeps the v1 fields with
status `awaiting-review`. A run that retains the reason takes the removed
labels from the validator's previous notice, so it publishes the same notice;
it also reads them from a notice posted before the feedback led with its
outcome, under its "Issue contract readiness removed" heading. A
rejection that removed no label keeps the awaiting-review notice with its
reason. Triage's readiness command accepts either notice as a
complete contract awaiting review.

A creation rejection records which label the creation review rejected. That
label's creation event, the first readiness transition when the rejection
observed none, does not replace the reason, so it survives both creation runs
in either order, even when they see empty history. A later readiness event or a
contract edit replaces the rejection through the usual review or
revision-notice path; a readiness transition the timeline has not recorded yet
does not. Feedback records from the previous validator without a rejection
reason keep the plain notice.

The revision is computed from a versioned record containing the selected
contract kind, exact contract bytes, source identity, and source edit revision.
Direct-body contracts use the issue GraphQL node ID and `lastEditedAt`. Agent
Briefs use the comment node ID and `updated_at`, so editing a brief or replacing
it with an identical-looking comment still changes the revision. Native parent
and blocker relationships remain separately fetched review context, not body or
Brief revision bytes. An explicit relationship link inside a direct ticket body
is part of those exact bytes. Closing or replacing a native relationship alone
does not silently redefine the reviewed source revision.

An unedited direct specification or ticket created with exactly one readiness
label can take its initial review from its creation snapshot, whichever of its
`opened` and `labeled` workflow runs arrives first. That label's application
must be both the first and the latest readiness transition, applied by the
issue's opener. The `opened` run reads the label from its payload. A `labeled`
run needs the timeline to record the opener applying the label in the issue's
creation second; otherwise it is decided as any later review. A readiness
trigger takes the creation review only when its sender is the opener, so
another sender's readiness label is never attributed to the opener's creation
label event; a `labeled` run for any other label keeps the creation review.
Either run then checks the opener's role as it checks any reviewer's, so an
opener without an authorizing role gets the same "not authorized" feedback
whichever run arrives first. Once the timeline holds the creation label event,
either run records it as the review, so both orders end with the same labels and
recorded review.

GitHub can deliver a `labeled` webhook before its issue-event timeline records
that label event. A human readiness trigger is a `labeled` event for
`state:ready` by a sender other than the validator's acting login, while its
re-fetched issue still carries the label. The timeline
records the trigger only when the checked label's latest recorded application,
by anyone, was made by that sender and is that label's latest recorded change.
A trigger is therefore never decided from another person's application. While
the latest feedback awaits review, the readiness transition it records as
observed is a barrier: the timeline records the trigger only when, in addition,
that application is positioned after the barrier. The run that wrote that
feedback already observed every application at or before the barrier, so none
of them can be this trigger. Awaiting-review feedback is only written while readiness is
absent or being removed, so a present readiness label was applied after the
barrier, and a complete timeline always holds that application. A barrier the
timeline cannot place, such as another issue's opening or an event the timeline
does not hold, never lets a trigger count as recorded; this issue's own opening
places before every event. Approved feedback, and awaiting-review feedback that
records no observed transition, set no barrier. The payload's issue update time
is not used, because matching it against a recorded event's second-resolution
time could make a recorded trigger look unrecorded. While the timeline does not
record the trigger, the adapter re-reads the issue events every 2 seconds, for
at most 30 seconds of waiting in total (15 re-reads), and decides from the first
read that records it. The bound stays short because the workflow serializes runs
per issue and, while one run waits, GitHub keeps only the newest pending run for
that issue. The decision itself stays pure: it reads one snapshot, and the
adapter asks `readinessTriggerUnrecorded` whether to read again. Every other
trigger, and a readiness trigger whose re-fetched issue carries no readiness
label, reads the events once.

The decision asks the same predicate. While it holds, the decision fails closed
before selecting any review, including a recorded approval, so a timeline whose
latest application of the checked label is another person's or does not
follow the barrier, or whose latest change of that label is a removal, never
supplies the review. When the bound runs out, the run decides once from its last
read this way: it removes readiness and reports that the authoritative issue
timeline does not contain the current readiness label event. The remedy is to
reapply the label after the revision notice, and the validator decides it as any
later review. Because a creation `labeled` run waits for the opener's creation
label, an unauthorized opener's rejection is recorded in either run order, and
the later `opened` run keeps it.

Requiring the sender's own application has an accepted cost. Suppose one
person's trigger is delayed until another person has removed and reapplied the
label, or has swapped it for the other readiness label, and the timeline
records that reapplication or that removal and application. The run then waits
out its bound and fails closed: it removes that valid label, which has to be
applied again. A `labeled` payload carries no issue-event ID, so the run cannot
identify its own event among the recorded ones. Deciding the trigger from the
other person's application instead could, while the timeline lags, bind or keep
another reviewer's earlier, withdrawn review for a label the sender currently
holds. The validator accepts this safe rejection, which needs out-of-order
delivery, in place of a possible binding to the wrong reviewer.

One lagging case is accepted as recorded, on the approval side. The label's
latest recorded application is the sender's own earlier one, it follows any
barrier and is the label's latest change, and the sender's own removal and
reapplication are still unrecorded. The run then decides from that earlier
application without waiting, and keeps a recorded approval of it. The reviewer
and their authority are the trigger's own.

On the rejecting side, a retry after a rejection is not judged by the rejected
application, with one remaining case. If the rejecting run's bound ran out
before the timeline recorded the rejected application, its feedback records an
earlier barrier, and a retry while the timeline still lags is judged by that
application again and rejected. This needs the timeline to lag past the bound
twice; reapplying the label once the timeline has caught up is decided as any
later review.

A run without a readiness label event has a documented limitation that is not
fixed. Such a run, for example for a comment, an edit, or a reopening, has no
trigger identity, so for it a lagging timeline is indistinguishable from a
complete one. GitHub keeps only the newest pending run per issue, as described
above, so such a run can replace the pending run of a readiness trigger or of a
removal. It can then grant, or keep, another reviewer's earlier review that a
human removal withdrew. This needs all of these at once: a labeler without
review authority, a review withdrawn by a human removal, a lagging events
endpoint, and a superseding non-readiness event. The next run that reads a
complete timeline corrects it. Neither alternative closes it. Granting or
keeping only the label's latest recorded applicant changes nothing, because in
the lagging timeline that applicant is the withdrawn reviewer. Never granting
from a non-readiness run prevents only the grant, and removes valid labels
whenever a comment quickly follows a label.

Every later review, and every Agent Brief review, starts after the validator
publishes the exact revision in its feedback comment; the reviewer then applies
a readiness label. This notice-first sequence avoids relying on GitHub's
second-resolution edit and label timestamps to order otherwise ambiguous events.
The revision's first publication must strictly precede the review label event:
the result's `publishedAt`, or, when the result first published its revision,
the feedback comment's authoritative `updated_at`. A same-second attempt is
rejected and must be reapplied. Results rewritten for later events keep the
first publication time, so a rewrite never moves the notice past a label.
For an open issue, the validator re-fetches the issue, complete discussion,
complete issue-event timeline, relationships, and direct-body edit revision
before every decision.
It also reads the repository role of every actor on a readiness-label event, of
the recorded reviewer, and of an opening event's sender. On a `labeled` run, the
opener's role is the one read for the creation label event's actor. A failed
role lookup is recorded for that login as unavailable authority; a missing role
is recorded as a definite absence of authority. Neither authorizes readiness.
Role lookup failures do not bypass the decision's cleanup: readiness that
cannot be verified or is bound to an older revision is removed, and the
feedback explains why a fresh review is required. A later successful lookup
does not restore readiness without a fresh authorized review of the published
revision. Label and feedback write failures remain visible as failed validation,
so a failed mutation is never reported as successful cleanup.
It binds approval to the actor and ID of the latest transition for the current
readiness label. A removal therefore invalidates the old event even if another
label is added before its workflow runs. A delayed removal or repeated webhook
cannot overwrite a genuinely newer approval. The recorded transition barrier
and position in the authoritative timeline establish that the selected label
event follows the exact revision. The only opening barrier is this issue's own
opening, and an event the timeline has not recorded follows no barrier. Stale
webhook payloads cannot supply the actor or restore an older association.
If deleting a newer Agent Brief, one with a higher comment ID, reveals an older
previously approved Brief, the deletion event is recorded as a source
invalidation. The restored source needs a
new revision notice and review; replaying that deletion after renewed approval
does not revoke it again, and deleting an older superseded Brief does not affect
the current source.
The workflow's per-issue concurrency group serializes validator runs, so a run
holding an older comment snapshot cannot overlap and overwrite a newer approval
recorded by another run. It keeps `cancel-in-progress: false`. While one run is
in progress, GitHub keeps only the newest pending run for the issue, so the run
for the latest event runs last, and because it decides from current state, its
decision stands. Cancelling runs in progress could stop a run between its label
writes and its feedback write, and could cancel the `deleted` run, the only run
that knows about a deleted Agent Brief. A deleted Brief's invalidation is still
lost when a newer event's run replaces that `deleted` run while it is pending.

The event actor is authorized only when GitHub reports the repository `admin`,
`maintain`, or `triage` role. The triage role is the explicit authorization for
a triaging agent. A `write` role, `author_association`, login shape, bot identity,
heading, preamble, or structural pass supplies no authority. The factory's
triage run is the one exception.

### Factory triage readiness

The factory's triage run accepts the brief it wrote
([ADR 0030](../adr/0030-let-factory-triage-accept-its-own-brief.md)). The
adapter reads the factory's triage result from `.scriptorium/config.json` in the
trusted checkout, through the exported `factoryTriageResult`:

```json
{ "triageResult": { "marker": "scriptorium:run", "author": "factory[bot]" } }
```

`author` is the account that posts the result and applies its readiness, and
`marker` marks the line naming its run. A repository without the file or the
key has none, and only roles authorize readiness; a malformed `triageResult`
fails the run. In prepared mode and for an eligible unchanged legacy source, the triage result
is the Agent Brief comment that `author`
posts for the run. It names the run on exactly one line of its own:

```markdown
<!-- scriptorium:run {"run":"<run>"} -->
```

The brief's shape still applies, so the line comes after the brief's
preamble, such as below the brief. The result names its brief revision by
being that revision's source: an edit makes a new revision, and a newer Agent
Brief replaces it as the contract.

A readiness label event by `author` is approved, without a role, when the
current contract is that comment with one marked run line, and the event
follows the revision notice like any other review. An issue that `author`
opened must name the run that wrote it with one marked line in its body, and
that run must not be the triage run; an issue `author` opened without one is
refused, because its writer is unknown. Any other refusal is recorded as the
rejection reason, and the label is removed as for any unauthorized reviewer. The approval's
`reviewer` is `author` and its notice names the run. Readiness by every other
account, `author` included when no triage result is configured, needs a role
as before.

### Factory review attestation

The factory's triage run also accepts a directly authored specification or
implementation ticket that it reviewed and did not write
([ADR 0053](../adr/0053-let-factory-triage-accept-a-direct-contract-it-reviewed.md)).
Its proof is a factory review attestation: a comment by the configured
`author` with the run's marked line and one attestation line, which a host
builds with `reviewAttestationLine` from the installed
`scripts/issue-contract-sources.mjs`, never by restating the format:

```markdown
<!-- scriptorium:run {"run":"<run>"} -->
<!-- repo-canon:review-attestation {"format":"repo-canon/review-attestation/v1","repository":"OWNER/REPO","issue":"ISSUE_NODE_ID","run":"<run>","revision":"sha256:...","source":{"type":"issue-body","editedAt":null}} -->
```

The host passes the repository, the issue's node ID, the run and the exact
`revision` and `source` the validator's notice names. `reviewAttestationLine`
refuses facts that could never verify, and `verifyReviewAttestation(markdown,
facts)` returns `null` for the matching attestation or the reason it differs.
`attestationPayload(markdown, marker)` is the one reader of both this
attestation and the body-mode publication proof.

The validator observes the latest attestation the configured `author` posted
on a direct contract and reads its edit identity: in prepared mode the adapter
reads only that comment's edit identity, and body mode already reads every
comment's. It publishes what it observed as the result's `factoryReview`, in
the [v4 result](#review-attestation-result-v4), with `refusal: null` when the
attestation backs readiness of the current revision, or the reason it backs
none:

- it was edited after posting, or its edit history was not read;
- it carries no single marked run line;
- it names another run than its marked line, as a copied attestation does;
- it names another repository, issue, revision or body source, as an
  attestation of an earlier revision does after a body edit;
- the factory opened the issue without naming the run that wrote it, or that
  run is the attestation's run, under the triage result's writer rule.

A readiness label event by `author` on a direct contract is approved, without
a role, when the current attestation has no refusal and the event follows a
notice that named that same attestation and revision, first published in an
earlier second. A refusal names its cause: one of the reasons above, an
attestation another account posted, a deleted attestation, none at all, or a
notice that has not named the attestation yet. An approval relying on an
attestation that is later edited or deleted, or a body edit, removes
readiness. On a triaged Agent Brief, a review attestation authorizes nothing,
and the refusal says so. Without a factory triage configuration no attestation
is observed and nothing changes. A person's readiness is unchanged beside an
attestation.

Wayfinder maps and children reject readiness labels because their native
eligibility uses open state, assignment, and blockers instead of the readiness
workflow, and the validator never adds a workflow state to them.

On open issues, incomplete, edited, replaced, stale, or unauthorized contracts
lose `state:ready`.
Corrections update the same comment with a new revision and require fresh
review. Structural success never grants readiness, and the validator never
starts work; the factory picks up ready issues. Reopening an issue whose contract
changed while closed removes readiness and requires fresh review.

The workflow needs `contents: write` for the dedicated durable contract-ledger
branch in active body mode (preparation performs no ledger writes), to load trusted code and `issues: write` to
read issue context and maintain labels and comments. GitHub's metadata access
must expose collaborator roles, and the supplied workflow credential must read issue edit metadata through
Postern. Node.js
24 is the default runtime; the validator also supports stable Node.js 26. The adapter recognizes that the workflow executed the file
through `import.meta.main`; on 24 releases before 24.2, which lack it, it
compares the resolved script path with the validator's own path instead. The
validator has no package dependencies, so the job installs none and disables
the Node.js setup action's automatic package-manager cache. It pins the same
checkout and Node.js setup actions as the PR metadata workflow.
GitHub Actions does not expose issue-dependency changes as an `issues` workflow
activity type, so the validator observes the latest relationships on each
supported issue or comment event.

### Workflow state

Every run on an open issue that uses workflow state works out the one workflow
state label the issue should carry and removes the others: a `state:` label,
of which only `state:ready` is readiness, or the closing `wontfix` in its
place. Intake forms, triaged
requests, direct specifications and tickets, and unrecognized issues all use
workflow states. Wayfinder maps and children, including ones that fail structure,
never gain a workflow state. Pull requests remain ignored. The number of
workflow states is never a structural error.

- A carried readiness label that is authorized and bound to the current
  revision, as an active approval or a valid grant, is the state. Every
  non-readiness state labeled before its review in the event timeline, or
  applied with the issue at creation, such as a form label, is removed. A label
  applied at creation is one the issue was opened with or whose application
  carries the issue's creation timestamp. The validator's own `state:triage`
  application (actor the validator's acting login) is a fallback for a stateless issue
  and never supersedes this readiness: it is removed even when the timeline
  records it after the review. This also handles an opening run that read a
  bare snapshot and wrote its fallback after an authorized creation review.
- A non-readiness state applied after the review supersedes it, whatever its
  timestamp, except for the validator's own `state:triage` fallback: the validator
  keeps the latest such state, removes readiness and every other state, and publishes the readiness-removed notice naming that state. A carried
  state whose application the timeline has not recorded counts as later than
  every recorded event only when its latest recorded change is a removal or
  nothing. A label the issue was opened with is the exception.
- Readiness that fails authorization or revision binding is removed and its
  rejection recorded. A structural failure removes readiness and lists its
  errors.
- Among non-readiness states, the one applied latest in the timeline stays.
  Several whose applications the timeline has not recorded cannot be ordered,
  so they all stay until a later run reads a timeline that orders them.
- An open issue left with no workflow state gets `state:triage`, whether or not
  it has carried one before, on any trigger. Opening and reopening a bare issue
  therefore need no special case. The run keeps the recorded review state,
  so its rewritten result records the same decision and readiness applied
  afterwards at the same revision is decided as if `state:triage` had never been
  removed. Removing readiness, or losing it to invalidation, therefore returns a
  contract, or an unrecognized issue such as a contract edited until no contract
  heading remains, to `state:triage` unless another non-readiness state remains.

One lagging case is accepted as recorded, for workflow state. A state label
removed and reapplied while the timeline records neither change is ordered at
its earlier recorded application. Settlement can then remove the reapplied
label in favor of another carried state, or order it before a review. This
needs two workflow states carried at once and a removal and reapplication
inside the timeline's lag. An issue normally carries one state; two can coexist
before a run settles a new label, or when the validator restores `state:triage`
during a removal and reapplication. A `labeled` payload carries no issue-event
ID, and the payload's issue update time is not used to match recorded events,
as explained above. The run therefore cannot distinguish an older recorded
application from an unrecorded reapplication, especially when the same person
made both; deferring settlement on that guess would need the same timing
signal. The change is visible in the issue's label history, no readiness is
granted, and applying the label again once the timeline has caught up settles
it.

A category-labeled triaged request with `wontfix` is a `wontfix` outcome unless
a non-readiness state applied later replaces `wontfix`, or the issue also
carries readiness and an Agent Brief, which orders `wontfix` against the review
like any other state. Readiness beside a `wontfix` outcome without an Agent
Brief is a structural error.

## Footprint and supersession

A direct specification or implementation ticket states its footprint
([ADR 0045](../adr/0045-check-supersession-and-footprint-at-readiness.md)) in
three lines of its body:

- `Supersedes:` names the ADRs and issues it replaces: `ADR 0045` or
  `ADRs 0040 and 0046` in the contract's repository, `owner/name ADR 0011` in
  another, and `#123`, `owner/name#123` or an issue URL. The ids are read from
  its prose; a value starting with `none` names none.
- `Adds:` and `Deletes:` name durable surfaces, separated by semicolons: a
  skill or one of its references, a label, a configuration key, a rule section
  or a record kind.

A field line starts with the field's plain or bold name; a repeated field adds
its items. Lines in code, HTML and blockquotes are examples, and a line starting
with inline code is prose. A contract without all three lines has an unknown
footprint: it is never treated as empty, and it does not hold readiness back.

A file path in any field, being a word with a `/` that ends in a file extension
or in `/` or a file name with a common source or document extension, and an
empty field are rejected: they never fail the structure, and they refuse a new
readiness grant naming each. A recorded approval keeps readiness, so open
contracts gain well-formed lines when next rescoped.

Each awaiting-review or approved result of a direct contract ends with a
`Footprint:` line outside the state line. It counts the adds against the
deletes, one per item, over the contract and, for a specification, its native
sub-issue tickets, names each contract whose footprint is unknown, and ends
with the contract's own rejected items. The tally is shown, never gated.

A new readiness grant to a specification is refused while an open issue it
supersedes has no fate. Those issues are the open issues its `Supersedes:`
names, and the open issues in its repositories, its own and its tickets', whose
body cites an ADR it supersedes as `ADR 0045`, as `name ADR 0045` or
`owner/name ADR 0045`, or by a link to the ADR's file. A bare `ADR 0045` cites
only the ADR of the issue's own repository, and not when another of those
repositories' names qualifies it. The specification and its tickets are never
candidates. A fate is a comment on the issue, as the
[comment rules](../../rules/comments.md#fates) shape it, that links the
specification and closes the issue as superseded, rescopes it or keeps it with
a reason; a closed issue needs none. The refusal removes the readiness label and names each issue still
missing a fate in the awaiting-review result's rejection reason. A recorded
approval is not checked again.

The adapter reads these issues only for a structurally complete specification
that carries a readiness label, through each repository's issue tracker, and
reads its tickets' bodies for the tally. A failed supersession read refuses the
grant with its reason; an unreadable ticket's footprint is unknown. The
`triage` readiness command checks the same exported `footprintRefusal` and
`supersededWithoutFate` before writing any label, even to record approved
readiness again, and stops with the same refusal. The parser is exported as
`contractFootprint`.

The `babysit` merge command checks declared deletions with that parser, as
the [merge script](babysit-merge.md#declared-deletions) describes. It resolves
three `Deletes:` forms to the files that hold them, with names in backticks or
double quotes:

- `skill <name>`: the files in `.agents/skills/<name>/`;
- `reference "<name>" (<skill>)`: the file named `<name>`, with any
  extension, in `.agents/skills/<skill>/references/`;
- `rule section "<heading>" (<name> rules)`: that heading's section in
  `rules/<name>.md`, the name's words joined by hyphens.

It reports any other item, and a surface held at neither the merge base nor
the head, as not checked.

## Running the fixtures

Run the issue-contract scenarios locally with:

```bash
pnpm run test:issue-contracts
```

Most fixtures are snapshot tables that call `decideIssueContract` directly with
the snapshot the adapter would fetch, and assert the exact exit status, label
changes, and feedback write. Adapter fixtures invoke the same trusted trigger interface as GitHub Actions
with Postern's injected fetch transport. They cover event parsing,
pagination, the role lookups, the bounded wait for a readiness trigger's
timeline event, complete ordered write payloads, exact stdout and stderr, and
exit outcomes. A missing reviewer role (404) follows normal authorization and
grants no readiness; unavailable roles reach the fail-closed decision and its
cleanup writes. Regression fixtures cover edited approved Agent Briefs and
direct contracts, body and revision-metadata edits, both readiness labels,
lookup recovery followed by fresh review, and cleanup mutation failures.
Other failed or unavailable prerequisite reads fail closed before any mutation.
Separate fixtures cover closed-issue edits and comments,
a stale open event whose current issue is closed, changed-contract reopening,
and reopening without a workflow state. Entrypoint fixtures cover the path
fallback for releases without `import.meta.main`. The wait fixtures
inject the adapter's pause function, whose production default is
`setTimeout` from `node:timers/promises`, so they use no real time. They also show that importing
the validator runs no adapter and, where `import.meta.main` exists, makes no
file-system or network call; without it, an import only resolves the compared script paths,
returning false when no script argument exists and throwing when a supplied
script or module path cannot be resolved. One executes the validator from an
installed layout containing only the command, trigger, policy modules,
shared runtime and declared parser and Postern resources.
Together they exercise the four public forms, native contracts,
Agent Brief discussion pagination, parent and blocker relationships, planning
labels, placeholder failures, readiness removal, workflow-state replacement,
superseding states, and return to review for triaged and direct contracts,
the same decision from any trigger on the same state, every readiness and
workflow-state row deciding nothing more on the state its own writes produced,
repeat-safe feedback,
timeline lag behind a fresh readiness label, including lag that ends at another
reviewer's application of either readiness label,
corrections, direct and Agent Brief revision changes, authorized and unauthorized
actors, stale and repeated events, native creation by authorized and
unauthorized openers in either run order,
preservation of unauthorized-reviewer reasons across timeline catch-up, cleanup,
and repeated events, their
replacement by later review or contract edits,
readiness removal and re-add
ordering across paginated issue events, the one timeline ordering rule,
contract edits, pull request exclusion, first state assignment to bare open
issues, the validator's fallback applied after a creation review in either run
order, and closed-issue cleanup of workflow-state and factory labels without
further context reads (including an open event whose fetched issue is closed),
readiness invalidation when a changed contract is reopened, and hostile Markdown
that must remain inert. Run
`node --test test/issue-contract-triage-readiness.test.mjs` for the factory
triage path: approval with a matching result, refusal without one, for another
revision, or for an issue the same or an unnamed run wrote, person readiness
either way, and the configuration reader. Run
`node --test test/issue-contract-review-attestation.test.mjs` for the factory
review attestation: producing and verifying it, the shared attestation reader,
approval of a ticket and a specification after a notice names it, each
refusal, an approval ending with a deleted or edited attestation or a body
edit, person readiness, no configuration, the v4 reader, the literal fixtures,
and the platform route through the adapter and the readiness command. Run `node --test test/issue-contract-footprint.test.mjs` for the footprint
fields, an approved contract keeping readiness with rejected items, the tally, and the supersession refusal in both the validator and the
readiness command, with fated, unfated, closed and ADR-citing issues.
Run `node --test test/issue-contract-result.test.mjs` for the published
result: its complete v1 line, its write on every evaluated event, each rule
above, and unknown formats and other authors. Its shared examples run the
validator's adapter and the `triage` readiness command against one in-memory
issue through Postern: edited, deleted and newer Agent Briefs, Briefs and
results by bot and other authors, a bot reviewer without a role, and events in
the same second. Run `node --test test/issue-contract-feedback.test.mjs` for
the notice's layout under each outcome and a refusal's shortened lead reason.
The `CI` workflow runs the complete repository test suite
with `pnpm test`. These fixtures exercise the authorization mechanism but do not
claim that a reviewer made a sound semantic judgment.

## Shared validator and platform access

The trusted `.github/scripts/validate.mjs issue-contract` trigger normalizes
the GitHub event with Postern's `issueTracker.issueEvent` and calls the common
`vendor/repo-canon/validate.mjs` interface. The decision consumes neutral event facts;
current issues, comments, label changes, edit times and relationships come from
Postern's ports. Repository roles come from Access. Every read completes before
label or feedback mutation. Failed prerequisite reads abort without writing;
role lookup errors are recorded in the snapshot so unavailable authority cannot
prevent readiness invalidation once the contract and timeline have been read.

GitHub advertises native parent and blocker capabilities. Only those links
count as relationships. `Parent` and `Blocked by` sections retain their content
requirements; links in those sections alone do not create relationships. The
connection supplies `relationshipSections: { parent: "Parent", blockedBy: "Blocked by" }`
for ports that use named sections.

For a standalone run, `node vendor/repo-canon/validate.mjs <neutral-input.json>` reads
a neutral object with `kind: "issue-contract"`, a Postern repository identity
or remote URL in `repository`, and a normalized `event`. The command uses
`POSTERN_TOKEN` as its supplied credential. At `runner`, run it with the
runner account's token; it posts the same versioned result as the workflow.
Set `REPO_CANON_RUNNER_ACCOUNT` to that account so readers accept it. Event
delivery and scheduling remain the caller's responsibility. The trusted GitHub trigger instead
passes its workflow credential and normalized event to the same dispatch
interface. Neither path substitutes a later event snapshot for current port
reads. The PR metadata path uses `kind: "pr-metadata"` and
`pullRequest: { title, body }`.

### Runner evaluation

Repo Canon's `repo-canon-issue-contract` repository dispatch has no receiver at
`runner`. The cutoff operator's `evaluate` and `activate` commands refuse it;
use the existing off-Actions validator for evaluation.

From a trusted checkout of the destination's default branch with Node.js
installed, save this as `neutral-input.json`. Replace `example/repository`,
issue `42` and `contract-runner[bot]` with the destination, issue number and
actual acting account. Set `actor.bot` to match that account's type. This is the
same neutral `edited` event synthesized by the repository-dispatch adapter;
it fabricates no readiness transition:

```json
{
  "kind": "issue-contract",
  "repository": "https://github.com/example/repository",
  "event": {
    "platform": "github",
    "repository": "example/repository",
    "issue": 42,
    "kind": "edited",
    "actor": { "login": "contract-runner[bot]", "bot": true },
    "label": null,
    "openingLabels": null,
    "bodyChanged": null,
    "comment": null
  }
}
```

Supply the runner account's token through `POSTERN_TOKEN`, then run:

```sh
node vendor/repo-canon/validate.mjs neutral-input.json
```

The token needs the issue, relationship, role and source reads used by validation,
Issues write for feedback and labels, and Contents write for active body-mode
ledger records. Readers accept the result only when the repository variable
`REPO_CANON_RUNNER_ACCOUNT` names that account. The validator uses its acting
login and does not read the variable.

Inspect that account's feedback comment on the issue: its
`repo-canon:issue-contract-state` line must name the current contract revision
and source; in body mode, also check the current observation and any publication
proof association. The [published-result contract](#published-result) describes
the versioned fields. The cutoff operator's `inspect --repo OWNER/REPO --issue 42`
also reports the trusted account, notice and body-mode observation freshness.
Evaluation itself neither approves a contract nor activates body mode: existing
review, notice and readiness-event requirements still apply. At `self-reported`,
this procedure adds no result producer; readiness remains with the owner.

The exact [published Postern bundle](../../vendor/postern/README.md), license
and provenance are installed resources, shared by both validator paths and
`babysit`. Updating the version is a reviewed source change, and adopters
install no runtime package. Contract revision serialization is unchanged.

## One-time closed-issue sweep

After delivery, the orchestrating agent runs the source checkout's command in
each adopting repository, supplying every destination explicitly. It uses only
the currently authenticated GitHub CLI credential, with issue read/write access:

```sh
node scripts/sweep-closed-issue-labels.mjs --repo OWNER/REPO --dry-run
node scripts/sweep-closed-issue-labels.mjs --repo OWNER/REPO --apply
```

Repeat `--repo OWNER/REPO` for multiple repositories. Both an explicit repository
and exactly one mode are required; no checkout remote or `GH_REPO` selects a
destination. Dry run lists the exact proposed removals by repository and issue
without writes. Execution reports each successful removal. Both modes print
per-repository scanned, needing-cleanup, removed-label and failure counts.
Any failure yields exit status 1; otherwise the command exits 0. A permission
refusal stops the whole run immediately, without another mutation or identity;
follow the planning rules' owner-question handoff. Other failures are
reported and remaining issues and repositories are processed.

The sweep enumerates all closed issues through the platform adapter's paginated
listing, then fetches each issue again. Issues reopened since listing stay
untouched. Closed issues use `decideIssueContract`'s same cleanup decision as the
live workflow; already-clean issues cause no writes, and repeat execution is
safe. Reopening restores none of the removed labels; normal open-issue
validation can add `state:triage`. The sweep never rewrites feedback or adds
labels. Like live handling, its writes follow the fetched state; a later
concurrent reopening is outside that snapshot.

Run `node --test test/sweep-closed-issue-labels.test.mjs` for dry-run output,
execution, preserved labels, reopened issues, repeat runs, partial failures,
permission refusal and explicit-target/mode fixtures. These tests use disposable
tracker state and perform no live adopter sweep.
