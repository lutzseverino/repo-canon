# Documentation and Project README checks

Two read-only operations validate structural parts of the documentation policy
through the Repository Standards public operation protocol:

- `operations/check-project-readmes.mjs` checks each concrete Project README
  target for a single non-centered level-one title and valid rendered local
  links. A selected missing path receives a create-file diagnostic.
- `operations/check-documentation.mjs` requires `docs/README.md` and
  `docs/development/README.md`, rejects populated top-level documentation
  outside the four recognized categories, checks that every existing
  documentation directory has a nonempty `README.md`, and validates rendered
  local links in the documentation tree and selected migration or link-repair
  files.

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
declarations must retain `operations/lib/rendered-markdown.mjs` and the Marked
and parse5 resources and notices alongside each operation that imports them.

## Outcomes and limits

A structurally valid check returns a zero-exit `passed` result. Correctable
policy findings return a zero-exit `failed` result with the affected path and a
concrete correction. Invalid JSON, protocol versions, phases, or target shapes
produce a nonzero process error and no result object. These checks have no
check-level blocked condition: Repository Standards reports a missing or
incompatible runtime while probing prerequisites before invoking them, and
reports an unexpected process or protocol failure as an execution error.

The checks never edit project content. They do not establish whether a component
is a Project, whether discovery covered every Project or migration path, or
whether purpose, commands, configuration, content placement, and linked material
are useful or factually correct. Review the discovery proposal and those semantic
questions during the complete inspection. Scope-independent fixtures exercise
only the operation behavior; #15 wires discovery and retained resources into the
complete source, and #16 supplies complete adoption evidence.

## Prerequisites and validation

The executable is Node.js 24, declared as `>=24 <25`; use `node --version` for
the prerequisite probe. No package installation is needed because the parser
builds are retained source resources. Run the focused fixture suites from the
repository root:

```sh
node --test test/project-readme-check.test.mjs test/documentation-check.test.mjs
```

Each fixture invokes the scripts with a `repo-standards/operation/v1` request,
asserts the `repo-standards/result/v1` outcome or process error, and compares a
complete before-and-after snapshot of the temporary Git repository.
