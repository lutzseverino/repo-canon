# Development

This directory explains how to set up, validate, release, and maintain the
Repo Canon standards source.

## Setup and validation

Clone the repository with Git 2.32.0 or newer and use Node.js 24 and npm. Run
`npm ci --include=dev` to install the pinned development dependencies. The
standards source has no build step; parser dependencies are vendored. The factory package runs
TypeScript through Node.js 24 type stripping and has its own typecheck and tests;
follow the [factory development index](../../factory/docs/development/README.md)
for its checks. Adopters do not install development dependencies. GitHub planning uses authenticated `gh`
access. For source validation,
install public Repository Standards CLI 7.0.0 outside the checkout using the
[source profile instructions](source-profile.md#executable-prerequisites); CI
validates with the same version.

Run `npm run format` to format supported files locally with Prettier's defaults;
there is no configuration file. `.prettierignore` excludes vendored code,
installed Repository Standards state, installed skills (including Repo Canon's
own `babysit` skill), and the npm lockfile.

Run focused tests for the changed behavior, `npm run format:check`,
`npm run lint`, `npm run check`, and `git diff --check` before opening a PR.
Review affected links, issue-form fields, and consistency with the confirmed
preferences. A single fixture runs with
`node --test test/<name>.test.mjs`; `package.json` lists the named test groups.
CI installs development dependencies and runs the format check, lint, the full
`npm test` suite, and all-profile source validation. A separate factory job
installs the package dependencies and runs `tsc --noEmit` and its tests. The lint
step uses oxlint's defaults plus
ESLint's `recommended` rules that oxlint does not enable by default, with Node
globals, as named in `.oxlintrc.json`. It excludes `vendor/`, `.repo-standards/`,
and installed skills under `.agents/skills/`. Both warnings and errors fail the
lint step.

The Node test suite exercises executable operation fixtures, including
disposable remote-label and PR-integration state with interruption recovery,
plus pull request creation and update event inputs. It covers valid and invalid
metadata, harmless formatting variations, a hostile fork payload, and
issue-contract structure, exact revision association, actor authority,
invalidation, and repeated or stale events. The GitHub setup fixtures do not
contact GitHub or establish live remote setup. Run
`npm run test:issue-contracts` for the focused issue-contract fixtures and
`npm run test:planning-skill-fixtures` for the planning-skill harness. Run
`node --test test/babysit-wait.test.mjs` for the `babysit` wait script's
decision, driven by reviewer data fixtures (including real summary comments),
and its silence, driven by
a GitHub CLI fake. Run `node --test test/pull-request-reviewer-check.test.mjs`
for the optional reviewer schema check, including retained operation resources;
the check's parser, `operations/lib/pull-request-reviewer.mjs`, has a
byte-identical copy in `babysit`'s directory for the wait.
Run `node --test test/babysit-merge.test.mjs` for the explicit squash message
and head-change retry behavior against the same fake GitHub CLI.
The public source-validation command and its boundary are described in
[the source profile](source-profile.md).

Run `npm run test:productivity-skill-fixtures` to rebuild and verify the
disposable local repositories used for the two productivity skill exercises.
[Skill exercises](skill-exercises.md) describes all three fixture builders and
the harness that exercises the skills.

This repository takes the same path every adopter takes, so the suite also runs
the shipped Repository README, Project README, and documentation checks against
this repository's own root through the operation request helper, with the
documentation tree, the root [glossary map](../../GLOSSARY-MAP.md), both context
glossaries, the factory documentation tree, and the
[authoring notes](../../authoring-notes.md) as its documentation scope. The
Project README scope is `factory/README.md`, and `standards.yaml` supplies the
other active file declarations. The same fixture asserts that only the
`factory` profile declares the `.factory/` files and the sandbox image
workflow, that `standards.yaml` declares no pull request reviewer file, and
that the factory package's own parser accepts `.factory/config.json`. It also
fails if any tracked file reaches the CLI's 8 MiB per-file observation limit,
which would make the repository uninspectable before any report. It lists each
declaration that has rules or adoption guidance with its decided outcome, keeps
every rules file in `rules/`, rejects a rules file holding a one-time step's
marker phrase, and keeps rules paths out of `AGENTS.md`. It also keeps the two
copies of the reviewer parser identical. Run it alone
with `node --test test/repository-conformance.test.mjs`. It needs no separate
CI step: `npm test` already runs it on every pull request.
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
  mapping, validation baseline, adoption preparation requirements, and the
  route for GitHub repository settings.
- [GitHub label setup](github-label-setup.md): repeat-safe label provisioning,
  identity and permission prerequisites, its readiness probe, protocol
  outcomes, and fixture coverage.
- [GitHub PR integration setup](github-pr-integration-setup.md): required-check
  enforcement, squash-only merge defaults, its readiness probe, preservation,
  and recovery behavior.
- [Pull request metadata validation](pr-metadata-validation.md): trusted check
  behavior, stable identity, permissions, and local verification.
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
- [Standards source profile](source-profile.md): the standard and factory
  profiles' ownership, declarations, executable prerequisites, and the
  validation boundary.
- [Skill exercises](skill-exercises.md): the procedure, fixture builders,
  common harness, and scenarios for exercising the pinned skills and the
  `babysit` skill.
