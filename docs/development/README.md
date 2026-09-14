# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

- [Adoption compatibility](adoption-compatibility.md): supported v2 mapping,
  validation baseline, preparation requirements, and historical v1 limits.
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
- [Engineering skill exercises](engineering-skill-exercises.md): disposable
  repositories and runtime evidence for the remaining engineering skills.
  The [curated transcript](engineering-skill-runtime-transcript.md),
  [architecture report](engineering-skill-architecture-report.html), and
  [research result](engineering-skill-research-result.md) retain the observed
  session outputs; the [runtime-builder patch](engineering-skill-runtime-builder.patch)
  preserves exact harness provenance, and the
  [visual-inspection record](engineering-skill-architecture-visual-inspection.md)
  records the browser-render review.

## Authoring status

The design decisions are recorded. Draft material lives under `drafts/`;
confirmed choices live in [authoring notes](../../authoring-notes.md). The root
contribution, shared agent configuration, and GitHub templates have completed
material review and make the work-in-progress repository usable for planning.
There is no `standards.yaml` yet and no source validation has passed.

The required product scope capability is delivered and accepted. Pull request
metadata validation, issue contract validation, Repository README checking,
GitHub label setup, PR integration setup, and their CI suites are implemented.
Use the installed public CLI 1.2.1 with Node.js 24 as the initial
source-validation baseline;
claim compatibility only after validating the final source bytes. The earlier
CLI 1.1.0 experiments remain historical evidence. Source validation, remaining
operation and skill exercises, and complete Repo Canon adoption are still
outstanding.

## Working locally

Clone the repository with Git. Markdown and YAML files can be edited directly;
the metadata validator has no external package dependencies. Validation and the
current external Repository Standards CLI require Node.js 24 and npm; GitHub
planning uses authenticated `gh` access.

## Current validation

Review Markdown file links, issue-form fields, and consistency with the confirmed
preferences. Run `git diff --check`, `npm run check`, and `npm test` before
requesting review. Use Node.js 24; the project has no package dependencies,
typecheck, or build step. Run a single fixture with
`node --test test/<name>.test.mjs` while developing.

The Node test suite exercises executable operation fixtures, including
disposable remote-label and PR-integration state with interruption recovery,
plus pull request creation and update event inputs. It covers valid and invalid
metadata, harmless formatting variations, a hostile fork payload, and
issue-contract events and state changes. The GitHub setup fixtures do not
contact GitHub or establish live remote setup. Run
`npm run test:issue-contracts` for the focused issue-contract fixtures. The four
draft issue forms were parsed as YAML and checked for basic field structure and
duplicate IDs during bootstrap; no GitHub submission behavior was exercised.
Source validation and adoption evidence remain separate from these checks.
