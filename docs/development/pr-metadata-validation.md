# Pull request metadata validation

The `PR metadata validation` workflow checks a pull request title and description
whenever the request is opened, edited, synchronized, reopened, or marked ready
for review. Its stable check-run name is `PR metadata`.

Unless it is an adoption record, described below, the description must contain
exactly one meaningful `Summary`, `Evidence`, `Merge Danger`, and `Related issue`
Markdown section. Heading level, emphasis, trailing colons, and letter casing
do not affect recognition. HTML comments, placeholders such as `TODO`, `TBD`, `N/A`,
`Not applicable`, and `None`, rendered-empty HTML, and content inside HTML
elements with the `hidden` attribute do not count as content.
Punctuation alone does not count either. Headings inside fenced code examples do
not define sections. Code contents can describe summaries, evidence, and merge
danger, but fence delimiters and language info do not count as content.
Validation belongs in Evidence, and relevant limits belong in Merge Danger.
Section order and subsections follow the
[contribution guide](../../CONTRIBUTING.md#pull-requests) and are reviewed
rather than checked.

`Related issue` accepts a GitHub issue URL, `owner/repository#123`, or `#123`.
A Direct change can instead use `Direct change: reason` with any
meaningful reason: visible text outside code, from the marker to the end of
the section, that holds at least two words, each a run of letters or numbers,
and is not a placeholder. Summary, Evidence, and Merge Danger apply the same
word and placeholder test, but their code contents count. An empty reason, a
placeholder such as `TODO` or `N/A`, a one-word reason, or a reason only in code fails.
A Direct change is work without a ticket, as defined in the
[contribution guide](../../CONTRIBUTING.md#pull-requests); the check does not
restrict the reason to particular kinds of change.
References in code examples, HTML comments, and unrelated HTML attributes do not
count. References inside HTML elements with the `hidden` attribute do not count.
A GitHub issue URL used as a visible Markdown or HTML link destination does count.

A body whose first line, after any blank lines, is exactly
`# Repository Standards adoption record`, apart from trailing spaces or tabs, is
a Repository Standards adoption record, a complete body for an adoption or
update pull request. It needs no Summary, Evidence, Merge Danger, or Related
issue section, and the title rules below still apply. The heading counts only
as that exact first line: text, an HTML comment, or a code fence before it, indentation,
another heading level, or other wording makes the body an ordinary description,
validated as above.

Titles use `type(scope): description`, with an optional scope and an optional
`!` immediately before the colon. The allowed lowercase types are `feat`,
`fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, `chore`, and
`revert`. The description must contain a letter or number and must not end in a
period; a concise one-word description is valid. When `!` is present, the body
must explain both `Impact` and `Migration` under headings or labeled lines. An
explicit `BREAKING CHANGE:` footer also requires `!` in the title. Reviewers
remain responsible for title semantics and type accuracy, the truth of validation
claims, and whether a change is breaking. Hidden HTML cannot supply the required
impact or migration explanations.

The validator consumes the shared pure rendered-Markdown document installed at
`operations/lib/rendered-markdown.mjs`. That module owns visibility, rendered
text and links, heading provenance, and section regions. PR policy remains in
the validator: recognized section names use rendered Markdown headings,
matching-section nesting and duplicate rules remain PR-specific, visible code
can supply Summary, Evidence, and Merge Danger content, and code cannot supply
relationship or Direct change reasons. HTML `title` content remains visible for
PR metadata, and parse5's fragment handling continues to expose text from a bare `head`
wrapper as body text.

The workflow uses `pull_request_target` so GitHub loads its definition from the
base repository. It checks out the pull request's base commit explicitly, does
not persist credentials, and only grants `contents: read` to its token. The
validator reads title and body values from the event JSON; it does not check out
or execute the proposed head revision. No `run:` step interpolates the pull
request title or body, so command-like values in fork metadata and descriptions
reach the validator only as data in that file; a workflow test fails if a shared
workflow interpolates either anywhere, including through a YAML alias or a
multi-line value. The workflow has no issue or pull-request write permission and
does not label, convert, or otherwise send external pull requests into
feature-request triage.

The validator has no package dependencies, so the job installs none and
disables the Node.js setup action's automatic package-manager cache. A
repository whose `package.json` selects a package manager other than npm
therefore does not need that package manager installed on the runner.

Repository setup can require the `PR metadata` check alongside existing checks.
The setup operator needs permission to edit the target branch rule or ruleset;
the workflow itself does not need that permission. GitHub runs a
`pull_request_target` workflow only from the default branch, so the check first
reports on pull requests opened after the workflow merges there; the
[PR integration setup](github-pr-integration-setup.md) defers requiring it
until then.

Run the executable checks with Node.js 24:

```sh
node --test test/pr-metadata.test.mjs test/shared-workflows.test.mjs
npm run check
```

The focused fixtures include an installed-layout execution containing only the
validator, shared runtime, and declared parser resources, each installed from
its `standards.yaml` declaration. The project has no compilation step or
external runtime dependencies. CI runs the complete Node test suite for pull
requests and pushes to `main`.

The shared runtime reads Markdown structure with the repository's pinned
[Marked lexer](../../vendor/marked/README.md) and rendered HTML content and link
attributes with the pinned [parse5 bundle](../../vendor/parse5/README.md). Their
source and license notices live beside the vendored ESM files.
