# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

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

The required product scope capability is delivered and accepted. Pull request
metadata validation, issue contract validation, Repository README checking,
GitHub label setup, PR integration setup, and their CI suites are implemented.
The source declares public CLI 1.2.2 as its exact final validation baseline.
The successful CLI 1.2.1 local validation and earlier CLI 1.1.0 experiments
remain historical evidence. Operation fixtures, the pinned skill inventory,
and the engineering, productivity, and planning skill exercises remain separate
from source validation. Final source validation, complete adoption,
scope-protection, preservation, and authorized remote-readback evidence are
recorded in [the adoption evidence](adoption-evidence.md). The
[complete source acceptance record](completion-record.md) accounts for the
separate evidence classes and final source identity. Repo Canon remains untagged
and unreleased; stable publication is the remaining prerequisite before the
accepted source can be selected from this repository.

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
