# Repository README check

`operations/check-repository-readme.mjs` is the read-only structural check for
the [Repository README rules](../../rules/repository-readme.md). It consumes
`repo-standards/operation/v2` on standard input, accepts only a checks operation
whose allowed target is the root `README.md`, and returns one
`repo-standards/result/v2` object on standard output.

The operation requires Node.js 24 or 26. Its integration metadata is `node` with
`["--version"]`, version range `>=24.0.0 <25.0.0 || >=26.0.0 <27.0.0`, retained resource directories
`vendor/marked` and `vendor/parse5`, the shared rendered-Markdown and local-link
modules, and a 30-second timeout. It uses the vendored Marked 18.0.13 lexer,
parse5 8.0.1 fragment parser, and shared
`operations/lib/rendered-markdown.mjs` resource so structural decisions follow
one rendered Markdown and HTML representation. The operation keeps its
README-specific title, ordering, centering, section-body, pointer-section, and
License policies.

The description is the rendered paragraph immediately after the title, allowing
centered `div` wrappers. It must be one sentence by the shared deterministic
index-purpose rule: terminal sentence punctuation and no internal sentence end
before a capitalized word. It must contain no term defined in root
`GLOSSARY.md` or a context glossary linked from the Contexts section of root
`GLOSSARY-MAP.md`. The check reads the domain-modeling format's `**Term**:`
paragraphs, matches case-insensitively at whole-word boundaries, treating a
hyphen-joined compound as one word, and names both
the term and its defining glossary in each correction. It reads these files
even when they belong to another declaration or lie outside this check's target;
it never changes them. Repositories without glossaries pass this part.

One optional project image, then the title, description and badges form one
centered header block. Before the first title, the check accepts only one
plain image or `picture` containing exactly one visible `img` fallback with a
nonempty source. A picture's `source` alternatives count as the same image;
an image may be wrapped in a link. Other rendered content or additional images
before the title fail with a correction identifying their text, media tag or
image paths. Comments and nonrendered content do not count. A README without
an image retains its existing accepted forms, including headers without badges.

Each element
is centered by its own `align="center"` or an ancestor `div` with that attribute;
a `p align="center"` centers its content too. Attribute names and values are
case-insensitive, but `data-align` and values such as `centerpiece` do not
count. HTML comments and hidden elements contribute no rendered content or
centering. Both a single centered `div` and individually centered title,
description and badge paragraphs pass, with an optional image centered by the
shared wrapper, its containing paragraph, or its own accepted centering
attribute. The check still locates the first nonempty level-one title and
now validates its rendered prefix.

The check uses the same description paragraph as the sentence and glossary
checks. Badges are the consecutive images after that paragraph, optionally
wrapped in links, stopping at any other rendered content or the next heading.
They can be Markdown images, HTML `img` elements, or a mix, in one or several
paragraphs or directly inside a `div`. Every badge must be centered. A header
without badges passes; badge presence and coverage remain contextual. Title,
description and badge failures each produce their own concrete correction.

The shared rendered-Markdown model exposes centering and ordered semantic
elements on blocks, centering on images, child elements on links, and media
tag names. Pictures expose their centering and child elements while preserving
the existing flat semantic sequence. The README check groups a picture and its
fallback as one image only when checking the title's prefix. Existing consumers
keep their heading, section, text and badge behavior.

The rules give a GitHub-supported theme-aware example with dark and light
sources plus an image fallback. Image suitability, actual source availability
and theme rendering, and the choice between decorative empty alt text and an
informative text alternative remain contextual adoption assessments. The check
neither requires an image nor creates artwork or selects arbitrary icon files.

`operations/lib/entry-document.mjs` is retained alongside both entry-document
checks and the documentation scope drafter, the documentation declaration's
discovery script. The rule intentionally rejects a
glossary term used in its ordinary-English sense, such as `Project`; report
false positives as findings rather than widening the rule. Audience, the
effects of adopting a tool, and defining terms before later uses still require
review.

The result statuses have distinct meanings:

- `passed` means the checked structure is valid. Description facts, badges, commands,
  license facts, and prose still need maintainer or agent review.
- `failed` is a policy failure with concrete corrections, such as centering the
  project image, title, description or badges, removing unexpected content
  before the title, restoring section order, reducing a pointer
  section to its link, or fixing the License link. It is returned by a successful process so Repository
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
[rules](../../rules/repository-license.md) state what that file holds, including
a copyright notice with all rights reserved when the maintainer grants no
license. Its [adoption guidance](../../guidance/repository-license.md)
establishes the license decision before this check runs: it preserves a clear
existing license and asks the maintainer when a decision is needed. An unanswered decision or an
alternative root license file blocks that declaration's assessment before
checks. Once resolved, adoption can write `LICENSE` and the README's License
link in the same run, within their separate declarations' targets.

Run the public-boundary fixtures with Node.js 24 or 26:

```sh
node --test test/repository-readme-check.test.mjs
```

The fixtures cover optional plain images and theme-aware pictures in both
centered header forms, image links, image-specific centering corrections,
extra images, unrelated rendered prefixes, missing or hidden picture fallbacks,
and comments and nonrendered prefixes. They also cover Markdown inside a
div with blank lines, direct and link-wrapped HTML badges, mixed Markdown and
HTML badges, multiple badge paragraphs, partial centering, and no badges. They
include Postern's title-only centered header before postern#10, misleading
centering attributes, commented and hidden centering, and badge detection
stopping at other rendered content. They also cover all recognized sections,
omitted and interleaved sections, Markdown and HTML heading forms, nested centering, hidden examples, missing,
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
