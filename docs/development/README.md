# Development

This directory explains how to set up, validate, release, and maintain the
Repo Canon standards source.

## Setup and validation

Clone the repository with Git and use Node.js 24 and npm. The source needs no
package installation, typecheck, or build step; parser dependencies are
vendored. GitHub planning uses authenticated `gh` access. For source validation,
install public Repository Standards CLI 2.0.0 outside the checkout using the
[source profile instructions](source-profile.md#executable-prerequisites); CI
validates with the same version.

Run focused tests for the changed behavior, `npm run check`, and
`git diff --check` before opening a PR. Review affected links, issue-form fields,
and consistency with the confirmed preferences. A single fixture runs with
`node --test test/<name>.test.mjs`; `package.json` lists the named test groups.
CI runs the full `npm test` suite and all-profile source validation.

The Node test suite exercises executable operation fixtures, including
disposable remote-label and PR-integration state with interruption recovery,
plus pull request creation and update event inputs. It covers valid and invalid
metadata, harmless formatting variations, a hostile fork payload, and
issue-contract structure, exact revision association, actor authority,
invalidation, and repeated or stale events. The GitHub setup fixtures do not
contact GitHub or establish live remote setup. Run
`npm run test:issue-contracts` for the focused issue-contract fixtures and
`npm run test:planning-skill-fixtures` for the planning-skill harness. The
public source-validation command and its boundary are described in
[the source profile](source-profile.md).

Run `npm run test:productivity-skill-fixtures` to rebuild and verify the
disposable local repositories used for the seven productivity skill exercises.
[Skill exercises](skill-exercises.md) describes all three fixture builders and
the harness that exercises the skills.

This repository takes the same path every adopter takes, so the suite also runs
the three shipped checks against this repository's own root through the
operation request helper, with the documentation tree, the repository-root
glossary [`CONTEXT.md`](../../CONTEXT.md), and the
[authoring notes](../../authoring-notes.md) as its documentation scope. The
same fixture fails if any tracked file reaches the CLI's 8 MiB per-file
observation limit, which would make the repository uninspectable before any
report. Run it alone with
`node --test test/repository-conformance.test.mjs`. It needs no separate CI
step: `npm test` already runs it on every pull request.

## Documents

- [Release procedure](release.md): released bytes, the reviewed diff, the rule
  for changed selected bytes, the single release pull request, release notes,
  and publication and verification, with the read-only release scripts.
- [Adoption compatibility](adoption-compatibility.md): the supported v2
  mapping, validation baseline, adoption preparation requirements, and the
  route for GitHub repository settings.
- [GitHub label setup](github-label-setup.md): repeat-safe label provisioning,
  identity and permission prerequisites, protocol outcomes, and fixture coverage.
- [GitHub PR integration setup](github-pr-integration-setup.md): required-check
  enforcement, squash-only merge defaults, preservation, and recovery behavior.
- [Pull request metadata validation](pr-metadata-validation.md): trusted check
  behavior, stable identity, permissions, and local verification.
- [Issue contract validation](issue-contract-validation.md): supported issue
  shapes, feedback behavior, workflow permissions, and runnable fixtures.
- [Matt Pocock workflow compatibility](upstream-compatibility.md): the pinned
  skill snapshot, its review and update steps, the native issue formats that
  automation must respect, and how shared instructions and configuration adapt
  upstream setup.
- [Repository README check](repository-readme-check.md): operation protocol,
  outcomes, prerequisites, and focused fixture command.
- [Documentation and Project README checks](documentation-check.md): concrete
  scope, structural outcomes, prerequisites, and focused fixture commands.
- [Standards source profile](source-profile.md): complete profile ownership,
  declarations, executable prerequisites, and the validation boundary.
- [Skill exercises](skill-exercises.md): the procedure, fixture builders,
  common harness, and scenarios for exercising the pinned skills.
