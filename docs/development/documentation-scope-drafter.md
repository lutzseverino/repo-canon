# Documentation scope drafter

`discovery/draft-documentation-scope.mjs` drafts an adopting repository's
documentation scope from its tree, so that the adopting agent decides only what no
rule decides and two runs draft the same scope from the same tree. It is the
`documentation` declaration's discovery script: `repo-standards adopt` runs it
during inspection and asks its unresolved questions, as the
[documentation discovery guidance](../../discovery/documentation.md) describes.

## Interface

The drafter follows Repository Standards'
[discovery script protocol](https://github.com/lutzseverino/repo-standards/blob/v7.2.0/docs/usage/script-protocol.md#discovery-scripts).
Inspection runs it with Node.js 24 or 26 and no arguments, in a temporary copy of the
project that holds the files Git keeps, tracked or not ignored, without Git
metadata or `.repo-standards`. Its script path lies in the acquired source, or
in the retained one when inspection uses retained standards. It reads one
`repo-standards/discovery/v1` request on standard input and drafts the copy that
the request's `projectRoot` names, for the selected `profile`, whose
declarations' targets it leaves out, as
[other declarations' targets](#other-declarations-targets) describes.

The drafter reads the copy and writes nothing to it. On success it writes a
Repository Standards scope proposal, format `repo-standards/scope/v2`, to
standard output with exit status 0. The proposal has one entry, for the
`documentation` declaration, with its candidates, each with a decision, reason,
and evidence paths, its coverage explanation, and its unresolved questions.
Candidates are sorted by path and questions by text, so the same tree always
gives the same bytes. An argument, a request that is not a
`repo-standards/discovery/v1` object for the `documentation` declaration with an
absolute `projectRoot` and a string or absent `profile`, or a standards manifest
that is missing, unreadable, or in a form the drafter does not read writes the
reason to standard error with exit status 1 and no proposal, which inspection
reports as `DISCOVERY_SCRIPT_FAILED`.

## What the rules decide

The drafter builds on the
[documentation model](documentation-check.md) that the documentation check
reads: its tree walk (`documentationTree`), its root inference
(`inferredRoots`), the model itself for the root's stray entries and local
links, the targets that declarations own (`declarationTargets`), and the shared
repository root, development guide, and category names, and the test for a
Markdown document. Its only documentation root is `docs`, which always is one.
Its candidates are:

- each file under `docs`, included;
- the index of `docs` or of a directory under it when the directory has none,
  and the development guide when it is missing, included as files to create;
- `GLOSSARY.md` and `GLOSSARY-MAP.md` at the repository root, and each
  `GLOSSARY.md` that the root context map links to, or whose directory it links
  to, included;
- each file under `docs` that another declaration owns, including the
  contextual `docs/agents/project.md` under `project-agent-guidance`, excluded;
- each `README.md` outside `docs` and outside every candidate root, excluded,
  because the documentation check reads every README in the confirmed scope as
  a documentation root's index. Such a README cannot enter this scope, even as a
  move source. If it is a Project README, the `project-readmes` declaration's
  proposal covers it.

Every other case is an unresolved question, one kind for each case that the
[discovery guidance](../../discovery/documentation.md) leaves to the
adopting agent, worded so that the answer completes the entry without drafting
again. Candidate roots are directories outside `docs` whose `usage`,
`development`, `adr`, or `agents` directories hold Markdown documents, and that
no other declaration owns, nor their `README.md`; a candidate inside another is
asked about only if the outer one is not a root. Its question decides its
READMEs: a root's files are included as the draft includes those of `docs`,
and the READMEs of a directory that is not one stay out. Markdown files outside
`docs` are asked about in one question per top-level directory, which also
covers the documents of a candidate root that is not one. A stray directory's
missing indexes are not drafted, because its contents move.

## Other declarations' targets

Inspection passes the drafter no declarations, so it reads them from the
manifest of the standards it ships with, taking each declaration's `kind`,
`target`, `name`, and `exclude`. The discovery script declares `standards.yaml`
as a resource, so the source's manifest lies beside the drafter in the acquired
source and in the retained one alike; the drafter assumes no other layout. It
resolves the profile that the request names, `standard` or `factory`. A
manifest with one profile needs no name; with several, the drafter fails
without one, and it fails on a profile the manifest does not declare.

It resolves the declarations as Repository Standards does: a profile's
declaration replaces the default of its ID, adds a new one, or, with
`exclude: true`, removes it. The drafter reads the manifest's block mappings by
indentation rather than as YAML in full: it drops quotes and trailing comments
and decodes a doubled single quote. It fails rather than guess when the
manifest's declarations or one of them take a form it cannot read, or when it
has no `documentation` repository declaration. Every key from the top level
down to a declaration's fields must be plain, such as `target:` rather than
`"target":` or `? target`, and `defaults`, `profiles`, and each profile are
block mappings without an anchor or tag. A `kind`, `target`, `name`, or
`exclude` field must hold a single-line value on its own line, plain or quoted;
forms such as a missing value, a block scalar, an anchor, alias, or tag, a flow
collection, or a double-quoted value with a backslash escape fail.

A file declaration owns its target and a skill its `.agents/skills/<name>`
directory. The repository declarations with discovery own paths that only their
own proposals name. The drafter also leaves out the paths Repository Standards
7.2.0 reserves: `.repo-standards` and the `repository-standards` and
`author-standards` system skills, at both `.agents/skills/` and
`.claude/skills/`.

The names `adopt-standards` and `standards-updates` have no special handling at
either skill location. Project-owned skills, edited copies, and unedited CLI
6.x leftovers receive the ordinary membership questions for their Markdown
outside a documentation root, subject to the selected declarations' ownership.
The drafter does not claim that adoption removes them. An adopter updating from
CLI 6.x may see one extra membership question, once. Answers that
the previous confirmed scope decides still carry forward as the
[discovery guidance](../../discovery/documentation.md) describes.

## Evidence

The drafter cites only regular files that the copy holds, reached through real
directories, and their directories, so every evidence path is one the CLI's
discovery observation holds. An existing file cites itself. A missing index
cites its directory when that directory holds such a file, and cites nothing
otherwise. Repository Standards requires eligible evidence for existing and
excluded candidates; every included missing file, including a README, is
exempt because the CLI observes its absence. Evidence for a missing README need
not come from its own directory. New indexes never produce evidence questions.
Review whether the directory is meaningful documentation and include any
intended content paths before the complete inspection.

## Retention

`standards.yaml` names the drafter as the documentation declaration's
`discovery-script`, with `standards.yaml`, the documentation model and the
modules it imports, and the Marked and parse5 directories as its resources.
Adoption therefore retains them with the release, and a changed drafter changes
the documentation declaration in an update's class. Source validation checks
the script's fields and references and never runs it; the
`documentation-navigation` check imports the same model through its own
resources and does not need the drafter.

## Limits

The draft does not decide membership by itself. The drafter cannot know move
destinations, link-repair files, or anything an earlier confirmed scope decided:
inspection passes it no previous scope. Its proposal can therefore contain
questions an earlier confirmed scope settled, about roots, Markdown files
outside them, and glossaries alike. The running CLI may reuse unchanged
answers before presenting the remaining questions. The update rule in the
[discovery guidance](../../discovery/documentation.md) answers those remaining
questions from the earlier scope. The drafter does not judge whether a file's
content is useful or current.

## Validation

Run the focused fixtures from the repository root:

```sh
node --test test/documentation-scope-drafter.test.mjs
```

They run the drafter as inspection does, over copies of fixture repositories
without Git metadata, with a `repo-standards/discovery/v1` request on standard
input, and compare the whole proposal. They check its shape against the
`repo-standards/scope/v2` rules and that the copy is unchanged, cover the
unresolved questions, reserved paths, ordinary handling of retired skill names
(including an unedited CLI 6.x leftover and an edited copy), symbolic links, and
process errors, run
the drafter from a retained source that holds only its declared resources and
compare its proposal with the acquired source's, resolve a profile's
declarations, leave project agent guidance outside documentation scope in both
profiles, and show that the drafted scope of a conforming fixture, and of a
copy of this repository once its questions are answered, passes the
documentation check.
