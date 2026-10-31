# Scope each stack to the Projects that use it

Status: decision 4's wait for the Astro verdict and decision 11's wait for the
web stack are amended by
[ADR 0026](0026-add-the-typescript-astro-and-typescript-vite-stacks.md); the
other decisions stand.

Repo Canon standardizes stacks through opt-in discovered declarations, each
scoped to the Projects that use it. One repository can hold several Projects
with different stacks, so a repository-wide stack selection cannot express
their membership. The [settled decisions on #217](https://github.com/lutzseverino/repo-canon/issues/217#issuecomment-6319173837)
are the source of the eleven decisions below, including the later
clarifications on JavaScript type checking and sharded pull request checks
recorded on that issue.

## Scope and tools

1. **Opt-in.** The `standard` and `factory` profiles stay stack-free. A
   Project without a stack is a legitimate permanent state, not a gap.
2. **One discovered declaration per stack.** Starting with
   `typescript-node-stack`, each stack's confirmed scope is the set of
   Projects that use it. There is no stack choice, stack profile or profile
   multiplication. Stacks need no composition, amending the project-stack
   consequence of [ADR 0017](0017-make-the-factory-an-optional-profile.md).
   [repo-standards#300](https://github.com/lutzseverino/repo-standards/issues/300)
   stays platform-only.
3. **At most one stack per Project.** Stack scopes are disjoint, and several
   stacks can coexist in one repository. Workspace members count as Projects.
   Shared workspace facts (`packageManager`, the lockfile and `engines`) are
   checked at the workspace root.
4. **Start with `typescript-node` for CLIs and libraries.** Its tools are
   pnpm 11, Node.js 24 or 26, TypeScript 7, oxlint with Prettier,
   `node --test`, and a `validate` script. TypeScript serves as the compiler
   or as the `checkJs` type checker for a JavaScript Project whose scripts
   must run unbuilt. A web stack waits for the Astro verdict in
   [repo-standards ADR 0018](https://github.com/lutzseverino/repo-standards/blob/v9.0.0/docs/adr/0018-add-a-private-astro-site-workspace.md),
   which also settles Biome versus oxlint and npm versus pnpm. Other stacks,
   such as Java with Maven, come when wanted.

## Installation and adoption

5. **Rules, assessment and read-only checks.** A stack installs rules naming
   each tool and its exact major version, a contextual assessment, and
   read-only checks run once per confirmed Project for `packageManager`,
   `engines.node`, the configured linter and formatter, and the `validate`
   script. A rule requires pull request checks to run `validate`, either as
   one required job or as required shards that together run every step.
   A stack ships no exact configuration files and no workflow file.
6. **Factory link through documentation.** Each Project's _Setup and
   validation_ section names its stack's tools. The factory image already
   follows that section; no declaration combines a stack with the factory.
7. **Major bumps are breaking standards changes.** Moving a stack to a new
   major, such as TypeScript 8 or Node.js 28, ships in a breaking Repo Canon
   release, batched with other breaking work where possible.
8. **The adopting agent decides from evidence.** Discovery proposes each
   stack's Projects from manifests and workspaces. The agent settles their
   membership without asking unless the evidence leaves it open. New Projects
   join the stack. An existing Project that differs stays out of the scope,
   with its differences listed in the handoff; a separate migration ticket's
   pull request then adds it.
9. **Optional discovery can confirm no scope.** Repository Standards needs
   an optional discovery declaration that can confirm no scope, installing
   no rules and running no checks. Every other declaration keeps today's
   meaning: an empty scope is repository-wide.
10. **Declaration after capability.** The stack declaration is built after
    that Repository Standards capability ships. Until then, this ADR and the
    [usage page](../usage/stacks.md) only recommend `typescript-node`;
    nothing is installed.
11. **Migration order.** `repo-canon`, `scriptorium` and `postern` go first,
    then `repo-standards`. App repositories wait for the web stack.

## Rejected alternative

Round 1 of the grilling treated a stack as a choice or profile inside each
profile. This was rejected because a repository can contain Projects with
different stacks, such as `polity`'s `apps/` and `services/`, and per-profile
stacks would multiply profiles. Project-scoped declarations express that
membership while keeping the two profiles and their purpose intact.

## Consequences

- A stack major bump requires a breaking standards release and is batched with
  other breaking work where possible.
- Until optional discovery can confirm no scope, the recommendation installs
  and checks nothing; the declaration follows in a later release.
- The first migrations exercise the stack on `repo-canon`, `scriptorium` and
  `postern` before `repo-standards`; app repositories wait for the web stack.
