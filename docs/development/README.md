# Development

This directory explains development decisions, validation, and maintenance of
the standards source. Keep end-user instructions under `docs/usage`, durable
decisions under `docs/adr`, and agent configuration under `docs/agents`.

- [Adoption compatibility](adoption-compatibility.md): current format support,
  the known scope gap, and preparation requirements.
- [Scope capability specification](scope-capability-specification.md): the
  proposed product outcome and acceptance criteria for a follow-up grilling.
- [Upstream compatibility](upstream-compatibility.md): the regular skill
  inventory and native issue formats that automation must respect.

## Authoring status

The design decisions are recorded. Draft material lives under `drafts/`;
confirmed choices live in `authoring-notes.md`. Root contribution and agent
configuration files make the work-in-progress repository usable for planning.
There is no `standards.yaml` yet and no source validation has passed.

The public authoring CLI version 1.1.0 has been acquired outside this directory
using Node.js 24. Source validation and behavioral exercises follow complete
material authoring and review; neither is established by this design audit.

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

There is no project typecheck, build, or automated test suite yet. These
requirements must be added with the executable implementation. Source validation
and adoption evidence remain separate from basic documentation checks.
