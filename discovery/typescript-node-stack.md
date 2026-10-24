# Discover typescript-node stack scope

`repo-standards adopt` drafts this scope itself: the `typescript-node-stack`
declaration's discovery script runs read-only during inspection and proposes
the declaration's scope entry. `adopt` asks its unresolved questions in the
terminal, or as the `scope:typescript-node-stack` field of its answers file,
whose proposed answer is the draft. Nobody runs the drafter by hand.

The scope names one path per Project: its `package.json`, such as
`package.json` for a root package or `packages/cli/package.json` for a
workspace member. The drafter reads the manifests and workspace configuration
the repository keeps: each `package.json`, its `workspaces`, and the
`packages` of each `pnpm-workspace.yaml`. In a workspace, each listed member
is a Project and the root is not. A root `package.json` without workspace
members, including one beside a `pnpm-workspace.yaml` that holds only settings
or catalogs, is the repository's one Project.

- A Project that matches the stack's manifest facts is included.
- A Project that differs is excluded, with a reason naming its differences.
- A workspace root is excluded, conforming or not, as its members' shared
  configuration.
- A `package.json` under a directory of fixtures, generated output, or copied
  code, such as `fixtures`, `dist`, or `vendor`, is excluded unless a
  workspace outside that directory lists it; its own pnpm settings or
  workspace do not make it a Project.
- Any other `package.json`, and a workspace configuration the drafter cannot
  read, is an unresolved question.

When the draft includes no Project, it proposes no scope with `noScope`.

Decide each unresolved question from the repository's evidence and remove it
from the entry, recording the reason in the candidate. Follow the adoption
guidance's membership rules: an existing Project that differs stays excluded,
and a new Project joins. Including a Project means removing `noScope`; leaving
every Project out keeps it. Keep this scope's paths disjoint from every other
declaration's: a `package.json` belongs to one stack only.

The manifest facts are only part of the rules. Before confirming a Project the
draft includes, check that the evidence does not contradict the rest of the
rules, such as a Project that runs another test runner; exclude it with that
difference otherwise. The maintainer's request to adopt or update is consent
to the drafted and reviewed scope. Ask them to confirm only when `adopt` asks
its `confirmation` question.
