# Issue contract validation

The `Issue contracts` workflow validates issue structure from the repository's
trusted default-branch code. It runs for issue body and label changes and for
created, edited, or deleted issue comments. Pull request comments are ignored.
The workflow checks out the default branch explicitly and treats issue and
comment Markdown only as data.

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

For an unedited direct specification or ticket, an authoritative `opened` event
carrying exactly one readiness label can supply the initial review snapshot.
Every later review, and every Agent Brief review, starts after the validator
publishes the exact revision in its feedback comment; the reviewer then applies
a readiness label. This notice-first sequence avoids relying on GitHub's
second-resolution edit and label timestamps to order otherwise ambiguous events.
The feedback comment's authoritative `updated_at` must strictly precede the
review label event; a same-second attempt is rejected and must be reapplied.
The validator re-fetches the issue, complete discussion, complete issue-event
timeline, relationships, and direct-body edit revision before every decision.
It binds approval to the actor and ID of the latest transition for the current
readiness label. A removal therefore invalidates the old event even if another
label is added before its workflow runs. A delayed removal or repeated webhook
cannot overwrite a genuinely newer approval. The recorded transition barrier
and position in the authoritative timeline establish that the selected label
event follows the exact revision. Stale webhook payloads cannot supply the actor
or restore an older association.
If deleting a newer Agent Brief reveals an older previously approved Brief, the
deletion event is recorded as a source invalidation. The restored source needs a
new revision notice and review; replaying that deletion after renewed approval
does not revoke it again, and deleting an older superseded Brief does not affect
the current source.
The workflow's per-issue concurrency group serializes validator runs, so a run
holding an older comment snapshot cannot overlap and overwrite a newer approval
recorded by another run.

The event actor is authorized only when GitHub reports the repository `admin`,
`maintain`, or `triage` role. The triage role is the explicit authorization for
a triaging agent. A `write` role, `author_association`, login shape, bot identity,
heading, preamble, or structural pass supplies no authority. An accepted
triaged review replaces its previous workflow state with the chosen readiness
label. Removing readiness returns a triaged request to `needs-triage` unless it
already has another non-readiness state. Wayfinder maps and children reject
readiness labels because their native eligibility uses open state, assignment,
and blockers instead of the readiness workflow.

Incomplete, edited, replaced, stale, unauthorized, or multiply-ready contracts
lose `ready-for-agent` and `ready-for-human`. Corrections update the same comment
with a new revision and require fresh review. Structural success never grants
readiness, readiness never dispatches work, and an open blocker still prevents
implementation even when the ticket remains sufficiently specified.

The workflow needs `contents: read` to load trusted code and `issues: write` to
read issue context and maintain labels and comments. GitHub's metadata access
must expose collaborator roles, and `GITHUB_GRAPHQL_URL` must be available for
direct-body edit revisions; both are standard GitHub Actions facilities. Node.js
24 is the runtime.
GitHub Actions does not expose issue-dependency changes as an `issues` workflow
activity type, so the validator observes the latest relationships on each
supported issue or comment event.

## Running the fixtures

Run the issue-contract scenarios locally with:

```bash
npm run test:issue-contracts
```

The fixtures invoke the same executable boundary as GitHub Actions against a
local HTTP server. They exercise the four public forms, native contracts,
Agent Brief discussion pagination, parent and blocker relationships, planning
labels, placeholder failures, readiness removal, repeat-safe feedback,
corrections, direct and Agent Brief revision changes, authorized and unauthorized
actors, stale and repeated events, native creation, readiness removal and re-add
ordering across paginated issue events, contract edits, pull request
exclusion, and hostile Markdown that must remain inert. The `CI`
workflow runs the complete repository test suite with `npm test`. These fixtures
exercise the authorization mechanism but do not claim that a reviewer made a
sound semantic judgment.
