# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

- [First release](first-release.md): publication procedure, immutable source verification,
  release notes, and the delivery boundary that real adoption completed.
- [Release v0.1.1](release-v0-1-1.md): verified publication, the corrected
  workflow failure, refreshed source identity, patch release notes, and
  evidence boundary.
- [Release v0.2.0](release-v0-2-0.md): verified publication, the breaking
  required-CLI change, its impact and migration, refreshed source identity,
  minor release notes, and evidence boundary.
- [First real adoption](real-adoption.md): the merged Repository Standards
  adoption, its run identities, the surfaced defects, the authorized required-check
  bypass, packaged-output validation, and remote readback.
- [Self-adoption of v0.2.0](self-adoption.md): this repository's own adoption of
  its published release, the confirmed inspection identity and scope, the
  operation results, and what self-adoption could and could not surface.
- [Adoption compatibility](adoption-compatibility.md): supported v2 mapping,
  validation baseline, preparation requirements, and historical v1 limits.
- [Complete source acceptance](completion-record.md): final source identity,
  parent requirement accounting, evidence classes, and publication prerequisite.
- [Complete adoption evidence](adoption-evidence.md): disposable repository
  matrix, public-package execution, authorized remote readback, and cleanup.
- [GitHub label setup](github-label-setup.md): repeat-safe label provisioning,
  identity and permission prerequisites, protocol outcomes, and fixture coverage.
- [GitHub PR integration setup](github-pr-integration-setup.md): required-check
  enforcement, squash-only merge defaults, preservation, and recovery behavior.
- [Pull request metadata validation](pr-metadata-validation.md): trusted check
  behavior, stable identity, permissions, and local verification.
- [Historical scope proposal](scope-capability-specification.md): the original
  product requirement, superseded by the delivered product contract.
- [Shared material review](shared-material-review.md): finalized contribution,
  agent workflow, template, and preparation evidence.
- [Issue contract validation](issue-contract-validation.md): supported issue
  shapes, feedback behavior, workflow permissions, and runnable fixtures.
- [Upstream compatibility](upstream-compatibility.md): the regular skill
  inventory and native issue formats that automation must respect.
- [Repository README check](repository-readme-check.md): operation protocol,
  outcomes, prerequisites, and focused fixture command.
- [Documentation and Project README checks](documentation-check.md): concrete
  scope, structural outcomes, prerequisites, and focused fixture commands.
- [Standards source profile](source-profile.md): complete profile ownership,
  declarations, prerequisites, validation, and evidence boundaries.
- [Source closure comparison](source-closure.json): reproducible path, mode,
  Git blob, and SHA-256 accounting for the reviewed source refresh.
- [Engineering skill exercises](engineering-skill-exercises.md): scenarios,
  runtime evidence, harness provenance, and limitations for nine skills.
- [Productivity skill exercises](productivity-skill-exercises.md): runtime
  scenarios, outcomes, retained artifacts, prerequisites, and limitations.
- [Planning skill exercises](planning-skill-exercises.md): runtime evidence,
  native artifacts, and limitations for the planning, delivery, and
  adoption-preparation skills.

## Authoring status

The design decisions are recorded. Review material lives under `drafts/`;
confirmed choices live in [authoring notes](../../authoring-notes.md). The root
contribution guidance, shared agent configuration, GitHub templates, and
contextual source guidance have completed material review. `standards.yaml`
defines the complete source profile.

The required product scope capability is delivered. Pull request
metadata validation, issue contract validation, Repository README checking,
GitHub label setup, PR integration setup, and their CI suites are implemented.
The source declares public CLI 1.3.0 as its exact validation baseline.
The successful CLI 1.2.1 local validation and earlier CLI 1.1.0 experiments
remain historical evidence. Operation fixtures, the pinned skill inventory,
and the engineering, productivity, and planning skill exercises remain separate
from source validation. Final source validation, complete adoption,
scope-protection, preservation, and authorized remote-readback evidence are
recorded in [the adoption evidence](adoption-evidence.md). The
[complete source acceptance record](completion-record.md) accounts for the
separate evidence classes and the current accepted identity. Issue
[#46](https://github.com/lutzseverino/repo-canon/issues/46) reviewed the
integrated #44 and #45 architecture work, recomputed the 115-file closure, and
completed the affected public adoption refresh. The first permanent selection
is `v0.1.0`; [release delivery](first-release.md) covers its verified
publication. The `v0.1.1` patch corrected the installed PR metadata workflow
and refreshed the accepted identity at `8369d82`;
[release v0.1.1](release-v0-1-1.md) covers it. `v0.2.0` then moves the exact
required CLI version from 1.2.2 to 1.3.0, a breaking standards change and the
only selected byte change since `v0.1.1`;
[release v0.2.0](release-v0-2-0.md) covers it, and it is the current release.
`v0.1.1` stays published and selectable for adopters that remain on public CLI
1.2.2.
Repository Standards completed and merged the first real adoption from the
`v0.1.x` public pins; [first real adoption](real-adoption.md) records it,
including the defects it surfaced. Adopters verify the published release before
inspection.

## Working locally

Clone the repository with Git and use Node.js 24 and npm. The source needs no
package installation, typecheck, or build step; parser dependencies are
vendored. GitHub planning uses authenticated `gh` access. For source validation,
install the public Repository Standards CLI outside the checkout using the
[source profile instructions](source-profile.md#executable-prerequisites).

## Current validation

Run focused tests for the changed behavior, `npm run check`, and
`git diff --check` before opening a PR. Review affected links, issue-form fields,
and consistency with the confirmed preferences. A single fixture runs with
`node --test test/<name>.test.mjs`; `package.json` lists the named test groups.
CI runs the full `npm test` suite and all-profile source validation. Complete
independent reviews and require passing checks before merging.

The Node test suite exercises executable operation fixtures, including
disposable remote-label and PR-integration state with interruption recovery,
plus pull request creation and update event inputs. It covers valid and invalid
metadata, harmless formatting variations, a hostile fork payload, and
issue-contract structure, exact revision association, actor authority,
invalidation, and repeated or stale events. The GitHub setup fixtures do not
contact GitHub or establish live remote setup. Run
`npm run test:issue-contracts` for the focused issue-contract fixtures and
`npm run test:planning-skill-fixtures` for the planning-skill harness. The four
draft issue forms were parsed as YAML and checked for basic field structure and
duplicate IDs during bootstrap; no GitHub submission behavior was exercised.
The public source-validation command and its evidence boundary are recorded in
[the source profile](source-profile.md). Complete adoption remains a separate
evidence class recorded in [the adoption evidence](adoption-evidence.md).

Run `npm run test:productivity-skill-fixtures` to rebuild and verify the
disposable local repositories used for the seven productivity skill exercises.

This repository takes the same path every adopter takes, so the suite also runs
the three shipped checks against this repository's own root through the
operation request helper, with the documentation tree, the repository-root
glossary `CONTEXT.md`, and the two root decision records as the confirmed
documentation scope that [self-adoption](self-adoption.md) confirmed. The same fixture fails if any
tracked file reaches the CLI's 8 MiB per-file observation limit, which would
make the repository uninspectable before any report. Run it alone with
`node --test test/repository-conformance.test.mjs`. It needs no separate CI
step: `npm test` already runs it on every pull request.
