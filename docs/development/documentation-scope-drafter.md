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

The agent runs it with Node.js 24 from the standards source at the selected
commit. `--project` names the adopting repository and defaults to the current
directory. Each `--root` names a directory that the maintainer decided is a
documentation root, besides `docs`, which always is one; it must be an existing
repository-relative directory outside `docs`, outside every other root, and
outside the paths Repository Standards reserves.

The drafter reads the repository and writes nothing to it. On success it writes
a Repository Standards 4.0.0 scope proposal, format `repo-standards/scope/v2`,
to standard output with exit status 0. The proposal has one entry, for the
`documentation` declaration, with its candidates, each with a decision, reason,
and evidence paths, its coverage explanation, and its unresolved questions.
Candidates are sorted by path and questions by text, so the same tree always
gives the same bytes. An unknown argument, an invalid root, a project that is
not a Git repository, or an unreadable `standards.yaml` writes the reason to
standard error with exit status 1 and no proposal.

## What the rules decide

The drafter builds on the
[documentation model](documentation-check.md) that the documentation check
reads: its tree walk (`documentationTree`), its root inference
(`inferredRoots`), the model itself for each root's stray entries, ambiguous
roots, and local links, the targets that declarations own
(`declarationTargets`), and the shared repository root, development guide, and
category names. Its candidates are:

- each file Git keeps under a documentation root, included;
- the index of a root or of a directory under one when the directory has none,
  and the development guide when it is missing, included as files to create;
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repository root, and each
  `CONTEXT.md` that the root context map links to, or whose directory it links
  to, included;
- each file under a root that another declaration owns, excluded.

The unresolved questions are the cases no rule decides:

- a directory outside the roots whose `usage`, `development`, `adr`, or `agents`
  directories hold Markdown documents, which may be a documentation root;
- Markdown files outside the roots, grouped by their top-level directory, which
  may be documentation to cover or move;
- a file or directory directly under a root outside the categories, whose
  destination category is the maintainer's;
- a decided root without a category, which the check would find ambiguous;
- another `CONTEXT.md` or `CONTEXT-MAP.md`;
- a file under a root that Git ignores, a directory under a root without a file
  that Git keeps, and a symbolic link or special file under a root.

A `README.md` outside the roots is neither a candidate nor a question: the
documentation check reads every README in the confirmed scope as a root's
index. A stray directory's missing indexes are not drafted, because its
contents move.

## Other declarations' targets

The drafter runs outside the CLI, so no operation request lists the other
active declarations. It reads them from `standards.yaml` beside it in the
source at the selected commit: each default declaration's `kind`, `target`, and
`name`, which the source's one `complete` profile selects unchanged. A file
declaration owns its target and a skill its `.agents/skills/<name>` directory.
The repository declarations with discovery own paths that only their own
proposals name. The drafter also leaves out the paths Repository Standards
reserves: `.repo-standards` and the `adopt-standards` and `author-standards`
system skills. Because the manifest is read from the source rather than from
the retained inputs, the agent runs the drafter from the source, never from
`.repo-standards/inputs/source`.

## Evidence

The drafter cites only files that Git keeps, which it lists with
`git ls-files --cached --others --exclude-standard`, and their directories, so
every evidence path is one the CLI's discovery observation holds. An existing
file cites itself. A missing index cites its directory when that directory holds
a file that Git keeps, and cites nothing otherwise. Repository Standards
requires a missing `README.md` to cite a file or nonempty directory within its
own directory, so it rejects a draft whose missing index has no such evidence,
such as `docs/README.md` in a repository without `docs`. Creating content in
that directory first gives the index its evidence.

## Retention

`standards.yaml` lists the drafter as a resource of the documentation
declaration's `documentation-navigation` check. Adoption therefore retains it
with the release, and a changed drafter changes the documentation declaration
in an update's class. The CLI never runs it: the agent does, so the drafter is
not an author-executed discovery hook, which Repository Standards
[ADR 0003](https://github.com/lutzseverino/repo-standards/blob/4c8ed008e596222318aa0610f8a63fe5cc25c99c/docs/adr/0003-use-agent-discovery-with-confirmed-concrete-scope.md)
rules out. Public CLI 2.0.0 `source validate` accepts the
resource, and the check's retained source layout holds every module the drafter
imports.

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
resources with the source manifest, and show that the drafted scope of a
conforming fixture, and of this repository, passes the documentation check.
