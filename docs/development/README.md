# Development

This directory explains how to set up, validate, release, and maintain the
Repo Canon standards source.

## Setup and validation

Clone the repository with Git 2.32.0 or newer and use Node.js 24 or 26 with
pnpm 11, at the version that `packageManager` in `package.json` pins. Run
`pnpm install --frozen-lockfile` to install the pinned development
dependencies, including TypeScript 7, oxlint 1, and Prettier 3; tests run with
Node's test runner, `node --test`. The
standards source has no build step; parser dependencies are vendored. The
factory is developed in [its own repository](https://github.com/lutzseverino/scriptorium). Adopters do not install
development dependencies. GitHub planning uses authenticated `gh`
access. For source validation,
install public Repository Standards CLI 10.0.0 outside the checkout using the
[source profile instructions](source-profile.md#executable-prerequisites); CI
validates with the same version.

The factory toolchain image sets `pnpm_config_store_dir` to
`/home/agent/.local/share/pnpm/store`, outside the checkout and writable by the
runtime `agent` user. pnpm copies packages when the store and checkout are on
different filesystems. Local development keeps pnpm's platform defaults;
`.pnpm-store/` directories are ignored if a local or leftover store exists.
When a command needs a clean checkout, select a writable store outside it
without deleting or moving the existing cache. For example, from the repository
root, pnpm 11 supports a command-scoped environment setting:

```sh
pnpm_config_store_dir="$HOME/.local/share/pnpm/store" pnpm store path
pnpm_config_store_dir="$HOME/.local/share/pnpm/store" pnpm install --frozen-lockfile
```

Use the same setting for later installs with that store. pnpm 11 reads
`pnpm_config_*` variables; `npm_config_*` variables and non-authentication
`.npmrc` settings no longer configure it. See pnpm's
[v11 configuration reference](https://github.com/pnpm/pnpm.io/blob/0aab2bac6247c16409137037dbfcec731822b828/versioned_docs/version-11.x/configuring.md).

Run `pnpm run format` to format supported files locally with Prettier's defaults;
there is no configuration file. `.prettierignore` excludes vendored code,
installed Repository Standards state, installed skills (including Repo Canon's
own `babysit` skill), and the pnpm lockfile.

Run `pnpm validate`, focused tests for the changed behavior, and
`git diff --check` before opening a PR. `pnpm validate` runs, in order,
`pnpm run format:check`, `pnpm run lint`, `pnpm run check` (the `node --check`
syntax check), `pnpm run typecheck`, and `pnpm test`.

`pnpm run typecheck` runs `scripts/typecheck.mjs`, which runs TypeScript 7
with `tsconfig.json`: `checkJs`, without `strict` and with Node.js 24's types,
over every `.mjs` and `.js` file outside `node_modules/`, the installed
Repository Standards state in `.repo-standards/`, and `vendor/`. Authored code
stays JavaScript, typed with JSDoc where the checker needs it, so installed
scripts still run with plain `node` and no install. Imports bring three
vendored bundles into the program: `vendor/marked/marked.esm.js`,
`vendor/parse5/parse5.esm.js`, and `vendor/postern/postern.mjs`. They keep
their upstream bytes, so the script fails on every diagnostic except one
located in them; `test/typecheck.test.mjs` covers that filter.

Review affected links, issue-form fields, and consistency with the confirmed
preferences. A single fixture runs with
`node --test test/<name>.test.mjs`; `package.json` lists the named test groups.
Run `node --test test/repository-wide-rules.test.mjs` for a fresh adoption of
both profiles and repository-wide rules lookup with public CLI 10.0.0: the
GitHub rules in both profiles and the factory workflow rules only in the
factory profile. It confirms no `typescript-node-stack` scope in both profiles,
so no stack rules are installed and `repo-standards check` runs no stack check,
and adopts a third copy with one conforming package, whose `package.json` the
stack rules cover and whose stack check passes. It also checks that adoption installs the contribution guide
and the `triage` fork byte for byte. It uses
the release fixture's answers and a disposable source containing only declared
inputs; GitHub HTTP responses and Git transport use local fixtures, with no
in-tree factory dependency. Set `REPO_STANDARDS_PREFIX` to reuse that public
CLI installation, or the test installs it outside the checkout. Runtime
preparation also needs npm registry access.

Node.js 24 remains the default toolchain and installed automation runtime.
CI runs one job on each of Node.js 24 and 26 that installs the development
dependencies and runs `pnpm validate` and all-profile source validation. The
required `Test` check passes only when both jobs pass. Lint uses oxlint's
defaults plus
ESLint's `recommended` rules that oxlint does not enable by default, with Node
globals, as named in `.oxlintrc.json`. It excludes `vendor/`, `.repo-standards/`,
and installed skills under `.agents/skills/`. Both warnings and errors fail
lint.

The Node test suite exercises executable operation fixtures, including
disposable remote-label and PR-integration state with interruption recovery,
plus pull request creation and update event inputs. It covers valid and invalid
metadata, harmless formatting variations, a hostile fork payload, and
issue-contract structure, exact revision association, actor authority,
invalidation, and repeated or stale events. The GitHub setup fixtures do not
contact GitHub or establish live remote setup. Run
`pnpm run test:issue-contracts` for the focused issue-contract fixtures and
`pnpm run test:planning-skill-fixtures` for the planning-skill harness. The
issue-contract group includes `test/planning-shape-rules.test.mjs`, which
checks that the Agent Brief and Wayfinder shapes the GitHub rules state agree
with the validator's accepted and rejected issues. Run
`node --test test/babysit-wait.test.mjs` for the `babysit` wait script's
decision, driven by reviewer data fixtures (including real summary comments),
and its silence, driven by
the published bundle with an injected fetch transport. Run `node --test test/pull-request-reviewer-check.test.mjs`
for the optional reviewer schema check, including retained operation resources;
the check's parser, `operations/lib/pull-request-reviewer.mjs`, has a
byte-identical copy in `babysit`'s directory for the wait.
Run `node --test test/factory-review-policy-check.test.mjs` for the optional
policy adoption check's absence, app identities, invalid schemas, file-read
errors and preservation, including retained resources without runtime packages.
Its reader, `operations/lib/review-policy.mjs`, is byte-identical to babysit's
`review-policy.mjs`; conformance coverage keeps both schema readers aligned.
Run `node --test test/babysit-request.test.mjs test/babysit-wait.test.mjs`
for app-author policy matching, explicit rejection of human-login declarations
with or without a reviewer, independent request emission and wait classification,
preserved request bounds and check waits, and installed executable resources
without runtime packages. The
repository-owned `.github/factory-review-policy.json` is optional; neither
profile installs a declaration or enrolls adopters in skipping external review.
Run `node --test test/babysit-trusted-config.test.mjs` for installed request and
wait regressions against independent remote configuration and proposed local
files. Run `node --test test/babysit-destination.test.mjs` for installed request,
wait and merge destination selection with a configured GitHub CLI default,
`GH_REPO`, explicit overrides and the `origin` fallback, including trusted reads,
mutations and selection failures. The commands resolve the destination default
branch once through Postern Access, then read both configurations at that commit; GraphQL errors and
incomplete, non-blob or truncated file results fail explicitly. An explicit null
file result with a verified commit is supported absence. The fixtures cover
policy and reviewer additions, edits and deletions, fork and nondefault-base
PRs, retargeting and changing heads during polling, a moving default tip,
resumed invocations, request bounds and read failures. The final command line
identifies the selected repository, default branch and full commit SHA while
the wait remains silent during polling. Malformed JSON or schema-invalid
trusted declarations return exit `7` from request and wait with the affected
file, validation problem and required default-branch correction for an owner
handoff; invocation and platform errors retain exit `1`. The installed-command
fixtures also cover selecting a corrected trusted revision on a fresh
invocation, without a fallback to proposed or local files.
Run `node --test test/triage-ready.test.mjs` for the triage readiness command's
revision, account, label, validator-event and parent-link fixtures, including
its installed layout without npm. These cover person, Bot and App reviewers
across standard and factory destinations, factory no-write handoffs,
identity/applicability read failures and exact approval association. Factory
applicability comes from the selected destination's installed
`.repo-standards/rules/factory-workflow.md` at a pinned default-branch commit;
verified absence permits the generic account policy, while a failed read
permits no readiness writes. Actor discovery uses GraphQL `viewer`'s type,
login and database ID, then the REST `/users/{login}` account type with the
same credential; these reads support App installation tokens, unlike `/user`.
GraphQL names a Bot without the `[bot]` suffix of REST logins and events, so
the command adds it back as Postern's GraphQL account mapping does, and the
REST account's ID must match the viewer's. See GitHub's
[installation authentication example](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id)
and [user lookup endpoint](https://docs.github.com/en/rest/users/users#get-a-user).
The command uses the vendored Postern
bundle and the current GitHub CLI credential. Its caller bounds the foreground
wait; the command has no invocation timeout.
Run `node --test test/babysit-merge.test.mjs` for the explicit squash message
and head-change retry behavior against the same Postern transport fixture.
The delivery conformance cases in `test/repository-conformance.test.mjs`
cover worker handoffs, orchestrator merge ownership, either source of an
owner-review designation, renewed approval after a head change, and skipped
work without an owner-review requirement.
The public source-validation command and its boundary are described in
[the source profile](source-profile.md).

Run `node --test test/typescript-node-stack-yaml.test.mjs` for the stack
readers' differential checks against the pinned, development-only `yaml`
package. They reuse the reader fixtures and a bounded deterministic corpus
of scalar, list, indentation and catalog forms; disagreements print the case,
input and both interpretations. Unsupported workspace forms may be rejected,
and catalogs may omit unsupported entries, but every accepted pattern and
returned catalog entry must agree with the reference without scalar coercion.
The focused stack check and scope-drafter suites also exercise regressions and
valid catalogs from retained resources without the reference dependency.

Run `pnpm run test:productivity-skill-fixtures` to rebuild and verify the
disposable local repositories used for the two productivity skill exercises.
[Skill exercises](skill-exercises.md) describes all three fixture builders and
the harness that exercises the skills.

This repository takes the same path every adopter takes, so the suite also runs
the shipped Repository README, Project README, and documentation checks against
this repository's own root through the operation request helper, with the
documentation tree, the root [glossary](../../GLOSSARY.md), and the
[authoring notes](../../authoring-notes.md) as its documentation scope. The
repository has no Project README, and `standards.yaml` supplies the other
active file declarations. The same fixture asserts that only the
`factory` profile declares the `.factory/` files and the sandbox image
workflow, that `standards.yaml` declares no pull request reviewer file, and
that `.factory/config.json` holds factory configuration version 1 with Repo
Canon's labels, model label prefix and prompt. It also
fails if any tracked file reaches the CLI's 8 MiB per-file observation limit,
which would make the repository uninspectable before any report. It lists each
declaration that has rules or adoption guidance with its decided outcome, keeps
every rules file in `rules/`, rejects a rules file holding a one-time step's
marker phrase, and keeps rules paths out of `AGENTS.md`. It also holds
`CONTRIBUTING.md` and `AGENTS.md` to fixed word budgets, counting each
maximal run of non-whitespace characters as a word; a document over its limit
fails naming the document, its count, and the limit. The limits are constants
in the test, so raising one is an explicit edit in the same pull request. No
budget covers declaration rules or retained adoption guidance. It also keeps
the two copies of the reviewer parser identical, and keeps the user-invoked
`orchestrate` skill application-independent, checking every file in its
installed directory and its authoring and adoption guidance for private
application names, tool mappings and session-reference syntax. Run it alone
with `node --test test/repository-conformance.test.mjs`. It needs no separate
CI step: `pnpm test` already runs it on every pull request.
The same suite checks every declared source input across both profiles for
branch-following GitHub document links to `lutzseverino` repositories. It
accepts full commit SHAs and reads published tag and branch refs with
`git ls-remote`, so this check requires network access to those repositories.

## Documents

- [Authoring and publication](authoring-and-publication.md): the separate
  stages of source authoring, publication, and adoption.
- [Release procedure](release.md): released bytes, the reviewed diff, the rule
  for changed selected bytes, the single release pull request, release notes,
  and publication and verification, with the read-only release scripts.
- [Adoption compatibility](adoption-compatibility.md): the supported v2
  mapping, validation baseline, preserving project instructions, and the
  route for GitHub repository settings.
- [GitHub label setup](github-label-setup.md): repeat-safe label provisioning,
  identity and permission prerequisites, its readiness probe, protocol
  outcomes, and fixture coverage.
- [GitHub PR integration setup](github-pr-integration-setup.md): required-check
  enforcement, squash-only merge defaults, its readiness probe, preservation,
  and recovery behavior.
- [Pull request metadata validation](pr-metadata-validation.md): trusted check
  behavior, stable identity, permissions, and local verification.
- [Standards update workflow](standards-update-workflow.md): opt-in caller,
  token selection, rolling updates, deferred remote setup, and validation.
- [Babysit merge script](babysit-merge.md): explicit squash message, verbatim
  body transport, head-change retry, and executable fixtures.
- [Issue contract validation](issue-contract-validation.md): supported issue
  shapes, feedback behavior, workflow state, workflow permissions, and runnable
  fixtures.
- [Upstream skill compatibility](upstream-compatibility.md): the pinned
  Matt Pocock snapshot, its review and update steps, the native
  issue formats that
  automation must respect, and how shared instructions and configuration adapt
  upstream setup.
- [Repository README check](repository-readme-check.md): operation protocol,
  outcomes, prerequisites, and focused fixture command.
- [Sandbox image build workflow](sandbox-image-workflow.md): the factory
  profile's pull request job, change detection, toolchain build, permissions,
  and executable fixtures.
- [Documentation and Project README checks](documentation-check.md): concrete
  scope, structural outcomes, prerequisites, and focused fixture commands.
- [Documentation scope drafter](documentation-scope-drafter.md): drafting the
  documentation scope from a repository tree, its rules and questions, its
  source of other declarations' targets, and its fixtures.
- [typescript-node stack check](typescript-node-stack-check.md): the manifest
  facts it checks per confirmed Project, workspace roots, accepted ranges, and
  its fixtures.
- [typescript-node stack scope drafter](typescript-node-stack-scope-drafter.md):
  drafting one `package.json` per Project from manifests and workspaces, no
  scope, its questions, and its fixtures.
- [Standards source profile](source-profile.md): the standard and factory
  profiles' ownership, declarations, executable prerequisites, and the
  validation boundary.
- [Skill exercises](skill-exercises.md): the procedure, fixture builders,
  common harness, and scenarios for exercising the pinned skills, the `triage`
  fork, and the `babysit` skill.
