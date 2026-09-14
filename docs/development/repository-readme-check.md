# Repository README check

`operations/check-repository-readme.mjs` is the read-only structural check for
the [Repository README guidance](../../drafts/guidance/repository-readme.md). It consumes
`repo-standards/operation/v1` on standard input, accepts only a checks operation
whose allowed target is the root `README.md`, and returns one
`repo-standards/result/v1` object on standard output.

The operation requires Node.js 24. Its integration metadata is `node` with
`["--version"]`, version range `>=24.0.0 <25.0.0`, no retained resources, and a
30-second timeout. Ticket #15 owns the final declaration and profile wiring.

The result statuses have distinct meanings:

- `passed` means the checked structure is valid. Descriptions, badges, commands,
  license facts, and prose still need maintainer or agent review.
- `failed` is a policy failure with concrete corrections, such as centering the
  title, restoring section order, or fixing the License link. It is returned by
  a successful process so Repository Standards can collect ordinary check
  evidence.
- `blocked` means a missing, multiple, or unnamed root license file requires
  owner clarification. The operation does not choose a license.
- A malformed request or an unexpected target writes an error to standard error,
  exits nonzero, and emits no result. Repository Standards records that as a
  process or protocol error rather than a policy result.

For the License check, a conventional root license file named `LICENSE`,
`LICENCE`, or `COPYING`, optionally with `.md`, `.txt`, or `.rst`, is a
candidate. Exactly one candidate must identify a license name in its first
nonempty line. The check compares the README link label and target with that
repository-provided identity; it does not make a legal or semantic licensing
judgment. An unrecognized or unclear arrangement returns `blocked` for owner
clarification.

Run the public-boundary fixtures with Node.js 24:

```sh
node --test test/repository-readme-check.test.mjs
```

The fixtures cover all recognized sections, omitted and interleaved sections,
malformed titles and license links, missing and ambiguous licensing, invalid
protocol input, and byte-for-byte preservation of the disposable project.
