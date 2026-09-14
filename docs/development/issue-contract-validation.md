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
without reapproving or duplicating feedback.

The revision is computed from a versioned record containing the selected
contract kind, exact contract bytes, source identity and edit revision, and the
identities of the current native parent and blocker relationships. Direct-body
contracts use the issue GraphQL node ID and `lastEditedAt`. Agent Briefs use the
comment node ID and `updated_at`, so editing a brief or replacing it with an
identical-looking comment still changes the revision. Relationship state is
excluded: closing an existing blocker does not change readiness, while replacing
the referenced blocker does.

For a direct specification or ticket, an authoritative `opened` event carrying
one readiness label or a later readiness `labeled` event can supply the exact
review snapshot. For an Agent Brief, the validator must first publish the exact
revision in its feedback comment; the reviewer then applies a readiness label.
This ordering prevents a stale label event from approving a brief that was
edited or replaced while the event waited. The validator re-fetches the issue,
complete discussion, relationships, and direct-body edit revision before every
decision, and rejects an event whose issue snapshot no longer matches.

The event actor is authorized only when GitHub reports the repository `admin`,
`maintain`, or `triage` role. The triage role is the explicit authorization for
a triaging agent. A `write` role, `author_association`, login shape, bot identity,
heading, preamble, or structural pass supplies no authority. An accepted
triaged review replaces its previous workflow state with the chosen readiness
label. Removing readiness returns a triaged request to `needs-triage` unless it
already has another non-readiness state.

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
actors, stale and repeated events, native creation, readiness removal, pull
request exclusion, and hostile Markdown that must remain inert. The `CI`
workflow runs the complete repository test suite with `npm test`. These fixtures
exercise the authorization mechanism but do not claim that a reviewer made a
sound semantic judgment.
