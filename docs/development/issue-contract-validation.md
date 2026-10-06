# Issue contract validation

The `Issue contracts` workflow validates issue structure from the repository's
trusted default-branch code. It runs for issue body and label changes and for
created, edited, or deleted issue comments. Pull request comments are ignored.
The workflow checks out the default branch explicitly and treats issue and
comment Markdown only as data.

The validator is one file. It exports `decideIssueContract`, a synchronous
decision that reads one snapshot and returns the label changes, the feedback
comment write, and the exit status, with no network or file access, and
`readinessTriggerUnrecorded`, a pure predicate over the same snapshot. Its
GitHub adapter runs only when the workflow executes the file: it fetches the
complete snapshot before deciding, waiting within a bound for the issue-event
timeline to record a human readiness trigger, then applies the returned writes.
One timeline helper inside the decision answers every question about whether
one issue event came after another, and it orders events by one rule: the
timeline's order decides when GitHub has recorded both events. Timestamps are
used only for what has no timeline position (the feedback comment, Agent Brief
comments, and a label change the timeline has not recorded yet) and to
recognize labels applied at creation. Agent Brief comments are ordered among
themselves by comment ID: the latest Agent Brief is the Brief comment with the
highest comment ID, for both the contract lookup and a deleted Brief.

The validator recognizes these contracts:

- bug and feature request forms, including optional unanswered fields;
- specification forms and native specifications;
- implementation forms and native tickets, with an optional parent;
- triaged requests whose latest Agent Brief uses the upstream AI preamble;
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
contract before either form. A category-labeled `wontfix` outcome does not
require an Agent Brief.
Native parent and blocking relationships are read from GitHub. Explicit issue
links in rendered `Parent` and `Blocked by` section content are used
when native relationships are absent or the native dependency endpoint is
unavailable. An open blocker does not make a complete contract invalid.

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
`enhancement`) and one workflow state. Direct specifications and implementation
tickets do not need intake categories or an Agent Brief. Wayfinder planning
labels remain separate from intake labels.

## Feedback and readiness

The validator maintains one marked feedback comment. Incomplete contracts list
the structural corrections there. Complete specifications, tickets, and Agent
Briefs publish a `sha256:` revision and wait for authorized review. The same
comment records the reviewer, revision, and resulting readiness state after an
accepted review event, so repeated workflow events can verify the association
without reapproving or duplicating feedback. Awaiting-review state also records
the latest readiness-label transition it observed. Approved state records the
exact GitHub issue-event ID that supplied the review.

An unauthorized reviewer's readiness rejection records its "is not authorized
to grant readiness" reason. Once a run has recorded that rejection, later runs
retain the reason while the contract revision is unchanged and no new readiness
transition has occurred. If the opening run rejected from its payload before
the timeline recorded the opener's creation label, that label appearing later
does not replace the reason. Timeline recognition of the opener's creation label
requires its application in the same second the issue was created. The bot's
removal of readiness as rejection cleanup also retains the reason.

A creation rejection records which label the creation review rejected. A
`labeled` trigger by the issue's opener for the rejected creation label is
treated as that replay, retaining the reason even when both creation runs see
empty history. A later readiness event or a contract edit replaces the
rejection through the usual review or revision-notice path. A triggering human
readiness transition replaces it even when the timeline has not recorded that
transition yet, except for that creation-label replay. Other readiness errors,
including multiple labels, stale readiness, unverifiable authority, and
deleted-Agent-Brief invalidation, keep their existing feedback behavior, as do
plain awaiting-review notices, structural corrections, and superseding workflow
states. Feedback records from the previous validator without a rejection reason
keep the plain notice.

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
that application is positioned after the barrier. The run that wrote that feedback
already observed every application at or before the barrier, so none of them
can be this trigger. Awaiting-review feedback is only written while readiness is
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

One lagging case is accepted and not fixed. A run without a readiness label
event, such as one for a comment, an edit, or a reopening, has no trigger
identity, so for it a lagging timeline is indistinguishable from a complete one.
While one run waits, GitHub keeps only the newest pending run per issue. When
that replaces the pending run of a readiness trigger or of a removal with such a
run, the run can grant, or keep, another reviewer's earlier review that a human
removal withdrew. This needs all of these at once: a labeler without review
authority, a review withdrawn by a human removal, a lagging events endpoint, and
a superseding non-readiness event. The next run that reads a complete timeline
corrects it. Neither alternative closes it. Granting or keeping only the
label's latest recorded applicant changes nothing, because in the lagging
timeline that applicant is the withdrawn reviewer. Never granting from a
non-readiness run prevents only the grant, and removes valid labels whenever a
comment quickly follows a label.

Every later review, and every Agent Brief review, starts after the validator
publishes the exact revision in its feedback comment; the reviewer then applies
a readiness label. This notice-first sequence avoids relying on GitHub's
second-resolution edit and label timestamps to order otherwise ambiguous events.
The feedback comment's authoritative `updated_at` must strictly precede the
review label event; a same-second attempt is rejected and must be reapplied.
The validator re-fetches the issue, complete discussion, complete issue-event
timeline, relationships, and direct-body edit revision before every decision.
It also reads the repository role of every actor on a readiness-label event, of
the recorded reviewer, and of an opening event's sender. On a `labeled` run, the
opener's role is the one read for the creation label event's actor. A failed
role lookup is recorded for that login and counts as unauthorized.
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
recorded by another run.

The event actor is authorized only when GitHub reports the repository `admin`,
`maintain`, or `triage` role. The triage role is the explicit authorization for
a triaging agent. A `write` role, `author_association`, login shape, bot identity,
heading, preamble, or structural pass supplies no authority. An accepted review
of a triaged request, specification, or implementation ticket replaces every
non-readiness workflow state labeled before it in the event timeline or applied
with the issue at creation, such as a form label, so the issue keeps exactly one
workflow state. A label applied at creation is one the issue was opened with or
whose application carries the issue's creation timestamp. A non-readiness state
labeled after the review in the timeline supersedes the review instead,
whatever its timestamp: the validator keeps the latest such state as
the only workflow state, removes readiness and every other state, and publishes
the revision as awaiting review. A present state whose latest recorded change
in the event timeline is not its application also supersedes the review, so a
lagging timeline cannot delete a newly applied state. The exceptions are a label
the issue was opened with and a label that triggered the run with a payload time
before the review or at the issue's creation. A triggering label whose recorded
application precedes the review supersedes it only when the run has no payload
time or its payload time falls in a strictly later second than the review, as
when the timeline has not yet recorded a removal and re-application. A triaged
request that carries two workflow states outside a
readiness-label event also fails its label check and loses readiness. A
repeated event on an approved specification or ticket removes a state left from
before its review. Removing readiness, or
losing it to invalidation, returns such a contract to `needs-triage` unless
another non-readiness workflow state remains. An unrecognized issue that loses
readiness, such as a contract edited until no contract heading remains, returns
to `needs-triage` the same way.
Wayfinder maps and children reject readiness labels because their native
eligibility uses open state, assignment, and blockers instead of the readiness
workflow, and the validator never adds a workflow state to them.

Incomplete, edited, replaced, stale, unauthorized, or multiply-ready contracts
lose `ready-for-agent` and `ready-for-human`. Corrections update the same comment
with a new revision and require fresh review. Structural success never grants
readiness, and readiness never dispatches work.

The workflow needs `contents: read` to load trusted code and `issues: write` to
read issue context and maintain labels and comments. GitHub's metadata access
must expose collaborator roles, and `GITHUB_GRAPHQL_URL` must be available for
direct-body edit revisions; both are standard GitHub Actions facilities. Node.js
24 is the runtime. The adapter recognizes that the workflow executed the file
through `import.meta.main`; on 24 releases before 24.2, which lack it, it
compares the resolved script path with the validator's own path instead. The
validator has no package dependencies, so the job installs none and disables
the Node.js setup action's automatic package-manager cache. It pins the same
checkout and Node.js setup actions as the PR metadata workflow.
GitHub Actions does not expose issue-dependency changes as an `issues` workflow
activity type, so the validator observes the latest relationships on each
supported issue or comment event.

## Running the fixtures

Run the issue-contract scenarios locally with:

```bash
npm run test:issue-contracts
```

Most fixtures are snapshot tables that call `decideIssueContract` directly with
the snapshot the adapter would fetch, and assert the exact exit status, label
changes, and feedback write. A few adapter fixtures invoke the same executable
boundary as GitHub Actions against a local HTTP server. They cover event parsing,
pagination, the role lookups, the bounded wait for a readiness trigger's
timeline event, the order of writes, the exit status, unavailable endpoints, and
the path fallback for releases without `import.meta.main`. The wait fixtures
preload a replacement for the `setTimeout` of `node:timers/promises`, the
adapter's only wait, so they use no real time. They also show that importing
the validator runs no adapter and, where `import.meta.main` exists, makes no
file-system or network call; without it, an import only resolves the two
compared paths. One executes the validator from an
installed layout containing only the validator, shared runtime, and declared
parser resources.
Together they exercise the four public forms, native contracts,
Agent Brief discussion pagination, parent and blocker relationships, planning
labels, placeholder failures, readiness removal, workflow-state replacement,
superseding states, and return to review for triaged and direct contracts,
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
contract edits, pull request exclusion, and hostile Markdown that must remain
inert. The `CI` workflow runs the complete repository test suite with
`npm test`. These fixtures exercise the authorization mechanism but do not
claim that a reviewer made a sound semantic judgment.
