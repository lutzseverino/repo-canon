# Documentation scope drafter

`discovery/draft-documentation-scope.mjs` drafts an adopting repository's
documentation scope from its tree, so that the agent decides only what no rule
decides and two agents draft the same scope from the same tree. The
[documentation discovery guidance](../../discovery/documentation.md) tells the
agent to run it; the maintainer still confirms the scope with the complete
inspection.

## Interface

```sh
node discovery/draft-documentation-scope.mjs [--project <path>] [--root <path>]...
```

With Node.js 24, the agent can run it from either supported location. From the
root of a clone of the standards source checked out at the selected commit:

```sh
node discovery/draft-documentation-scope.mjs --project /path/to/adopting-repository \
  > /tmp/documentation-scope.json
```

Or from the adopting repository's root, using the retained copy under
`.repo-standards/inputs/source/` (supported since Repo Canon v0.4.1), including
when the selected source clone is unavailable:

```sh
node .repo-standards/inputs/source/discovery/draft-documentation-scope.mjs \
  > /tmp/documentation-scope.json
```

`--project` names a path in the adopting repository and defaults to the
current directory; like Repository Standards, the drafter drafts the top level
of the Git working tree that holds it. Each `--root` names a directory that the
agent decided is a documentation root, besides `docs`, which always is one. It
must be a repository-relative directory that holds a file Git keeps, outside
`docs`, every other root, and the paths Repository Standards reserves, and no
other declaration may own it or its `README.md`.

The drafter reads the repository and writes nothing to it. On success it writes
a Repository Standards 4.0.0 scope proposal, format `repo-standards/scope/v2`,
to standard output with exit status 0. The proposal has one entry, for the
`documentation` declaration, with its candidates, each with a decision, reason,
and evidence paths, its coverage explanation, and its unresolved questions.
Candidates are sorted by path and questions by text, so the same tree always
gives the same bytes. An unknown argument, an invalid root, a project that is
not a Git repository, or a standards manifest that is missing, unreadable, or
in a form the drafter does not read writes the reason to standard error with
exit status 1 and no proposal; for a missing manifest, it names each path the
drafter tried.

## What the rules decide

The drafter builds on the
[documentation model](documentation-check.md) that the documentation check
reads: its tree walk (`documentationTree`), its root inference
(`inferredRoots`), the model itself for each root's stray entries, ambiguous
roots, and local links, the targets that declarations own
(`declarationTargets`), and the shared repository root, development guide, and
category names, and the test for a Markdown document. Its candidates are:

- each file Git keeps under a documentation root, included;
- the index of a root or of a directory under one when the directory has none,
  and the development guide when it is missing, included as files to create;
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repository root, and each
  `CONTEXT.md` that the root context map links to, or whose directory it links
  to, included;
- each file under a root that another declaration owns, excluded;
- each `README.md` outside the roots, excluded, because the documentation check
  reads every README in the confirmed scope as a documentation root's index.

Every other case is an unresolved question, one kind for each case that the
[discovery guidance](../../discovery/documentation.md) leaves to the agent.
Candidate roots are directories outside the roots whose `usage`, `development`,
`adr`, or `agents` directories hold Markdown documents, and that no other
declaration owns, nor their `README.md`; a candidate inside another is asked
about only if the outer one is not a root. Markdown files
outside the roots are asked about in one question per top-level directory,
which also covers the documents of a candidate root that is not one. A decided
root without a category is asked about, but not the directories inside it,
which the check then also reads as candidate roots or roots, nor their stray
entries. A stray directory's missing
indexes are not drafted, because its contents move.

## Other declarations' targets

The drafter runs outside the CLI, so no operation request lists the other
active declarations. It reads them from the manifest of the standards it ships
with, taking each declaration's `kind`, `target`, `name`, and `exclude`:

- From the source, it reads `standards.yaml` beside it at the selected commit,
  whose one `complete` profile selects every default declaration unchanged.
- From the retained inputs, where no `standards.yaml` lies beside it in
  `.repo-standards/inputs/source`, it reads
  `.repo-standards/inputs/standards.yaml`, the manifest Repository Standards
  retains normalized to the selected profile alone. Repository Standards 4.0.0
  writes it with empty defaults and every resolved declaration under that
  profile.

Either way it resolves the declarations as Repository Standards does: a
profile's declaration replaces the default of its ID, adds a new one, or, with
`exclude: true`, removes it. The retained manifest holds what the source's
resolves to, so both runs draft the same scope for the same selection. The
drafter reads the manifest's block mappings by indentation rather than as YAML
in full: it drops quotes and trailing comments and decodes a doubled single
quote. It fails rather than guess when the manifest has more or fewer than one
profile, when its declarations or one of them take a form it cannot read, or
when it has no `documentation` repository declaration. Every key from the top
level down to a declaration's fields must be plain, such as `target:` rather
than `"target":` or `? target`, and `defaults`, `profiles`, and each profile
are block mappings without an anchor or tag. A `kind`, `target`, `name`, or
`exclude` field must hold a single-line value on its own line, plain or quoted;
forms such as a missing value, a block scalar, an anchor, alias, or tag, a flow
collection, or a double-quoted value with a backslash escape fail.

A file declaration owns its target and a skill its `.agents/skills/<name>`
directory. The repository declarations with discovery own paths that only their
own proposals name. The drafter also leaves out the paths Repository Standards
reserves: `.repo-standards` and the `adopt-standards` and `author-standards`
system skills.

## Evidence

The drafter cites only files that Git keeps, which it lists with
`git ls-files --cached --others --exclude-standard`, and their directories, so
every evidence path is one the CLI's discovery observation holds. A listed path
that no longer reaches a regular file through real directories, such as one
whose directory the working tree replaced with a file or a symbolic link, is
not kept. An existing
file cites itself. A missing index cites its directory when that directory holds
a file that Git keeps, and cites nothing otherwise. Repository Standards
requires a missing `README.md` to cite a file or nonempty directory within its
own directory, so it rejects an index without that evidence, such as
`docs/README.md` in a repository without `docs`. The drafter still drafts the
index, which the rules require, and asks whether to commit the directory's
first content in a separate reviewed change, which gives the index its
evidence.

## Retention

`standards.yaml` lists the drafter as a resource of the documentation
declaration's `documentation-navigation` check. Adoption therefore retains it
with the release, and a changed drafter changes the documentation declaration
in an update's class. The CLI never runs it: the agent does, so the drafter is
not an author-executed discovery hook, which Repository Standards
[ADR 0003](https://github.com/lutzseverino/repo-standards/blob/4c8ed008e596222318aa0610f8a63fe5cc25c99c/docs/adr/0003-use-agent-discovery-with-confirmed-concrete-scope.md)
rules out. Source validation accepts it as an ordinary resource, and the
check's retained source layout holds every module the drafter imports.

## Limits

The draft is not a confirmation. The drafter cannot know move destinations,
link-repair files, whether repository-specific agent constraints need
`docs/agents/project.md`, or anything an earlier confirmed scope decided, so an
update asks its root questions again. It does not judge whether a file's
content is useful or current.

## Validation

Run the focused fixtures from the repository root:

```sh
node --test test/documentation-scope-drafter.test.mjs
```

They run the drafter as a process over fixture repositories and compare the
whole proposal, check its shape against the `repo-standards/scope/v2` rules,
cover the unresolved questions and process errors, run it from the retained
inputs of an adopting fixture repository with the documented commands and
compare its proposal with the source's without changing repository content,
resolve a profile's declarations from both manifest forms, and show
that the drafted scope of a conforming fixture, and of this repository, passes
the documentation check.
