# typescript-node stack scope drafter

`discovery/draft-typescript-node-stack-scope.mjs` drafts an adopting
repository's `typescript-node-stack` scope from its manifests and workspace
configuration. It is the declaration's discovery script: `repo-standards adopt`
runs it during inspection and asks its unresolved questions, as the
[stack discovery guidance](../../discovery/typescript-node-stack.md)
describes.

## Interface

The drafter follows Repository Standards'
[discovery script protocol](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/usage/script-protocol.md#discovery-scripts).
Inspection runs it with Node.js 24 or 26 and no arguments, in a temporary copy
of the project that holds the files Git keeps, without Git metadata or
`.repo-standards`. It reads one `repo-standards/discovery/v1` request for the
`typescript-node-stack` declaration with an absolute `projectRoot`, ignores
the request's other fields, and drafts that copy. It writes nothing to it.

On success it writes a `repo-standards/scope/v2` proposal with one entry to
standard output with exit status 0. Candidates are sorted by path and
questions by text, so the same tree always gives the same bytes. An argument
or a request it cannot read writes the reason to standard error with exit
status 1 and no proposal, which inspection reports as
`DISCOVERY_SCRIPT_FAILED`.

## What it drafts

The drafter reads every `package.json` the copy keeps, outside `node_modules`
and the paths Repository Standards reserves, and every workspace configuration
beside them, through the module the
[stack check](typescript-node-stack-check.md) uses. A workspace root is a
directory whose workspace configuration lists at least one kept member
manifest. Its members are Projects. Its own `package.json` is also eligible
when repository evidence establishes a maintained package with its own
responsibility and development commands. A shared-only root is excluded,
citing its manifest and workspace configuration. Incomplete evidence leaves
root membership unresolved. A root `package.json` without such
members is a Project, even beside a `pnpm-workspace.yaml` that holds only
settings or catalogs. For each Project it runs the check's difference reading:

- a Project with no difference is included, citing its `package.json`, its
  workspace root's `package.json`, the lockfile, and the workspace
  configuration;
- a Project with differences is excluded, with every correction the check
  would name as its reason, citing its `package.json`.

For a root with members, the drafter uses package entry points (`bin`, `main`,
`module`, `exports`, `types` or `typings`), nonempty development commands and
kept JavaScript or TypeScript sources, including declaration-only library
sources, as positive evidence together. It excludes
files belonging to nested packages, fixtures, generated output, dot directories
and tool configuration from that evidence. With neither entry points nor
source files it proposes a shared-only root; partial evidence or an
unreadable manifest raises a question for the agent's full repository assessment.
These are proposal heuristics, not additional Project requirements. The root
and members are assessed independently for stack differences, and the workspace
root's facts, such as `packageManager` and catalogs, still feed each reading.

A `package.json` below a directory named `__fixtures__`, `__mocks__`,
`build`, `coverage`, `dist`, `fixture`, `fixtures`, `generated`, `out`,
`testdata`, or `vendor` is excluded as no maintained Project unless a
workspace whose root lies outside that directory lists it. Its own pnpm
settings, or a workspace inside that directory, do not make it a Project, so a
fixture workspace's root and members are excluded alike. Any other
`package.json` outside every workspace is an unresolved question, and so is each
workspace configuration the module cannot read; manifests below such a
configuration are left to that question.

When the draft includes no Project it proposes no scope, with `noScope`, and
keeps its exclusions and questions. Its coverage then says whether the
repository holds no Node.js Project or no Project matches the stack. An agent
that answers a question by including a Project removes `noScope`; the CLI
rejects an entry with both.

## Retention

`standards.yaml` names the drafter as the declaration's `discovery-script`,
with the shared stack module and the local-link module it imports as its
resources. Adoption retains them with
the release. The drafter needs no other declaration's targets, because no other
declaration owns a `package.json`.

## Limits

Beyond root membership evidence, the draft reads manifest facts only. It cannot see whether a Project compiles
with TypeScript 7, tests with `node --test`, runs `validate` in required pull
request checks, or names its tools in its Setup and validation section, nor
whether the Project is new or existing; the adoption guidance leaves those to
the agent. Directory names decide only exclusions of manifests no workspace
lists.

## Validation

Run the focused fixtures from the repository root:

```sh
node --test test/typescript-node-stack-scope-drafter.test.mjs
```

They run the drafter as inspection does, over copies without Git metadata,
assert that the copy is unchanged and the proposal has the scope proposal's
shape, and cover a single conforming package, a pnpm workspace with conforming
and differing members, a maintained root included alongside its member and
validated by the check, differing and unresolved roots, shared-only roots,
a single
package with a settings-only `pnpm-workspace.yaml`, `package.json` workspaces with exclusions, common `pnpm-workspace.yaml` forms, fixture and
generated directories including fixture packages with their own pnpm settings or workspace, a repository with no Node.js Project, one whose every
Project differs, unresolved manifests and workspace configuration, reserved
paths, a drafted scope that passes the check, a retained source, and process
errors.
