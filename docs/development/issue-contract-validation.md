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
Contract syntax inside fenced code or HTML comments remains example content.
When an Agent Brief exists, the latest such comment is the triaged request's
contract; contract-like headings in the intake body remain context.
Native parent and blocking relationships are read from GitHub. Explicit issue
links outside fenced examples in `Parent` and `Blocked by` sections are used
when native relationships are absent or the native dependency endpoint is
unavailable. An open blocker does not make a complete contract invalid.

Triaged bug and feature requests must carry exactly one category (`bug` or
`enhancement`) and one workflow state. Direct specifications and implementation
tickets do not need intake categories or an Agent Brief. Wayfinder planning
labels remain separate from intake labels.

## Feedback and readiness

An incomplete contract receives one comment marked for the validator to
maintain. Later events update that comment instead of creating another one.
The validator removes `ready-for-agent` and `ready-for-human` from incomplete
contracts. If that leaves a triaged request without a workflow state, it adds
`needs-triage`. A correction updates the maintained comment and leaves
readiness for an authorized reviewer to restore.

Structural success never adds readiness or proves that a contract revision was
reviewed. Binding readiness to the exact revision and the authorized reviewer
is separate implementation work tracked by issue #8.

The workflow needs `contents: read` to load trusted code and `issues: write` to
read issue context and maintain labels and comments. Node.js 24 is the runtime.
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
corrections, pull request exclusion, and hostile Markdown that must remain
inert. The `Tests` workflow runs the complete repository test suite with
`npm test`; these fixtures do not claim semantic review or authorized revision
association.
