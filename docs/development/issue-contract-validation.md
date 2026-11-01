# Issue contract validation

The `Issue contracts` workflow validates issue structure from the repository's
trusted default-branch code. It runs when issues open, reopen, or close, for
issue body and label changes, and for created, edited, or deleted issue comments.
Pull request comments are ignored.
Its `validate` job runs on `ubuntu-latest` unless the `REPO_CANON_RUNS_ON`
variable names other runner labels as a JSON array. Unset or empty keeps the
hosted default; the [runner rules](../../rules/github-repository-configuration.md#installed-workflow-runners)
describes prerequisites, inheritance, and fallback.
The workflow checks out the default branch explicitly and treats issue and
comment Markdown only as data.

The adapter fetches the issue itself before reading its discussion, timeline,
relationships, edit revision, or actor roles. If that fetched issue is closed,
it removes `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`
and every `factory:*` label, then skips validation with exit status 0.
It preserves `wontfix` as the closure outcome, category, `model:*`, unrelated
labels and the feedback comment. An already-clean issue causes no writes.
Discussion, timeline, relationships, edit revision, and roles are not fetched.
This applies to every issue kind, Wayfinder included, and every close reason.
The fetched state decides this path whatever the trigger, even when the
triggering event says the issue was open.

The validator is one file. It exports `decideIssueContract`, a synchronous
decision that reads one snapshot and returns the label changes, the feedback
comment write, and the exit status, with no network or file access. Its closed
path needs only the fetched issue, and its open path needs the contract snapshot.
The file also exports `readinessTriggerUnrecorded`, a pure predicate over the same
snapshot. Its
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
Agent Brief comments are ordered among themselves by comment ID: the latest
Agent Brief is the Brief comment with the highest comment ID, for both the
contract lookup and a deleted Brief.

The validator recognizes these contracts, and the
`github-repository-configuration` rules state the Agent Brief and Wayfinder
shapes for adopters:

- bug and feature request forms, including optional unanswered fields;
- specification forms and native specifications;
- implementation forms and native tickets, with an optional parent;
- triaged requests whose latest Agent Brief uses the upstream AI preamble, with
  the `Agent Brief` heading directly after it and any triage notes below the
  brief;
- Wayfinder maps, whose initial `Decisions so far` section alone may be empty;
  and
- Wayfinder children with exactly one planning label and a parent map.

Heading levels and casing do not affect recognition. Required fields reject
empty content, template comments, and GitHub's `_No response_` placeholder.
The validator uses the repository's pinned Marked and parse5 resources so
contract syntax in fenced or indented code, inline code, and HTML comments
remains example content, and required fields are evaluated by their rendered
visible content. For category-labeled triaged requests, the latest Agent Brief
is the contract and contract-like headings in the intake body remain context.
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

Triaged bug and feature requests must carry exactly one category (`bug` or
`enhancement`); the validator settles their workflow state, as described under
[workflow state](#workflow-state). Direct specifications and implementation
tickets do not need intake categories or an Agent Brief. Wayfinder planning
labels remain separate from intake labels.

## Published result

The validator's result on an issue is its feedback comment: the latest comment
by `github-actions[bot]` containing `<!-- repo-canon:issue-contract-feedback -->`.
Its second line, `<!-- repo-canon:issue-contract-state {…} -->`, holds one JSON
object in a published format. The factory reads that result instead of
interpreting contracts, as
[ADR 0029](../adr/0029-make-the-validators-posted-result-the-only-contract-decision.md)
decides, and the `triage` readiness command reads it through the validator's
exported `issueContractResult`. A marked comment by any other account, person
or bot, is not a result.

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
- Only the `admin`, `maintain` and `triage` roles authorize readiness, as the
  [readiness roles](../../rules/github-repository-configuration.md#readiness-roles)
  rules state.
- The result names the readiness label it approves.

The validator and the readiness command also read the earlier line without
`format`, which the next evaluation replaces. Such a line under a "needs
attention" or "structure corrected" notice carried an earlier state forward;
it is read as `needs-attention` or `no-contract` and approves nothing.

## Feedback and readiness

The validator maintains one marked feedback comment, which holds its
[published result](#published-result). Incomplete contracts list the structural
corrections there, under a `needs-attention` result that approves nothing and
records no revision. It carries forward only the source invalidation, so a corrected
contract's revision is published again before readiness is applied. A later
structural pass replaces a "needs attention" notice with a "structure
corrected" notice; an issue that no longer carries a contract gets a "not
required" notice. Complete specifications, tickets, and Agent Briefs publish a
`sha256:` revision and wait for authorized review. The same comment records the
reviewer, revision, and resulting readiness state after an accepted review
event, so repeated workflow events can verify the association without
reapproving or duplicating feedback. Every result also records the latest
readiness-label transition it observed. Approved state records the exact GitHub
issue-event ID that supplied the review. The observed transition is the latest
readiness transition other than the validator's own removal of readiness, so
the run after that cleanup records the same one.

Every readiness rejection records its reason, such as an unauthorized
reviewer's "is not authorized to grant readiness", and so does a workflow state
that supersedes a review. Once a run has recorded that rejection, later runs
retain the reason while the contract revision is unchanged and no new readiness
transition has occurred. If the opening run rejected from its payload before
the timeline recorded the opener's creation label, that label appearing later
does not replace the reason. Timeline recognition of the opener's creation label
requires its application in the same second the issue was created. The bot's
removal of readiness as rejection cleanup also retains the reason.

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
`ready-for-agent` or `ready-for-human` by a sender other than
`github-actions[bot]`. It is checked against the readiness label its re-fetched
issue carries: its own label when present, and otherwise the other readiness
label. A sender who swaps one readiness label for the other leaves the trigger's
own label gone, and the label the issue carries is the one a lagging timeline
could attribute to another reviewer. When the issue carries both, the trigger's
own label is checked, and the decision rejects the two labels. The timeline
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
heading, preamble, or structural pass supplies no authority.

Wayfinder maps and children reject readiness labels because their native
eligibility uses open state, assignment, and blockers instead of the readiness
workflow, and the validator never adds a workflow state to them.

On open issues, incomplete, edited, replaced, stale, unauthorized, or
multiply-ready contracts lose `ready-for-agent` and `ready-for-human`.
Corrections update the same comment with a new revision and require fresh
review. Structural success never grants readiness, and the validator never
starts work; the factory picks up ready issues. Reopening an issue whose contract
changed while closed removes readiness and requires fresh review.

The workflow needs `contents: read` to load trusted code and `issues: write` to
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
state label the issue should carry and removes the others. Intake forms, triaged
requests, direct specifications and tickets, and unrecognized issues all use
workflow states. Wayfinder maps and children, including ones that fail structure,
never gain a workflow state. Pull requests remain ignored. The number of
workflow states is never a structural error.

- A carried readiness label that is authorized and bound to the current
  revision, as an active approval or a valid grant, is the state. Every
  non-readiness state labeled before its review in the event timeline, or
  applied with the issue at creation, such as a form label, is removed. A label
  applied at creation is one the issue was opened with or whose application
  carries the issue's creation timestamp. The validator's own `needs-triage`
  application (actor `github-actions[bot]`) is a fallback for a stateless issue
  and never supersedes this readiness: it is removed even when the timeline
  records it after the review. This also handles an opening run that read a
  bare snapshot and wrote its fallback after an authorized creation review.
- A non-readiness state applied after the review supersedes it, whatever its
  timestamp, except for the validator's own `needs-triage` fallback: the validator
  keeps the latest such state, removes readiness and every other state, and publishes the revision as awaiting review. A carried
  state whose application the timeline has not recorded counts as later than
  every recorded event only when its latest recorded change is a removal or
  nothing. A label the issue was opened with is the exception.
- Readiness that fails authorization or revision binding is removed and its
  rejection recorded. A structural failure removes readiness and lists its
  errors.
- Among non-readiness states, the one applied latest in the timeline stays.
  Several whose applications the timeline has not recorded cannot be ordered,
  so they all stay until a later run reads a timeline that orders them.
- An open issue left with no workflow state gets `needs-triage`, whether or not
  it has carried one before, on any trigger. Opening and reopening a bare issue
  therefore need no special case. The run keeps the recorded review state,
  so its rewritten result records the same decision and readiness applied
  afterwards at the same revision is decided as if `needs-triage` had never been
  removed. Removing readiness, or losing it to invalidation, therefore returns a
  contract, or an unrecognized issue such as a contract edited until no contract
  heading remains, to `needs-triage` unless another non-readiness state remains.

One lagging case is accepted as recorded, for workflow state. A state label
removed and reapplied while the timeline records neither change is ordered at
its earlier recorded application. Settlement can then remove the reapplied
label in favor of another carried state, or order it before a review. This
needs two workflow states carried at once and a removal and reapplication
inside the timeline's lag. An issue normally carries one state; two can coexist
before a run settles a new label, or when the validator restores `needs-triage`
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
that must remain inert. Run `node --test test/issue-contract-result.test.mjs` for the published
result: its complete v1 line, its write on every evaluated event, each rule
above, and unknown formats and other authors. Its shared examples run the
validator's adapter and the `triage` readiness command against one in-memory
issue through Postern: edited, deleted and newer Agent Briefs, Briefs and
results by bot and other authors, a bot reviewer without a role, and events in
the same second. The `CI` workflow runs the complete repository test suite
with `pnpm test`. These fixtures exercise the authorization mechanism but do not
claim that a reviewer made a sound semantic judgment.

## Shared validator and platform access

The trusted `.github/scripts/validate.mjs issue-contract` trigger normalizes
the GitHub event with Postern's `issueTracker.issueEvent` and calls the common
`scripts/validate.mjs` interface. The decision consumes neutral event facts;
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

For a standalone run, `node scripts/validate.mjs <neutral-input.json>` reads
a neutral object with `kind: "issue-contract"`, a Postern repository identity
or remote URL in `repository`, and a normalized `event`. The command uses
`POSTERN_TOKEN` as its supplied credential. The trusted GitHub trigger instead
passes its workflow credential and normalized event to the same dispatch
interface. Neither path substitutes a later event snapshot for current port
reads. The PR metadata path uses `kind: "pr-metadata"` and
`pullRequest: { title, body }`.

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
follow the contribution guide's owner-question handoff. Other failures are
reported and remaining issues and repositories are processed.

The sweep enumerates all closed issues through the platform adapter's paginated
listing, then fetches each issue again. Issues reopened since listing stay
untouched. Closed issues use `decideIssueContract`'s same cleanup decision as the
live workflow; already-clean issues cause no writes, and repeat execution is
safe. Reopening restores none of the removed labels; normal open-issue
validation can add `needs-triage`. The sweep never rewrites feedback or adds
labels. Like live handling, its writes follow the fetched state; a later
concurrent reopening is outside that snapshot.

Run `node --test test/sweep-closed-issue-labels.test.mjs` for dry-run output,
execution, preserved labels, reopened issues, repeat runs, partial failures,
permission refusal and explicit-target/mode fixtures. These tests use disposable
tracker state and perform no live adopter sweep.
