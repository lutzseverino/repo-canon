# typescript-node stack check

`operations/check-typescript-node-stack.mjs` is the
`typescript-node-stack-manifests` check of the optional `typescript-node-stack`
declaration. It validates the manifest facts of the
[typescript-node stack rules](../../rules/typescript-node-stack.md) for each
confirmed Project, through the Repository Standards public operation protocol.
It runs only when the declaration has a scope: with no scope, the CLI runs none
of its operations.

## Interface

The check reads one `repo-standards/operation/v2` request on standard input,
in the `checks` phase. Its concrete scope, `allowedTargets.paths`, holds one
project-relative `package.json` path per Project, at the repository root or in
a directory. A directory target, or any path that is not a normalized relative
path ending in `package.json`, is refused: the check writes the reason to
standard error with a nonzero exit status and no result. It reads the project
and writes nothing to it.

On success it writes one `repo-standards/result/v2` object to standard output.
The result passes when no confirmed Project needs a correction; its message
names what still needs the contextual assessment: TypeScript 7, `node --test`,
required pull request checks running `validate`, and each Project's Setup and
validation section. Otherwise it fails with every correction of every path, in
the order of the confirmed paths, each prefixed with the path it belongs to. A
workspace-root correction that several confirmed Projects share is reported for
each of them. An empty scope passes for zero Projects.

## What it reads

The check and the [scope drafter](typescript-node-stack-scope-drafter.md)
share `operations/lib/typescript-node-stack.mjs`, which reads a Project the
same way for both. A Project's workspace root is its own directory when that
configures a workspace, else the nearest ancestor whose workspace
configuration lists it as a member, else its own directory. A directory
configures a workspace through `pnpm-workspace.yaml`, whose `packages` the
module reads as a flow sequence on one or more lines, split only at commas
outside quotes and nesting and allowing a trailing comma, or a block sequence,
indented or not, of plain, single-quoted or double-quoted patterns with
comments, or else through the `workspaces` field of its `package.json`, as a
list or as `workspaces.packages`. No YAML library is available to operations,
so the module reads only these forms. Any other, such as an anchor, alias,
block scalar, nested collection or quoted `packages` key, reads as an
unreadable workspace, never as a narrower or wider member list. Patterns
match through Node's own `path.matchesGlob`, so a leading `**` also matches
zero directories; a quoted `!` pattern excludes what it matches, and a
`node_modules` directory is never a member.

For each confirmed path the check names one correction per difference:

- `packageManager` in the workspace root's `package.json` is not
  `pnpm@11.x.y`, optionally with a Corepack hash;
- the workspace root has no `pnpm-lock.yaml`;
- `engines.node` in the workspace root's `package.json` is missing, is not a
  range the module reads, or admits no supported major or any major other
  than 24 and 26. `>=24 <25 || >=26 <27` and `^24.0.0 || ^26.0.0` both pass;
- `oxlint` at major 1 or `prettier` at major 3 is not declared in the
  Project's `dependencies` or `devDependencies`, or, failing that, in its
  workspace root's. A declared range must admit only that major;
- the Project's `package.json` has no nonempty `validate` script.

A missing or non-object `package.json`, or a workspace configuration the
module cannot read on the way to the root, is its own correction. The module
reads a file only when the shared local-path policy of
`operations/lib/local-markdown-links.mjs` finds it inside the project and it
is a regular file, so a path under a symbolic link that leaves the project
reads as missing.

The module's range reader evaluates the semantic version ranges npm writes:
comparators, `^`, `~`, `x` ranges, hyphen ranges and `||` unions. A
`catalog:` or `catalog:<name>` specifier resolves through the default or named
catalog of the workspace root's `pnpm-workspace.yaml`, read as block mappings
with plain or quoted names and comments, including a comment after a named
catalog's header. Other specifiers, such as `workspace:`, tags and URLs, and a catalog
entry it cannot find, receive a correction.

## Validation

Run the focused fixtures from the repository root:

```sh
node --test test/typescript-node-stack-check.test.mjs
```

They run the check over fixture repositories, assert that it changes nothing,
and cover a conforming root package and workspace member, both accepted
`engines.node` spellings, a named correction for each manifest fact, catalog
specifiers, the `pnpm-workspace.yaml` sequence, glob and catalog forms,
unsupported forms reading as unreadable,
shared root corrections reported per path, a manifest under a
symbolic link that leaves the project, workspace
roots from `pnpm-workspace.yaml` and `package.json`, refused targets, and a run
from a retained source that holds only its declared resources.
