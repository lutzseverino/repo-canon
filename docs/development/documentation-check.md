# Documentation and Project README checks

Two read-only operations validate structural parts of the documentation policy
through the Repository Standards public operation protocol:

- `operations/check-project-readmes.mjs` checks each concrete Project README
  target for a single non-centered level-one title and valid rendered local
  links. A selected missing path receives a create-file diagnostic.
- `operations/check-documentation.mjs` requires `docs/README.md` and
  `docs/development/README.md`, derives every context-local documentation root
  from confirmed root-index and category paths, rejects populated top-level
  documentation outside the four recognized categories at each root, checks
  that every existing documentation directory has a nonempty `README.md`,
  validates rendered local links in those trees and selected migration or
  link-repair files, and enforces the four
  [documentation rules](#documentation-rules).

The documentation operation reads the repository only through the
documentation model in `operations/lib/documentation-model.mjs`. Given the
project root, the confirmed paths, and the paths other declarations own, the
model returns the documentation roots and the ambiguous candidate roots; each
root's documentation index, its stray top-level entries outside the
documentation categories, its directories with their index paths and states
(missing, empty, or present), and its confirmed category indexes; the
development guide; the documents; each document under a root with the index
that lists it and its scope membership; the purpose and items of each present
index; and every rendered local link, marked broken or intact. The model also
defines the documentation rules over that structure, and the check projects the
structure and the rule violations onto its corrections, so a new documentation
rule reads the model rather than walking the tree again. The model exports the
root inference, the tree walk, the index that lists a document, the targets
that declarations own, and the repository root, development guide, and category
names, so that the [documentation scope drafter](documentation-scope-drafter.md)
uses the same definitions as the check.

A documentation root never lies inside another. A confirmed
`<dir>/<category>/README.md` makes `<dir>` a root only when `<dir>` is not
inside another root, so when candidate roots nest, the outermost wins. Inside a
root, that README is an ordinary directory's documentation index: `<dir>` gets
no root-index or stray-entry corrections, and a missing confirmed index under
its category is still reported as a confirmed category index of the root.

The Project README operation accepts individual non-root `README.md` paths.
The documentation operation accepts individual repository-relative file paths
and requires both root documentation files in its concrete scope. Neither
operation accepts directory targets. Discovery supplies those concrete paths;
the operations do not infer Project membership or expand adoption scope.

Both operations render each Markdown file once with the retained, pinned Marked
18.0.13 build, parse the result with the retained, pinned parse5 8.0.1 build,
and inspect that shared rendered representation. Hidden content and code examples
therefore cannot supply titles or navigable links, while Markdown, HTML, entity
references, and GFM tables receive the same link treatment. Final source
declarations retain `operations/lib/rendered-markdown.mjs`, the mechanically
separated `operations/lib/local-markdown-links.mjs`, and the Marked and parse5
resources and notices alongside each operation, and the documentation model
and the documentation scope drafter alongside the documentation operation. The
shared document owns rendered structure, including the ordered top-level
blocks of the document and of each heading's section with their tag, rendered
text, links at any depth, and nested blocks; Project README title policy
remains in its operation, documentation roots, indexes, and rules in the
documentation model, and local path containment and symlink
policy in the local-link module. That module's one local-link helper selects
each rendered link or image with a local target and marks it broken or intact;
the documentation model and the Project README check both build on it.

## Documentation rules

The model checks four of the
[documentation rules](../../CONTRIBUTING.md#documentation), which the
contribution guide states. Each failure names the file and the rule it breaks,
in the form `<file> breaks the <rule> rule: <correction>`. The check reports
these failures after its other corrections, grouped by rule in the order below
and by path within each rule. The model reads each rule mechanically:

- Index entry form: in every present documentation index, at a root or in a
  directory under one, the purpose is the first paragraph after the title, a
  leading heading of any level, or the first paragraph when there is no title.
  It is one sentence when it ends a sentence and no sentence ends inside it
  before a capitalized word. Each item of a top-level list after the purpose is
  an entry, well formed when it opens with a titled link to another local path,
  followed by a colon, a space, and a description. Other prose may follow the
  purpose.
- One index per document: apart from the cases below, each Markdown document
  under a root is listed by exactly one index item, in its index, and a root's
  own index by no index item. The first link of an index item lists its path,
  even when the item is malformed; a link to a directory, in any root, lists its
  README, and a link into the index itself lists nothing. Links outside index
  items, such as a citation in context, list nothing. The agents index,
  `docs/agents/README.md`, may cite the optional `docs/agents/project.md` in
  context instead of listing it: a link outside its entries, or text outside its
  title and entries that names the file by `project.md`, `./project.md`, or
  `docs/agents/project.md`, as the installed agents index does. Any other index
  still must not list it. A document whose index is missing or empty gets the
  correction to create or populate that index instead of one to list it there; a
  listing of it in another index still fails.
- Development guide order: `docs/development/README.md` has a Setup and
  validation heading as its first section after the title; a leading Setup and
  validation heading is that section, not the title. Its index is the
  items after that section ends; other lists inside the section, such as setup
  steps, are not entries. A well-formed item listing one of its entries before
  that point gets only the order correction. Other roots' development indexes
  follow only the index entry form.
- Scope coverage: a Markdown document under a root is covered when it is in the
  confirmed documentation scope or another active declaration owns it. The
  model's `declarationTargets` reads each declaration in the request's
  `declarations` field the way the CLI derives allowed targets: a file
  declaration's target, a repository declaration's confirmed paths and
  directories, and a skill's `.agents/skills/<name>` directory. Repository
  Standards rejects a path that two declarations own, so the installed exact
  files under `docs/agents` can never be in the documentation scope and are
  covered by their own declarations. Other files under a root, such as images,
  belong in the confirmed scope by the discovery guidance but are not checked.

These rules make a repository that passed earlier releases fail when it does
not follow them, as
[ADR 0009](../adr/0009-enforce-documentation-rules-as-checks.md) records.

## Outcomes and limits

A structurally valid check returns a zero-exit `passed` result. Correctable
policy findings return a zero-exit `failed` result with the affected path and a
concrete correction. Invalid JSON, protocol versions, phases, or target shapes
produce a nonzero process error and no result object. A file that exists but
cannot be read ends either check the same way: a Project README target, or any
document the documentation check reads, including a documentation index.
Node's read error names its path on stderr, the exit status is 1, and no result
object is written. A missing index is one that is absent, never one that cannot
be read. A documentation root, or a directory under one, that exists but
cannot be listed, including one inside a directory that cannot be searched,
ends the documentation check the same way, with Node's error naming the
directory. So does a document or index that the documentation check looks up
inside a directory that cannot be searched, with Node's error naming the file.
A missing directory is one that is absent, never one that cannot be listed.
The documentation check returns `blocked` when confirmed root-index and
category paths cannot distinguish an arbitrary documentation root from an
ordinary nested directory; the discovery proposal must resolve that scope
question. Repository Standards reports a missing or incompatible runtime while
probing prerequisites before invoking either check, and reports an unexpected
process or protocol failure as an execution error.

The checks never edit project content. They do not establish whether a component
is a Project, whether discovery covered every Project or migration path, or
whether purpose, commands, configuration, content placement, and linked material
are useful or factually correct. Scope coverage shows only that every Markdown
document under a confirmed documentation root is covered; it cannot find a
documentation root that the confirmed paths do not name. Review the discovery
proposal and those semantic questions during the complete inspection.
Scope-independent fixtures exercise only the operation behavior, not discovery
or adoption.

## Prerequisites and validation

The executable is Node.js 24, declared as `>=24 <25`; use `node --version` for
the prerequisite probe. No package installation is needed because the parser
builds are retained source resources. Run the focused fixture suites from the
repository root:

```sh
node --test test/project-readme-check.test.mjs test/documentation-check.test.mjs test/documentation-model.test.mjs
```

The shared runtime's document and heading-section blocks and exported Markdown
helpers have their own fixtures in `test/rendered-markdown.test.mjs`. The
documentation model's root inference, ambiguity, index states, stray entries,
documents, members, index structure, rule violations, and link resolution have
theirs in `test/documentation-model.test.mjs`. Each documentation rule has
passing and failing fixture repositories in `test/documentation-check.test.mjs`.

Each check fixture invokes the scripts with a `repo-standards/operation/v1`
request, asserts the `repo-standards/result/v1` outcome or process error, and
compares a complete before-and-after snapshot of the temporary Git repository.
Each operation also runs from a retained tree containing only its script and
the resources that `standards.yaml` declares for it.
