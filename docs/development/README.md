# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

- [Adoption compatibility](adoption-compatibility.md): supported v2 mapping,
  validation baseline, preparation requirements, and historical v1 limits.
- [GitHub label setup](github-label-setup.md): repeat-safe label provisioning,
  identity and permission prerequisites, protocol outcomes, and fixture coverage.
- [Pull request metadata validation](pr-metadata-validation.md): trusted check
  behavior, stable identity, permissions, and local verification.
- [Historical scope proposal](scope-capability-specification.md): the original
  product requirement, superseded by the delivered product contract.
- [Shared material review](shared-material-review.md): finalized contribution,
  agent workflow, template, and preparation evidence.
- [Upstream compatibility](upstream-compatibility.md): the regular skill
  inventory and native issue formats that automation must respect.
- [Repository README check](repository-readme-check.md): operation protocol,
  outcomes, prerequisites, and focused fixture command.

## Authoring status

The design decisions are recorded. Draft material lives under `drafts/`;
confirmed choices live in [authoring notes](../../authoring-notes.md). The root
contribution, shared agent configuration, and GitHub templates have completed
material review and make the work-in-progress repository usable for planning.
There is no `standards.yaml` yet and no source validation has passed.

The required product scope capability is delivered and accepted. Pull request
metadata validation, Repository README checking, GitHub label setup, and their
CI suites are implemented. Use the installed public CLI 1.2.1 with Node.js 24
as the initial source-validation baseline; claim compatibility only after
validating the final source bytes. The earlier CLI 1.1.0 experiments remain
historical evidence. Source validation, remaining operation and skill
exercises, and complete Repo Canon adoption are still outstanding.

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
disposable remote-label state and interruption recovery, plus pull request
creation and update event inputs, valid and invalid metadata, harmless
formatting variations, and a hostile fork payload. The label fixtures do not
contact GitHub or establish live remote setup. The four draft issue forms were
parsed as YAML and checked for basic field structure and duplicate IDs during
bootstrap; no GitHub submission behavior was exercised. Source validation and
adoption evidence remain separate from these checks.
