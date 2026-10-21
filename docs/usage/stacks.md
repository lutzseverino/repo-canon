# Recommended stacks

A stack is a named set of development tools at exact major versions, such as
the package manager, runtime, compiler, linter, formatter and test runner a
Project uses. Stacks are opt-in: the `standard` and `factory` profiles stay
stack-free, and a Project can permanently use no stack.

The current release installs and checks no stack. This page recommends tools;
it states no requirement. A later release adds the `typescript-node-stack`
discovered declaration, after Repository Standards supports optional discovery
that can confirm no scope. [ADR 0024](../adr/0024-scope-each-stack-to-the-projects-that-use-it.md)
records that decision and its rationale.

## CLIs and libraries

Repo Canon recommends `typescript-node` for CLIs and libraries:

| Tool or command          | Recommendation       |
| ------------------------ | -------------------- |
| Package manager          | pnpm 11              |
| Runtime                  | Node.js 24 or 26     |
| Compiler or type checker | TypeScript 7         |
| Linter and formatter     | oxlint with Prettier |
| Test runner              | `node --test`        |
| Validation entry point   | A `validate` script  |

TypeScript 7 can compile TypeScript or type-check JavaScript through `checkJs`
when a Project's scripts need to run unbuilt.

## Projects and workspaces

A Project uses at most one stack. Several stacks can coexist in one repository
with disjoint scopes, and internal workspace packages count as Projects.
Workspace-shared facts such as `packageManager`, the lockfile and `engines`
live and are checked at the workspace root.

The later declaration will let discovery propose Projects from manifests and
workspaces. The adopting agent settles membership from evidence, asking only
when membership remains open. New Projects join the stack; existing Projects
that differ stay out of its scope, with differences listed in the handoff,
until a separate migration ticket's pull request adds them.

## Future stacks and versions

A web stack is not decided yet. It waits for the Astro verdict in
[repo-standards ADR 0018](https://github.com/lutzseverino/repo-standards/blob/v9.0.0/docs/adr/0018-add-a-private-astro-site-workspace.md),
including Biome versus oxlint and npm versus pnpm. Other stacks, such as Java
with Maven, come when wanted.

Moving a stack to a new major, such as TypeScript 8 or Node.js 28, is a
[breaking standards change](versioning.md). It ships in a breaking release,
batched with other breaking work where possible.
