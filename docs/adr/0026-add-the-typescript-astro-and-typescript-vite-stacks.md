# Add the typescript-astro and typescript-vite stacks

Repo Canon recommends two web stacks: `typescript-astro` for Sites and
`typescript-vite` for Apps. [ADR 0024](0024-scope-each-stack-to-the-projects-that-use-it.md)
deferred the web stack to the Astro trial in
[repo-standards ADR 0018](https://github.com/lutzseverino/repo-standards/blob/v9.0.0/docs/adr/0018-add-a-private-astro-site-workspace.md),
and the owner judged that trial on 2026-10-27 together with their other web
Projects. The [settled decisions on #560](https://github.com/lutzseverino/repo-canon/issues/560#issuecomment-6451766356)
are the source of the eight decisions below, which amend ADR 0024's
decisions 4 and 11.

## Stacks and tools

1. **Astro for Sites, Vite for Apps.** The Astro trial passes for content and
   static sites: it built pages from build-time data, rendered repository
   Markdown in place and kept React to small islands. It said nothing about
   client-side apps, so Apps use plain Vite with React, each choosing its own
   router.
2. **Two stacks with shared web rules.** `typescript-astro` covers Sites and
   `typescript-vite` covers Apps. Each is its own optional discovered
   declaration under ADR 0024, and a Project still uses at most one stack.
   Both install the same shared web rules, written once.
3. **Tools and majors.** Every tool other than the framework, the TypeScript
   major and the test runner is shared:

   | Tool                          | `typescript-astro` (Sites)                        | `typescript-vite` (Apps)               |
   | ----------------------------- | ------------------------------------------------- | -------------------------------------- |
   | Framework                     | Astro 7                                           | Vite 8                                 |
   | UI                            | React 19, Tailwind CSS 4, shadcn CLI 4            | React 19, Tailwind CSS 4, shadcn CLI 4 |
   | TypeScript                    | 6, checked by `astro check`                       | 7                                      |
   | Lint and format               | oxlint 1, Prettier 3 with `prettier-plugin-astro` | oxlint 1, Prettier 3                   |
   | Tests, when a Project has any | `node --test`                                     | Vitest 5                               |
   | Package manager and runtime   | pnpm 11, Node.js 24 or 26                         | pnpm 11, Node.js 24 or 26              |

   Neither stack uses ESLint. The rules name the test runner but require no
   tests, and browser end-to-end testing stays outside the stacks.

4. **TypeScript 6 for Sites.** `@astrojs/check`, the only checker for `.astro`
   files, accepts only TypeScript 5 or 6. Sites move to TypeScript 7 once it
   accepts 7, and that move is a breaking standards change.
5. **shadcn on both stacks.** The shared web rules carry the six rules of the
   [2026-10-22 input on #560](https://github.com/lutzseverino/repo-canon/issues/560#issuecomment-6344994041).
   `components.json` names a `base-*` style, built on Base UI; the visual
   style after `base-` and the colour theme are each Project's own, and the
   icon library is lucide. The Project owns the `ui:add`, `ui:update` and
   `ui:check` scripts, and `validate` runs `ui:check`. The stack's read-only
   check verifies `components.json`'s style prefix and icon library, the exact
   pin of the `shadcn` CLI and the three scripts.

## Projects

6. **Shared web packages.** A shared web package is a workspace package that
   only web Projects, Sites or Apps, use. A package that a non-web Project
   also uses is not a shared web package, so manzai's `packages/protocol`
   stays in `typescript-node`, as the Projects table on #560 assigns it. At
   manzai main `a479f4e`, only
   [`services/api`](https://github.com/lutzseverino/manzai/blob/a479f4ec40175bb3a45ee628c0b31e6f5da10db9/services/api/package.json)
   depends on it, and
   [`apps/web`](https://github.com/lutzseverino/manzai/blob/a479f4ec40175bb3a45ee628c0b31e6f5da10db9/apps/web/package.json)
   does not; the web-only boundary follows from the App definition in #560's
   decision 3, not from a mixed-consumer example. A shared web package joins
   the stack of the Projects that use it, and one that both an in-stack Site
   and an in-stack App use follows `typescript-astro`, the stricter stack.
   Only in-stack dependents count: polity's landing Site, in no stack, does not
   move polity's shared packages out of `typescript-vite`. The shadcn rules
   apply in the package that holds `components.json`.
7. **Everything else follows `typescript-node`.** Both stacks require a
   `validate` script, which on Sites includes `astro check`, and required pull
   request checks that run it, in one job or as shards that together run every
   step. Each Project's _Setup and validation_ section names its stack's
   tools, a major bump is a breaking standards change, and neither stack
   installs a configuration file or a workflow file.
8. **Migrations.** The Projects to migrate are Repository Standards' `site/`;
   polity's `apps/web`, `packages/ui` and `packages/design`; and
   `minecraft-stream-guard-site`. This list sets no order between their
   repositories. `polity` and `minecraft-stream-guard-site` adopt Repo Canon
   before migrating, without separate adoption tickets. polity's `apps/landing`
   is a Site in no stack for now: it is excluded from the migration and must
   keep building, and its Astro rebuild waits for its real design. `manzai`
   migrates when work on it resumes, with `apps/web` in `typescript-vite` and
   `services/api` and `packages/protocol` in `typescript-node`.
   `font-inspector` stays dormant, and `hemiciclo`'s new Projects join
   whichever stack they fit at adoption.

## Amendment of ADR 0024

This ADR settles the web stack that ADR 0024's decision 4 left waiting for the
Astro verdict: oxlint with Prettier rather than Biome, and pnpm rather than
npm. It replaces decision 11's wait for the web stack with the migrations in
decision 8.

## Rejected alternatives

- Astro for every web Project: the trial showed nothing about client-side
  apps, whose code owns its routing and state in the browser.
- Vite for Sites: the trial passed for content and static sites, which Astro
  builds ahead of time with islands at most.
- One `typescript-web` stack with a framework choice: ADR 0024 has no stack
  choice, so each framework gets its own declaration over shared web rules.
- TypeScript 7 for Sites without `astro check`: it would leave `.astro` files
  without their only checker.
- Biome: every App that uses it also runs ESLint for React hooks and
  type-aware rules, its `.astro` support is experimental, and oxlint with
  Prettier keeps one linter and formatter across `typescript-node` and both web
  stacks.
- oxfmt: it is still at major 0.
- npm: repositories that mix stacks keep one `packageManager` and one lockfile
  at their workspace root, and `typescript-node` already uses pnpm 11.
- Vitest for Sites: Sites keep `typescript-node`'s `node --test`, and Vitest 5
  serves Apps built on Vite.
- A stack-owned shadcn integrity check: a stack ships no files under ADR 0024,
  so the Project owns `ui:check` and the stack's check reads only manifests
  and `components.json`.
- Fixing one shadcn visual style: the visual style after `base-` and the colour
  theme are each Project's own.

## Consequences

- Until the two declarations ship, the
  [usage page](../usage/stacks.md) only recommends both stacks; nothing is
  installed or checked for them.
- Sites' move to TypeScript 7 waits for `@astrojs/check` and ships as a
  breaking standards change.
- A shared web package's stack depends on which in-stack Projects use it, so
  bringing a Site or an App into a stack can move the packages it shares.
