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
the standard and factory profiles and repository-wide rules lookup with public
CLI 10.0.0: the comment and GitHub rules in both and the factory workflow
rules only in the factory profile. It confirms no `typescript-node-stack` scope in both profiles,
so no stack rules are installed and `repo-standards check` runs no stack check,
and adopts a third copy with one conforming package, whose `package.json` the
stack rules cover and whose stack check passes. It also checks that adoption installs the contribution guide
byte for byte, every owned skill whole from `.agents/skills/`, and, apart
from each skill's `CREDITS.md`, the upstream base's bytes for every skill and
setup file identical to its base. It uses
the release fixture's answers and a disposable source containing only declared
inputs; GitHub HTTP responses and Git transport use local fixtures, with no
in-tree factory dependency. Set `REPO_STANDARDS_PREFIX` to reuse that public
CLI installation, or the test installs it outside the checkout. Runtime
preparation also needs npm registry access.
Run `node --test test/workbench-profile.test.mjs` for the `workbench` profile.
It reads `standards.yaml` and fails when the profile would select any default
declaration besides the workflow skills, the files their executables import
and the license notices, so a new default declaration fails it until the
profile excludes it. With public CLI 10.0.0 and the same disposable source and
fixtures, it then adopts the profile into a repository holding only an empty
commit. The adoption must ask no scope, assessment or remote setup question,
write no rules, `.github/` file or `AGENTS.md`, and leave every installed skill
command able to import its modules. An update to a release that changes one
skill then lands as one direct commit on `main` touching only that skill and
the CLI's records.

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
the published bundle with an injected fetch transport.
Run `node --test test/orchestrate-wait.test.mjs` for the `orchestrate` wait
script's three exits (an item changed, the maximum duration reached, and an
error), driven by a stubbed tracker through the published bundle with an
injected fetch transport and by workbench files. Its directory item cases
cover a file created, edited or removed in the directory, and, in real
temporary Git repositories, an upstream commit touching it pushed from another
clone, one fetched before arming and then pulled, one touching only a nested
directory, a workbench with no remote, and a failed upstream fetch, which is an
error. It also covers each required
duration's omission and invalid values and the script's plain `node` run. The
script reuses `babysit`'s GitHub CLI connection, as the triage readiness
command does.
Run `node --test test/pull-request-reviewer-check.test.mjs`
for the optional reviewer schema check, including retained operation resources;
the check imports babysit's `pull-request-reviewer.mjs` directly from its
source-relative retained resource path.
Run `node --test test/factory-review-policy-check.test.mjs` for the optional
policy adoption check's absence, app identities, invalid schemas, file-read
errors and preservation, including retained resources without runtime packages.
The check imports babysit's `review-policy.mjs` as a retained resource too;
CLI 10.0.0 preserves both resources' source-relative paths.
Run `node --test test/babysit-request.test.mjs test/babysit-wait.test.mjs`
for app-author policy matching, explicit rejection of human-login declarations
with or without a reviewer, independent request emission and wait classification,
preserved request bounds and check waits, and installed executable resources
without runtime packages. The
repository-owned `.github/factory-review-policy.json` is optional; neither
profile installs a declaration or enrolls adopters silently in skipping external
review. First factory selection asks about a separate post-run opt-in; routine
factory updates and standard-only runs do not ask. The reviewer check and
request/wait fixtures cover omission defaulting to four requests, explicit
finite bounds and the deliberate `"unbounded"` schema value, without creating
a reviewer when its file is absent.
Run `node --test test/babysit-body-links.test.mjs test/babysit-request.test.mjs`
for pre-review own-head file links (exit `8`), encoded refs and source-fork
identity, and the exact adoption-summary exemption. The offline fixtures use
real temporary Git worktrees and a stub pinned runtime whose summary depends
on uncommitted changes. They distinguish clean-head from reconstructed
pre-commit output, cover appended and mismatching sections, install/generation
failures and missing local bases, and verify cleanup and author-worktree
preservation. Production installs the head's runtime lockfile with `npm ci`;
these fixtures never contact the registry.
Run `node --test test/pinned-files.test.mjs` for the shared pinned file reader's
complete text, verified absence, truncation and moving-tip cases.
Run `node --test test/babysit-trusted-config.test.mjs` for installed request and
wait regressions against independent remote configuration and proposed local
files. Run `node --test test/babysit-destination.test.mjs` for installed request,
wait and merge destination selection with a configured GitHub CLI default,
`GH_REPO`, explicit overrides and the `origin` fallback, including trusted reads,
mutations and selection failures. The real CLI fixtures also cover configured
enterprise defaults being refused before HTTP in request, wait, merge and
readiness, SSH defaults and hostname aliases, resolved parent identities and
overrides. The shared
resolver recovers the configured default host from local Git remote configuration
because the CLI default display omits it; an unresolved or ambiguous identity
fails without falling back. The commands resolve the destination default
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
its installed layout without npm. These cover person, Bot and App accounts
across standard and factory destinations, whose readiness the validator's
verdict alone decides, identity and factory configuration read failures, and
exact approval association. They also cover effective factory model-label
cardinality under the configured prefix, reuse of a matching issue label,
missing repository-label creation with shared metadata, preservation of
existing labels, provisioning failures without readiness, and parent,
specification and standard-profile exemptions. The model prefix and ready
label come from the selected destination's installed
`.repo-standards/rules/factory-workflow.md` and `.factory/config.json` at one
pinned default-branch commit; verified absence of the rules requires no model
label, while a failed read permits no readiness writes. Actor discovery uses
GraphQL `viewer`'s type and login with the same credential, which supports App
installation tokens, unlike `/user`. GraphQL names a Bot without the `[bot]`
suffix of REST logins and events, so the command adds it back as Postern's
GraphQL account mapping does. See GitHub's
[installation authentication example](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation#using-octokitjs-to-authenticate-with-an-installation-id).
The command uses the vendored Postern
bundle and the current GitHub CLI credential. Its caller bounds the foreground
wait; the command has no invocation timeout. It reads the validator's published
result through the validator's own reader. Run
`node --test test/issue-contract-result.test.mjs` for that result's format,
rules and the examples that the validator and the command both run.
Run `node --test test/review-round.test.mjs` for the `review` skill's round
command: rounds counted by head from the running account's standing reviews
only, owner gates on the pull request, its closing issues and named issues,
posting only one review of the current head per account, and the `held`
fact: the running account's latest review, including an App installation's,
is a holding review of the current head. That fact alone resumes delivery or
lets a draft be marked ready. The tests run against an injected fetch transport and from the
installed layout.
`test/babysit-merge.test.mjs` also checks that the review it posts is the
internal review record merge accepts for an app-authored pull request.
Run `node --test test/babysit-merge.test.mjs` for the explicit squash message
and head-change retry behavior against the same Postern transport fixture,
including independent trusted-policy selection and the current-head internal
review gate. A missing or incomplete current-head review returns merge exit
`5`: post the completed review, then rerun. Wait exit `6` prints its full-head
template; an unfilled template never counts as completed review evidence.
The merge fixtures also cover the repository- and release-hold exit `9`,
labelled issues and PRs, the shipped configuration, self-exemption,
multiple holds, closed PRs, removed labels, absent configuration and keys,
trusted pinned factory configuration, and failed reads without merge writes.
The merge fixtures exercise a behind PR and two initially green PRs delivered
sequentially, refusing pending or failed replacement-head checks.
The public-CLI adoption fixtures in
`test/repository-wide-rules.test.mjs` verify that both profiles install the
shared GitHub rules byte for byte.
The public source-validation command and its boundary are described in
[the source profile](source-profile.md).

Run `node --test test/upstream-bases.test.mjs` for the owned skills' and
setup files' upstream bases: `node scripts/upstream-bases.mjs check` on this
repository and on disposable copies with a mismatched base, an identical file
claiming edits, a differing file claiming none, missing or dropped credits, a
dropped license notice and a snapshot source, and the three-way
reconciliation, including the dry run on the current base that changes
nothing.

Run `node --test test/owned-skill-reads.test.mjs` for the owned skills'
standalone use: `node scripts/owned-skill-reads.mjs check` on this repository,
and fixture skills that name an undeclared path, name an agent host
application, or leave a Reads entry without its behavior when the file is
missing. The check reads every file of each declared skill. In
Markdown it reads paths outside fenced code blocks and double-quoted text,
which illustrate; in scripts it reads the whole text, including imports. A
path is allowed when it is inside the skill or listed in the `## Reads`
section of the skill's `SKILL.md`, whose entries may hold `<placeholder>`
segments, `*` globs and directories ending in `/`. A relative import of a
sibling skill's file is allowed when the Reads section names that skill.

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
disposable local repositories used for the productivity skill exercises.
[Skill exercises](skill-exercises.md) describes all three fixture builders and
the harness that exercises the skills.

Tests check behaviour and structure, never the wording of rules, skills or
documents; license notices are the one exact text they compare
([ADR 0032](../adr/0032-test-behaviour-and-structure-not-wording.md)).

Run `node --test test/repository-conformance.test.mjs` for the repository's
own documentation and README checks, profile declarations, factory
configuration, source size limits, upstream snapshot integrity, installed skill
structure, and license notices. The suite uses the shared YAML reader for
`standards.yaml` and the rendered Markdown readers for headings and links.
It preserves single-home checks, entry-document word budgets, and
`orchestrate`'s required sections, reference links, application independence and
120-line core limit. License notices in owned skills and notices linked from
`THIRD_PARTY_NOTICES.md` are checked against their vendored licenses, including
fixtures with dropped or altered notices. Rule and skill wording stays with
pull request review and release skill exercises, as ADR 0032 decides above.
The fixture-builder suites check repositories' files, issue metadata, linked
skills, provenance and Git state, and execute their local commands without
pinning exercise prose.

The conformance suite also checks every declared source input across all
profiles for branch-following GitHub document links to `lutzseverino`
repositories. It accepts full commit SHAs and reads published tag and branch
refs with `git ls-remote`, so this check requires network access. `pnpm test`
already runs the suite on every pull request.

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
  shapes, feedback behavior, workflow state, workflow permissions, the one-time
  closed-issue label sweep, and runnable fixtures.
- [Upstream skill compatibility](upstream-compatibility.md): the vendored
  Matt Pocock snapshot as the owned skills' upstream base, the shared base record, provenance rendering and
  its check, the three-way reconciliation for each upstream release, the native
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
  common harness, and scenarios for exercising the owned workflow skills,
  including `triage`, `babysit` and `review`.
- [TypeScript web stack checks](typescript-web-stack-check.md): manifest and
  shadcn holder checks and their assessment boundary.
- [TypeScript web stack scope drafters](typescript-web-stack-scope-drafter.md):
  semantic membership, shared consumers and installed discovery fixtures.
