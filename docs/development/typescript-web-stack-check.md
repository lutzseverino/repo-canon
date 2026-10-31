# TypeScript web stack checks

The `typescript-astro-stack` and `typescript-vite-stack` declarations retain
separate executable entry points backed by shared helpers. Each reads a
`repo-standards/operation/v2` checks request on stdin and writes one
`repo-standards/result/v2` result. Non-manifest targets, directory scopes and
invalid requests fail explicitly without project writes. Named corrections
produce a failed result; all checked facts matching produces a passed result.

Both reuse Node's workspace, catalog, version-range and manifest readers for
pnpm 11, a lockfile, Node.js 24 or 26, oxlint 1, Prettier 3 and each Project's
`validate` script. Astro adds formatter-plugin availability. Both check shadcn
at the evidenced holder: `components.json` with `base-*` and lucide, an exact
major-4 devDependency and `ui:add`, `ui:update`, `ui:check`. A Site/App without
a holder fails. Dependency paths through packages in the same workspace
establish centralized holder candidates, including transitive paths. A shared
web package without UI needs no independent registry, pin or scripts.
Default and named catalogs resolve checked tool declarations and exact shadcn
pins. Unreadable or unresolved entries produce corrections rather than passes.
The [Node guidance](../../guidance/typescript-node-stack.md#supported-workspace-yaml)
describes the common limited YAML reader.

Framework, React, Tailwind, TypeScript and test-runner majors remain assessed,
including the runner when tests exist; no test or Vitest requirement is added.
The check does not resolve framework requirements through consumers. Actual
`astro check`/`ui:check` execution, required CI coverage, Setup and validation,
generated-output integrity, wrappers, styling and theme ownership also remain
contextual assessments under the [shared rules](../../rules/typescript-web-stacks.md).

Run `node --test test/typescript-web-stack.test.mjs` for command-boundary
fixtures, including installed layouts without development packages, holder
sharing, catalogs and the checked/assessed boundary. Public CLI installation
and updates for both profiles run in
`node --test test/repository-wide-rules.test.mjs`.
