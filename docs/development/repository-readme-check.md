# Repository README check

`operations/check-repository-readme.mjs` is the read-only structural check for
the [Repository README guidance](../../guidance/repository-readme.md). It consumes
`repo-standards/operation/v2` on standard input, accepts only a checks operation
whose allowed target is the root `README.md`, and returns one
`repo-standards/result/v2` object on standard output.

The operation requires Node.js 24. Its integration metadata is `node` with
`["--version"]`, version range `>=24.0.0 <25.0.0`, retained resource directories
`vendor/marked` and `vendor/parse5`, the shared rendered-Markdown and local-link
modules, and a 30-second timeout. It uses the vendored Marked 18.0.13 lexer,
parse5 8.0.1 fragment parser, and shared
`operations/lib/rendered-markdown.mjs` resource so structural decisions follow
one rendered Markdown and HTML representation. The operation keeps its
README-specific title, ordering, centering, section-body, pointer-section, and
License policies.

The result statuses have distinct meanings:

- `passed` means the checked structure is valid. Descriptions, badges, commands,
  license facts, and prose still need maintainer or agent review.
- `failed` is a policy failure with concrete corrections, such as centering the
  title, restoring section order, reducing a pointer section to its link, or
  fixing the License link. It is returned by a successful process so Repository
  Standards can collect ordinary check evidence.
- `blocked` means a missing, multiple, or unnamed root `LICENSE` file requires
  owner clarification. The operation does not choose a license.
- A malformed request or an unexpected target writes an error to standard error,
  exits nonzero, and emits no result. Repository Standards records that as a
  process or protocol error rather than a policy result.

The Contributing and Documentation sections are pointer sections to
`CONTRIBUTING.md` and `docs/README.md`. When the target file exists, a missing
section fails with a correction to add it. A present section fails unless its
rendered content is exactly one plain link resolving to its target, inside a
paragraph that may be wrapped in `div`s; a fragment or query on that link, and
emphasis inside its label, are accepted. Surrounding prose, another link, a list
of documents, a subsection, or a link outside a paragraph, inside a list,
quotation, or table, or wrapping an image each fail with a correction to
make the section contain only that link, and a link without a label fails with
a correction to name it. The License section uses the same plain-link rule. The
link-only rule applies even when the target is absent; the correction then
also offers creating the target or removing the section. HTML comments, hidden
elements, and anchors without an `href`, such as named targets, are not
rendered content, and a link wrapping the next section's heading belongs to
that heading rather than to the preceding section, including the empty anchor
that HTML parsing leaves behind when a Markdown paragraph opens that link.

For the License check, the root `LICENSE` file must exist and contain content,
and the README section must contain only a link with a nonempty label targeting
that file. Whether the label names the actual license remains a maintainer or
agent semantic judgment. A missing, empty, or ambiguous set of root license
files returns `blocked` for owner clarification.

The contextual `repository-license` declaration owns only `LICENSE`. Its
[guidance](../../guidance/repository-license.md) establishes the license decision
before this check runs: it preserves a clear existing license, asks the
maintainer when a decision is needed, and records a decision to grant no license
as a copyright notice with all rights reserved. An unanswered decision or an
alternative root license file blocks that declaration's assessment before
checks. Once resolved, adoption can write `LICENSE` and the README's License
link in the same run, within their separate declarations' targets.

Run the public-boundary fixtures with Node.js 24:

```sh
node --test test/repository-readme-check.test.mjs
```

The fixtures cover all recognized sections, omitted and interleaved sections,
Markdown and HTML heading forms, nested centering, hidden examples, missing,
link-only, and extra-content Contributing and Documentation sections, pointer
links hidden in code, resolving elsewhere, outside a paragraph, or wrapped in
lists, quotations, tables, or images, pointer links sharing a div, quotation,
or `details` block with their heading, links wrapping the next heading, named
anchors and hidden media around pointer links, malformed titles and license
links, missing and ambiguous licensing, an all-rights-reserved notice with a
matching License link, invalid protocol input, and
byte-for-byte preservation of the disposable project. One fixture executes
the operation from a retained layout containing only its declared script and
resources, so an import cannot succeed accidentally through the source
checkout.
