# Pull request metadata validation

The `PR metadata validation` workflow checks a pull request title and description
whenever the request is opened, edited, synchronized, reopened, or marked ready
for review. Its stable check-run name is `PR metadata`.

The description must contain exactly one meaningful `Summary`, `Validation`, and
`Related issue` Markdown section. Heading level, emphasis, trailing colons, and
letter casing do not affect recognition. HTML comments, placeholders such as
`TODO`, `TBD`, `N/A`, `Not applicable`, and `None`, rendered-empty HTML, and
content inside HTML elements with the `hidden` attribute do not count as content.
Punctuation alone does not count either. Headings inside fenced code examples do
not define sections. Code contents can describe Validation evidence, but fence
delimiters and language info do not count as content. `Limits` remains optional.

`Related issue` accepts a GitHub issue URL, `owner/repository#123`, or `#123`.
An eligible typo, broken link, or formatting correction can instead use
`Small correction: reason`, where the reason contains meaningful text.
References in code examples, HTML comments, and unrelated HTML attributes do not
count. References inside HTML elements with the `hidden` attribute do not count.
A GitHub issue URL used as a visible Markdown or HTML link destination does count.

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
can supply Validation evidence, and code cannot supply relationship or
small-correction evidence. HTML `title` content remains visible for PR metadata,
and parse5's fragment handling continues to expose text from a bare `head`
wrapper as body text.

The workflow uses `pull_request_target` so GitHub loads its definition from the
base repository. It checks out the pull request's base commit explicitly, does
not persist credentials, and only grants `contents: read` to its token. The
validator reads title and body values from the event JSON; it does not check out
or execute the proposed head revision. The hostile event fixture in the test
suite verifies that command-like values in fork metadata and descriptions stay
inert. The workflow has no issue or pull-request write permission and does not
label, convert, or otherwise send external pull requests into feature-request
triage.

Repository setup can require the `PR metadata` check alongside existing checks.
The setup operator needs permission to edit the target branch rule or ruleset;
the workflow itself does not need that permission. Let the check run once before
selecting its name in GitHub when the repository UI requires a recently observed
check.

Run the executable checks with Node.js 24:

```sh
npm run test:pr-metadata
npm run check
```

The focused fixtures include an installed-layout execution containing only the
validator, shared runtime, and declared parser resources. The project has no
compilation step or external package dependencies. CI runs the complete Node
test suite for pull requests and pushes to `main`.

The shared runtime reads Markdown structure with the repository's pinned
[Marked lexer](../../vendor/marked/README.md) and rendered HTML content and link
attributes with the pinned [parse5 bundle](../../vendor/parse5/README.md). Their
source and license notices live beside the vendored ESM files.
