# Recommended stacks

A stack is a named set of development tools at exact major versions, such as
the package manager, runtime, compiler, linter, formatter and test runner a
Project uses. Stacks are opt-in per Project, and a Project can permanently use
no stack. Both profiles include the optional `typescript-node-stack`
declaration, but it governs only the Projects confirmed in its scope, so a
repository with no matching Project gets no stack rules, as the
[authoring notes](../../authoring-notes.md) explain.

For each Project confirmed in its scope, adoption installs the
[stack rules](../../rules/typescript-node-stack.md), assesses the Project
against them, and runs a read-only check of its manifests. A repository without
such a Project confirms no scope: no stack rules are installed and no stack
check runs. [ADR 0024](../adr/0024-scope-each-stack-to-the-projects-that-use-it.md)
records that decision and its rationale.

## CLIs and libraries

Repo Canon recommends `typescript-node` for CLIs and libraries:

| Tool or command          | Recommendation       |
| ------------------------ | -------------------- |
| Package manager          | pnpm 11              |
| Runtime                  | Node.js 24 or 26     |
| Compiler or type checker | TypeScript 7         |
| Linter and formatter     | oxlint 1, Prettier 3 |
| Test runner              | `node --test`        |
| Validation entry point   | A `validate` script  |

TypeScript 7 can compile TypeScript or type-check JavaScript through `checkJs`
when a Project's scripts need to run unbuilt. Required pull request checks run
`validate`, in one job or as required shards that together run every step it
runs. Each Project's development guide names these tools in its Setup and
validation section. The stack installs no configuration file and no workflow
file.

## Projects and workspaces

A Project uses at most one stack. Several stacks can coexist in one repository
with disjoint scopes. In a workspace, the member packages are the Projects;
the workspace root holds their shared facts, such as `packageManager`, the
lockfile and `engines`, and is not itself a Project. Those facts live and are
checked at the root for each member.

The declaration's scope names one `package.json` per Project. Discovery drafts
it from manifests and workspaces: a Project that matches the stack's manifest
facts is proposed, and one that differs is left out with its differences. The
adopting agent settles membership from evidence, asking only when membership
remains open. New Projects join the stack; existing Projects that differ stay
out of its scope, with differences listed in the handoff, until a separate
migration ticket's pull request adds them.

The check verifies, for each confirmed Project, that its workspace root sets
`packageManager` to pnpm 11, keeps `pnpm-lock.yaml`, and limits `engines.node`
to Node.js 24 or 26, such as `>=24 <25 || >=26 <27` or `^24.0.0 || ^26.0.0`;
that the Project or its workspace root declares oxlint 1 and Prettier 3; and
that the Project has a `validate` script. The assessment covers TypeScript 7,
`node --test`, the pull request checks and the Setup and validation section.

## Future stacks and versions

A web stack is not decided yet. It waits for the Astro verdict in
[repo-standards ADR 0018](https://github.com/lutzseverino/repo-standards/blob/v9.0.0/docs/adr/0018-add-a-private-astro-site-workspace.md),
including Biome versus oxlint and npm versus pnpm. Other stacks, such as Java
with Maven, come when wanted.

Moving a stack to a new major, such as TypeScript 8 or Node.js 28, is a
[breaking standards change](versioning.md). It ships in a breaking release,
batched with other breaking work where possible.
