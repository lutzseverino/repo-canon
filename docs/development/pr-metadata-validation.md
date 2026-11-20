# Pull request metadata validation

The `PR metadata validation` workflow checks a pull request title and description
whenever the request is opened, edited, synchronized, reopened, or marked ready
for review. Its stable check-run name is `PR metadata`.
Its `validate` job runs on `ubuntu-latest`. The workflow installs only at the
`github` check location; the [runner rules](../../rules/github-repository-configuration.md#installed-workflow-runners)
describe the location and the retired runner variable.

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
`# Repository Standards adoption record`, apart from trailing spaces or tabs,
claims to start with a Repository Standards adoption record, optionally followed
by issue relationship metadata. The heading counts only as that exact first
line: text, an HTML comment, or a code fence before it, indentation, another
heading level, or other wording makes the body an ordinary description,
validated as above.

A body that claims to be a record needs no Summary, Evidence, Merge Danger, or
Related issue section only when it is a complete, ready record under its
adoption title, as the
[contribution guide](../../CONTRIBUTING.md#adoption-pull-requests) describes:

- After the record heading, the only level-1 or level-2 headings are the
  level-2 sections `Ready to commit`, `Selection`, `Operations`,
  `Changed paths`, `Scope changes`, and `Identities`, each once and in that
  order, optionally followed by `Abandoned runs`, then optionally by `Impact`
  and `Migration` together, then optionally one level-2 `Related issue` section
  outside the record. That section uses the ordinary relationship content rules
  above and follows all record sections; duplicate, nested or misplaced
  relationship headings fail. Headings are recognized from rendered Markdown, as
  above, so headings in code, HTML comments, or hidden HTML do not count.
- The first block of the `Ready to commit` section is the paragraph
  `Ready to commit: yes.`
- The `Selection` section is one Markdown table, with no other content that
  could hide or replace its rows. It holds one `CLI`, one `Standards source`,
  and one `Standards version` row, each named exactly in its first cell and
  with only an inline-code value.
- The title is exactly
  `chore: adopt <name> <standards version> with CLI <cli version>`, or the
  same with `chore!:`. `<name>` is the last path segment of the
  `Standards source` value, without a trailing `/` or `.git`, and both versions
  are the `Selection` values verbatim.

Such a body never falls back to the ordinary sections: the check fails with one
error for each unmet condition, and a title mismatch names the expected title.
Without the `Selection` values, or with a `Standards source` that yields no
name, the check reports the `Selection` error instead of a title error, since
it cannot derive the expected title.
The title rules below, including `Impact` and `Migration` for `chore!:`, and the
attribution check still apply to a record. The check cannot tell whether the
record portion is the CLI's byte-preserved output or matches the repository's
`.repo-standards` state; review confirms both. The optional relationship section
is outside that preserved portion. Explicit squash merge retains the complete
PR body, including the relationship.

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
not persist credentials, and only grants `contents: read` to its token. The thin `.github/scripts/validate.mjs` trigger reads title and body values
from the event JSON and passes a neutral snapshot to the shared
`vendor/repo-canon/validate.mjs` command; it does not check out
or execute the proposed head revision. No `run:` step interpolates the pull
request title or body, so command-like values in fork metadata and descriptions
reach the validator only as data in that file; a workflow test fails if a shared
workflow interpolates either anywhere, including through a YAML alias or a
multi-line value. The workflow has no issue or pull-request write permission and
does not label, convert, or otherwise send external pull requests into
feature-request triage.

The attribution check enforces the
[commit and pull request rule](../../CONTRIBUTING.md#titles-and-commits) on the
raw title and body, including code blocks, hidden content, and adoption records.
It rejects lines starting with `co-authored-by:` after leading whitespace,
case-insensitively, regardless of the co-author's name. It also rejects lines
starting with "generated with" or "generated by", case-insensitively, after
stripping leading whitespace, Markdown markers (quotes, lists, headings, and
emphasis), and symbols such as emoji. Mentions inside sentences pass. Each
failure identifies the line's kind and its location, asks for its removal, and
cites the rule. The patterns and errors name no tool; session links remain a
review responsibility. The
[babysit merge script](babysit-merge.md) supplies the validated metadata as an
explicit squash message so GitHub does not add its own trailers.

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

On public repositories, that setup also manages the active
`Repo Canon PR metadata events` Actions policy, allowing `pull_request_target`
for `.github/workflows/pr-metadata.yml` after GitHub's default event block.
It creates a missing policy, asks before changing existing enforcement,
workflow conditions or event rules, preserves other entries and policies, and
reads the result back. A refusal or unsupported policies API returns `blocked`
with its redacted reason; it never changes the trigger. Private and internal
repositories receive no policy requests, and an absent default-branch workflow
defers the policy with the check. Enterprise or organization Actions policies
can still block execution, which repository-level readback cannot detect.
The setup document's [policy section](github-pr-integration-setup.md#public-repository-actions-event-policy)
describes the shape, reconciliation and failure handling.

Run the executable checks with Node.js 24 or 26:

```sh
node --test test/pr-metadata.test.mjs test/shared-workflows.test.mjs
pnpm run check
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

## Entry points outside Actions

The installed neutral command runs with Node.js 24 or 26 and no npm install;
check-command input also needs Git on `PATH`:

```sh
node vendor/repo-canon/validate.mjs neutral-input.json
```

Supply the posting token through `POSTERN_TOKEN` in the entry point's
environment, never in the JSON file. Both posting paths need the repository's
**Commit statuses: write** permission; PR metadata also needs **Pull requests:
read**. GitHub documents the [commit status endpoint](https://docs.github.com/en/rest/commits/statuses#create-a-commit-status).
The repository URL selects the destination explicitly; no CLI credential or
repository discovery occurs.

### PR metadata posting

Use a pull request number to read its current title, body and head, apply the
same validation described above, and post one `PR metadata` status on that
head:

```json
{
  "kind": "pr-metadata",
  "repository": "https://github.com/example/project",
  "pullRequest": 42
}
```

A valid title and body post `success` and return exit 0; an invalid title or
body posts `failure` and returns exit 1. The result belongs to the head read
with that metadata, even if the pull request changes during validation.

The existing snapshot input remains available without a token or repository:

```json
{
  "kind": "pr-metadata",
  "pullRequest": { "title": "feat: describe the change", "body": "..." }
}
```

It validates only the supplied title and body and posts nothing. The Actions
trigger continues to use its `pull_request_target` snapshot and job check.

### Check command posting

Pass the exact full head SHA, an existing checkout, the repository's one check
command from its development guide, and the caller's role:

```json
{
  "kind": "check-command",
  "repository": "https://github.com/example/project",
  "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "checkout": "/work/project",
  "command": "pnpm validate",
  "role": "runner"
}
```

`checkout` is absolute or relative to the entry point's working directory.
Its Git `HEAD` must equal `head`; a mismatch refuses before posting or running
anything. The command runs through the system shell in that checkout, with
its output inherited by the entry point. No command setting is added: the
caller supplies the command documented by the adopting repository.

| Role     | Posted context  |
| -------- | --------------- |
| `runner` | `Runner checks` |
| `review` | `Review rerun`  |

The entry point posts `pending` before execution, then `success` for exit 0 or
`failure` for any other exit, signal or launch failure, all on the requested
head. Its own exit is 0 for success and 1 for failure. A failed platform read
or status write fails the invocation; a refused pending write prevents command
execution.

The command inherits the environment except `POSTERN_TOKEN` and every variable
whose value equals the posting token. This also removes a second copy under
another name; other variables pass through unchanged. The filter covers only
the command's environment: the command runs as the entry point's operating
system user, so it can still read the entry point's own process environment,
for example through `/proc/<pid>/environ` on Linux. The runner host remains
responsible for credentials stored elsewhere and for running the trusted entry
point independently of the pull request's command.

Run `node --test test/validator-statuses.test.mjs test/validator-entrypoints.test.mjs`
for HTTP-boundary fixtures, disposable Git checkouts, token isolation and
installed-layout coverage alongside the unchanged snapshot entry points.

The common command dispatches `pr-metadata`, `issue-contract` and
`check-command`. The trigger
invokes its exported neutral interface so raw event data stays outside policy.
Postern supplies issue-event normalization, not a PR-event operation. Its exact
[public bundle, license and provenance](../../vendor/postern/README.md) are
declared alongside the consumers; installation resolves every import without npm.
