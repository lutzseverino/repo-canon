# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

- [Adoption compatibility](adoption-compatibility.md): supported v2 mapping,
  validation baseline, preparation requirements, and historical v1 limits.
- [Historical scope proposal](scope-capability-specification.md): the original
  product requirement, superseded by the delivered product contract.
- [Shared material review](shared-material-review.md): finalized contribution,
  agent workflow, template, and preparation evidence.
- [Upstream compatibility](upstream-compatibility.md): the regular skill
  inventory and native issue formats that automation must respect.
- [Repository README check](repository-readme-check.md): operation protocol,
  outcomes, prerequisites, and focused fixture command.
- [Documentation and Project README checks](documentation-check.md): concrete
  scope, structural outcomes, prerequisites, and focused fixture commands.

## Authoring status

The design decisions are recorded. Draft material lives under `drafts/`;
confirmed choices live in [authoring notes](../../authoring-notes.md). The root
contribution, shared agent configuration, and GitHub templates have completed
material review and make the work-in-progress repository usable for planning.
There is no `standards.yaml` yet and no source validation has passed.

The required product scope capability is delivered and accepted. Use the
installed public CLI 1.2.1 with Node.js 24 as the initial validation baseline;
claim compatibility only after validating the final source bytes. The earlier
CLI 1.1.0 experiments remain historical evidence. Source validation, operation
and skill exercises, and complete Repo Canon adoption are still outstanding.

## Working locally

Clone the repository with Git. Markdown and YAML files can be edited directly;
there are no repository package dependencies to install yet. Authoring with the
current external Repository Standards CLI requires Node.js 24 and npm; GitHub
planning uses authenticated `gh` access.

## Current validation

Review Markdown file links, issue-form fields, and consistency with the confirmed
preferences. Run `git diff --check` before requesting review. The four draft
issue forms were parsed as YAML and checked for basic field structure and
duplicate IDs during bootstrap; no GitHub submission behavior was exercised.

Run `npm test` with Node.js 24 for the executable operation fixtures. The project
has no package dependencies, typecheck, or build step. Run a single fixture with
`node --test test/<name>.test.mjs` while developing. Source validation and
adoption evidence remain separate from these operation checks.
