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

## Sites and Apps

Repo Canon recommends `typescript-astro` for Sites, web Projects whose pages
are built ahead of time with interactive islands at most, and `typescript-vite`
for Apps, web Projects whose interface the browser renders with client-side
code that owns its routing and state. An App uses Vite with React and chooses
its own router.

| Tool or command               | `typescript-astro` (Sites)                        | `typescript-vite` (Apps)               |
| ----------------------------- | ------------------------------------------------- | -------------------------------------- |
| Framework                     | Astro 7                                           | Vite 8                                 |
| UI                            | React 19, Tailwind CSS 4, shadcn CLI 4            | React 19, Tailwind CSS 4, shadcn CLI 4 |
| Compiler or type checker      | TypeScript 6, checked by `astro check`            | TypeScript 7                           |
| Linter and formatter          | oxlint 1, Prettier 3 with `prettier-plugin-astro` | oxlint 1, Prettier 3                   |
| Test runner, when tests exist | `node --test`                                     | Vitest 5                               |
| Package manager and runtime   | pnpm 11, Node.js 24 or 26                         | pnpm 11, Node.js 24 or 26              |
| Validation entry point        | A `validate` script that runs `astro check`       | A `validate` script                    |

Neither stack uses ESLint, and neither requires tests. Sites stay on
TypeScript 6 because `@astrojs/check` accepts only TypeScript 5 or 6. Both
stacks use shadcn with a `base-*` style and lucide icons, leaving the visual
style after `base-` and the colour theme to each Project. Each Project owns
its `ui:add`, `ui:update` and `ui:check` scripts, and `validate` runs
`ui:check`. As with `typescript-node`, required pull request checks run
`validate`, the Setup and validation section names the tools, and neither
stack installs a configuration file or a workflow file.

A shared web package, a workspace package that only web Projects use, joins
the stack of the Projects that use it. Only Projects in a stack count: the
package follows `typescript-astro` when both a Site and an App in those stacks
use it, and a Site in no stack does not move it. A package that a Project other
than a web Project also uses is not a shared web package and stays out of both
web stacks.

These two stacks are recommended, but their declarations have not shipped yet:
adoption installs no rules and runs no check for them. The
`typescript-node-stack` declaration still installs and checks as described
above. [ADR 0026](../adr/0026-add-the-typescript-astro-and-typescript-vite-stacks.md)
records these decisions and their rationale.

## Projects and workspaces

A Project uses at most one stack. Several stacks can coexist in one repository
with disjoint scopes. In a workspace, the member packages are Projects. The
workspace root holds their shared facts, such as `packageManager`, the lockfile
and `engines`, which live and are checked at the root for each member. A root
that is itself a maintained package with its own responsibility and
development commands is also a Project alongside its members, and its stack
membership is assessed independently; a root that only supplies shared
workspace configuration is not a Project.

The `typescript-node-stack` declaration's scope names one `package.json` per
Project. Discovery drafts
it from manifests and workspaces: a Project that matches the stack's manifest
facts is proposed, and one that differs is left out with its differences. The
adopting agent settles membership from evidence, asking only when membership
remains open. New Projects join the stack; existing Projects that differ stay
out of its scope, with differences listed in the handoff, until a separate
migration ticket's pull request adds them.

Its check verifies, for each confirmed Project, that its workspace root sets
`packageManager` to pnpm 11, keeps `pnpm-lock.yaml`, and limits `engines.node`
to Node.js 24 or 26, such as `>=24 <25 || >=26 <27` or `^24.0.0 || ^26.0.0`;
that the Project or its workspace root declares oxlint 1 and Prettier 3; and
that the Project has a `validate` script. The assessment covers TypeScript 7,
`node --test`, the pull request checks and the Setup and validation section.

## Future stacks and versions

Other stacks, such as Java with Maven, come when wanted.

Moving a stack to a new major, such as TypeScript 8 or Node.js 28, is a
[breaking standards change](versioning.md). It ships in a breaking release,
batched with other breaking work where possible.
