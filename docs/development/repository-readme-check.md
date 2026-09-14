# Repository README check

`operations/check-repository-readme.mjs` is the read-only structural check for
the [Repository README guidance](../../guidance/repository-readme.md). It consumes
`repo-standards/operation/v1` on standard input, accepts only a checks operation
whose allowed target is the root `README.md`, and returns one
`repo-standards/result/v1` object on standard output.

The operation requires Node.js 24. Its integration metadata is `node` with
`["--version"]`, version range `>=24.0.0 <25.0.0`, retained resource directories
`vendor/marked` and `vendor/parse5`, and a 30-second timeout. It uses the
vendored Marked 18.0.13 lexer, parse5 8.0.1 fragment parser, and shared
`operations/lib/rendered-markdown.mjs` resource so structural decisions follow
one rendered Markdown and HTML representation. Ticket #15 owns the final
declaration and profile wiring.

The result statuses have distinct meanings:

- `passed` means the checked structure is valid. Descriptions, badges, commands,
  license facts, and prose still need maintainer or agent review.
- `failed` is a policy failure with concrete corrections, such as centering the
  title, restoring section order, or fixing the License link. It is returned by
  a successful process so Repository Standards can collect ordinary check
  evidence.
- `blocked` means a missing, multiple, or unnamed root `LICENSE` file requires
  owner clarification. The operation does not choose a license.
- A malformed request or an unexpected target writes an error to standard error,
  exits nonzero, and emits no result. Repository Standards records that as a
  process or protocol error rather than a policy result.

For the License check, the root `LICENSE` file must exist and contain content,
and the README section must contain only a link with a nonempty label targeting
that file. Whether the label names the actual license remains a maintainer or
agent semantic judgment. A missing, empty, or ambiguous set of root license
files returns `blocked` for owner clarification.

Run the public-boundary fixtures with Node.js 24:

```sh
node --test test/repository-readme-check.test.mjs
```

The fixtures cover all recognized sections, omitted and interleaved sections,
Markdown and HTML heading forms, nested centering, hidden examples, table-cell
links, malformed titles and license links, missing and ambiguous licensing,
invalid protocol input, and byte-for-byte preservation of the disposable
project.
