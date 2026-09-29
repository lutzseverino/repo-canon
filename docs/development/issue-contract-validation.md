# Issue contract validation

The `Issue contracts` workflow validates issue structure from the repository's
trusted default-branch code. It runs for issue body and label changes and for
created, edited, or deleted issue comments. Pull request comments are ignored.
The workflow checks out the default branch explicitly and treats issue and
comment Markdown only as data.

The validator is one file. It exports `decideIssueContract`, a synchronous
decision that reads one snapshot and returns the label changes, the feedback
comment write, and the exit status, with no network or file access. Its GitHub
adapter runs only when the workflow executes the file: it fetches the complete
snapshot before deciding, then applies the returned writes. One timeline helper
inside the decision answers every question about whether one issue event came
after another, and it orders events by one rule: the timeline's order decides
when GitHub has recorded both events. Timestamps are used only for what has no
timeline position (the feedback comment, Agent Brief comments, and a label
change the timeline has not recorded yet) and to recognize labels applied at
creation. Agent Brief comments are ordered among themselves by comment ID: the
latest Agent Brief is the Brief comment with the highest comment ID, for both
the contract lookup and a deleted Brief.

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
run needs the timeline to record the opener applying it in the issue's creation
second, and the opener to hold an authorizing role; otherwise it is decided as
any later review. Once the timeline holds the creation label event, either run records it
as the review, so both orders end with the same labels and recorded review.
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
readiness, readiness never dispatches work, and an open blocker still prevents
implementation even when the ticket remains sufficiently specified.

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
pagination, the role lookups, the order of writes, the exit status, unavailable
endpoints, and the path fallback for releases without `import.meta.main`. They
also show that importing the validator runs no adapter and, where
`import.meta.main` exists, makes no file-system or network call; without it, an
import only resolves the two compared paths. One executes the validator from an
installed layout containing only the validator, shared runtime, and declared
parser resources.
Together they exercise the four public forms, native contracts,
Agent Brief discussion pagination, parent and blocker relationships, planning
labels, placeholder failures, readiness removal, workflow-state replacement,
superseding states, and return to review for triaged and direct contracts,
repeat-safe feedback,
corrections, direct and Agent Brief revision changes, authorized and unauthorized
actors, stale and repeated events, native creation in either run order,
readiness removal and re-add
ordering across paginated issue events, the one timeline ordering rule,
contract edits, pull request exclusion, and hostile Markdown that must remain
inert. The `CI` workflow runs the complete repository test suite with
`npm test`. These fixtures exercise the authorization mechanism but do not
claim that a reviewer made a sound semantic judgment.
