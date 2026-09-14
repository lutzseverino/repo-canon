# Repo Canon design review

The author preferences are settled in [authoring notes](authoring-notes.md). This document presents the complete current draft files for content review. It is not a validated standards source: the manifest, installed upstream skill directories, automation, and behavioral exercises are still pending.

The required product support is delivered and accepted. Use the [compatibility mapping](docs/development/adoption-compatibility.md) for the v2 interface and validation baseline; the [original scope proposal](docs/development/scope-capability-specification.md) remains historical context. The [upstream compatibility notes](docs/development/upstream-compatibility.md) identify the native workflows to preserve.

## Ownership and destination

AGENTS.md, CONTRIBUTING.md, issue/PR templates, and the shared agent configuration are intended as exact content. Files under drafts/guidance are source-side contextual instructions rather than installed project documents. Repository READMEs, development documentation, glossaries, and project-specific agent guidance remain project-owned. Resolve concrete scope for arbitrary Project READMEs and documentation migration through v2 discovery and confirm the complete inspection before adoption writes.

## Current draft contents

### drafts/.github/ISSUE_TEMPLATE/bug-report.yml

````yaml
name: Bug report
description: Describe a reproducible failure.
labels: [bug, needs-triage]
body:
  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: Give the smallest sequence or example that demonstrates the failure.
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What should happen?
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
      description: What happens instead? Include relevant error output.
    validations:
      required: true
  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: Include relevant versions, platform, or configuration when known.
  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Add supporting links or details that help reproduce the failure.
````

### drafts/.github/ISSUE_TEMPLATE/feature-request.yml

````yaml
name: Feature request
description: Explain a problem and the outcome you want.
labels: [enhancement, needs-triage]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: Describe the need or limitation, including a concrete example.
    validations:
      required: true
  - type: textarea
    id: outcome
    attributes:
      label: Desired outcome
      description: What should become possible, and how would it help?
    validations:
      required: true
  - type: textarea
    id: approach
    attributes:
      label: Proposed approach
      description: Suggest an approach if you have one. An implementation plan is optional.
  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Add relevant examples, alternatives, or links.
````

### drafts/.github/ISSUE_TEMPLATE/implementation-ticket.yml

````yaml
name: Implementation ticket
description: Define a bounded change with observable acceptance criteria.
labels: [needs-triage]
body:
  - type: input
    id: parent
    attributes:
      label: Parent
      description: Link the parent specification or planning issue, if applicable.
  - type: textarea
    id: scope
    attributes:
      label: What to build
      description: Describe the change and its boundaries using the project's terminology.
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      description: List observable outcomes that demonstrate completion.
    validations:
      required: true
  - type: textarea
    id: blockers
    attributes:
      label: Blocked by
      description: Link blocking issues, or explicitly write None. Keep native dependencies consistent.
    validations:
      required: true
````

### drafts/.github/ISSUE_TEMPLATE/specification.yml

````yaml
name: Specification
description: Define the intended behavior and boundaries of larger work.
labels: [needs-triage]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: Explain the problem and who experiences it.
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Solution
      description: Describe the intended behavior and approach.
    validations:
      required: true
  - type: textarea
    id: stories
    attributes:
      label: User Stories
      description: Describe the capabilities and outcomes the work must deliver.
    validations:
      required: true
  - type: textarea
    id: implementation
    attributes:
      label: Implementation Decisions
      description: Record agreed constraints and consequential decisions where applicable.
  - type: textarea
    id: testing
    attributes:
      label: Testing Decisions
      description: Record agreed verification boundaries or special evidence requirements.
  - type: textarea
    id: exclusions
    attributes:
      label: Out of Scope
      description: State important exclusions, or explicitly write None.
    validations:
      required: true
  - type: textarea
    id: notes
    attributes:
      label: Further Notes
      description: Add relevant references and remaining questions.
````

### drafts/.github/PULL_REQUEST_TEMPLATE.md

````markdown
## Summary

<!-- Explain the problem and resulting change. -->

## Validation

<!-- List the checks actually run and their outcomes. Explain any checks not run. -->

## Related issue

<!-- Link the issue, using Closes #123 when appropriate. For an eligible small correction, write Small correction: followed by its reason instead. -->

<!-- Add a Limits section only when relevant. For a breaking change, mark the title with ! and explain its impact and migration in the body. -->
````

### drafts/AGENTS.md

````markdown
# Agent guidance

Before changing this repository, read `CONTRIBUTING.md`.
Read `docs/agents/project.md`, when present, for repository-specific constraints.

For setup and validation commands, read `docs/development/README.md`.

## Agent skills

### Issue tracker

Before working with issues, specifications, tickets, or pull requests, read
`docs/agents/issue-tracker.md`.

### Triage labels

Before triaging work or changing readiness, read `docs/agents/triage-labels.md`.

### Domain docs

Before exploring or changing code, domain terminology, or architecture, read
`docs/agents/domain.md`.
````

### drafts/CONTRIBUTING.md

````markdown
# Contributing

## Before contributing

Use an issue for behavior changes and substantive work. Agree on the scope and
acceptance criteria before implementation. Small corrections, such as typos,
broken links, and formatting, may explain their purpose directly in a pull
request.

Use short, descriptive issue titles in sentence case and the project's
terminology. Name the observed failure for bugs, the desired capability for
features, the action for implementation tickets, and the capability being
specified for specifications. Avoid redundant type prefixes, issue numbers,
and trailing periods; aim for roughly 72 characters without a hard limit.

## Development setup

See the [development guide](docs/development/README.md) for prerequisites,
local setup, and development commands.

## Validation

Add or update tests for changed behavior where applicable. Run the required
checks documented in the development guide before requesting review.

## Titles and commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
for pull request titles and final commits on the default branch:

```text
fix(cli): reject incompatible standards versions
feat!: remove the legacy configuration format
```

Use lowercase types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`,
`ci`, `style`, `chore`, or `revert`. An optional scope names a stable component
or project. Write a concise action without a trailing period, preserving
proper names and identifiers. Use `style` for formatting changes.

Mark breaking changes with `!` and explain their impact and migration in the
message body. Prefer Conventional Commits during development; temporary
work-in-progress commits are allowed.

## Pull requests

Keep each pull request focused. Describe the problem and resulting change,
report the checks you ran and their outcomes, and link the relevant issue when
one is required. Include remaining limitations when relevant.

Address review feedback and ensure required checks pass before merging.
Squash-merge pull requests into the default branch, using the PR title as the
commit subject and its description as the body. Preserve issue references and
breaking-change explanations in the final message.
````

### drafts/docs/agents/README.md

````markdown
# Agent configuration

This directory configures the shared agent workflows.

- [Issue tracker](issue-tracker.md): GitHub operations, implementation
  contracts, and brief readiness.
- [Triage labels](triage-labels.md): workflow states, issue categories, and
  planning labels.
- [Domain documentation](domain.md): glossaries and architecture decisions.

When present, `project.md` records project-specific constraints that supplement
the shared guidance. Keep development commands in `docs/development/README.md`
and implementation procedures in the installed skills.
````

### drafts/docs/agents/domain.md

````markdown
# Domain documentation

Before exploring or changing code, terminology, or architecture, read the root
`CONTEXT.md`. If `CONTEXT-MAP.md` exists, use it to find the contexts relevant
to the work and read their glossaries.

Read applicable decisions under `docs/adr/` and any relevant context-local ADR
directories identified by the domain layout. Use the glossary's canonical
terms in issues, code, tests, and explanations. Surface contradictions with
existing decisions explicitly.

Missing glossaries or ADRs are normal. Domain modeling creates them when terms
or consequential decisions are resolved. A monorepo does not by itself imply
multiple domain contexts.

Documentation categories are `usage`, `development`, `adr`, and `agents` under
each applicable documentation root. Create a directory when it has content and
include a short README describing its purpose and linking useful contents.
Keep durable research with its usage or development topic. Glossaries remain
outside `docs`, at the repository or context root.
````

### drafts/docs/agents/issue-tracker.md

````markdown
# Issue tracker

Work is tracked in GitHub Issues. Infer the repository from the Git remote and
use authenticated `gh` operations. Resolve ambiguous remotes before making a
change. GitHub shares issue and PR numbers; identify the artifact before acting.

## Reading and writing

Read the complete issue body, comments, labels, relevant parent specification,
and blockers. When reviewing a PR, also read its description and diff.
For multiline issue, PR, and comment bodies, write the exact text to a file and
pass it with `--body-file`.

Use the repository's issue and PR templates for the corresponding artifact.
Follow the title and commit rules in `CONTRIBUTING.md`. Specifications and
implementation tickets live in GitHub; local documents retain durable domain
language, decisions, usage guidance, and development knowledge.

## Implementation contracts

For directly authored specifications and tickets, the issue body carries the
implementation contract. For triaged requests, the latest Agent Brief comment
is the candidate contract; the intake body and discussion remain context.
Read the whole conversation and clarify contradictions before implementation.

Keep the upstream Agent Brief structure: Category, Summary, Current behavior,
Desired behavior, Key interfaces, Acceptance criteria, and Out of scope. Include
the upstream AI-generation preamble for a triage-generated brief.

The latest brief becomes ready only after a maintainer or explicitly authorized
triaging agent reviews it and applies the applicable readiness state. Editing
or replacing it invalidates readiness and requires renewed review. A structural
check cannot authorize an agent or approve the meaning of a contract.

Incomplete or changed contracts lose readiness. Automation maintains one
actionable feedback comment and returns corrected work to review rather than
automatically declaring it ready. Use [triage labels](triage-labels.md) for the
shared states.

Direct specifications and implementation tickets produced after review by
`to-spec` or `to-tickets` keep their native issue-body contracts and readiness
labels. They do not require intake triage, an Agent Brief, or triage category
labels. A specified ticket can be ready while its implementation blockers
remain open; those blockers still prevent starting work.

## Dependencies and planning

Use GitHub's native parent/sub-issue relationships and blocking dependencies
when available. Native dependencies use the blocker's database ID; distinguish
it from the visible issue number. When these interfaces are unavailable, keep
explicit parent and blocker links in the issue body.

Before implementing a ticket, confirm its blockers are complete. A readiness
label alone does not start work or bypass dependencies.

For Wayfinder, retain its map and child-ticket formats. Link children to their
map, preserve the relevant planning labels, and follow the skill's frontier,
claiming, and resolution procedure. The four public intake/ticket templates do
not replace the formats of the installed planning workflow.

## Pull requests

**PRs as a request surface: no.** External PRs are reviewed as proposed changes;
they do not automatically enter issue triage as feature requests.

Keep PRs focused, report actual validation, and link their implementation issue
or explain an eligible small correction. Mark breaking changes with `!` in the
title and explain impact and migration in the body. Squash into the default
branch using the PR title and description, preserving those explanations and
issue references.
````

### drafts/docs/agents/triage-labels.md

````markdown
# Triage labels

Use the following shared workflow-state names.

| State | Meaning |
| --- | --- |
| `needs-triage` | Requires review or renewed review |
| `needs-info` | Waiting for information needed to evaluate the request |
| `ready-for-agent` | Reviewed and sufficiently specified for agent implementation |
| `ready-for-human` | Reviewed and requires human implementation |
| `wontfix` | Will not be actioned |

Triage assigns one category, `bug` or `enhancement`, and one workflow state to
a triaged request. Readiness describes the contract; it does not dispatch work
or imply that all implementation blockers have closed.

Wayfinder uses `wayfinder:map` for its planning issue and `wayfinder:research`,
`wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task` for child issues.
These planning labels do not themselves grant readiness.

Use the approval and invalidation rules in [the tracker configuration](issue-tracker.md)
when interpreting or changing readiness. Structural checks can remove readiness;
passing them never grants it.
````

### drafts/guidance/documentation.md

````markdown
# Documentation guidance

Use categories under each applicable documentation root:

- usage: using, configuring, and integrating the product.
- development: building, testing, architecture, and maintenance.
- adr: consequential decisions and their rationale.
- agents: agent workflow configuration.

Create categories only when they have content. Every documentation directory
has a short README stating its purpose and linking useful contents; the root
documentation README maps the categories and placement rules. Put durable
research findings with their usage or development topic. Keep domain glossaries
at the repository or context root and use CONTEXT-MAP.md when multiple domain
contexts are actually present.

The root docs/development/README.md is required because the shared
CONTRIBUTING.md links to it. It provides the project's real prerequisites,
setup, development commands, and required validation, or points to the relevant
development documents containing those details.

Preserve useful existing documentation when reorganizing it. Update affected
links and account for both old and new paths. Preserve the exact shared agent
configuration. Project-specific agent constraints belong in optional
docs/agents/project.md.

Assess documents against their actual audience and topic. Mechanical checks
cover categories, directory READMEs, required entry points, and local link
targets. They do not prove correctness or usefulness.

Use the v2 discovery route to propose individual files covering old locations,
new destinations, required directory READMEs, and affected links. Keep exact
shared configuration outside contextual scope. Review evidence and complete
coverage with the adopter in the full inspection before confirmation. Newly
discovered files require a confirmed scope amendment before editing; after a
complete adoption, use fresh discovery during deliberate re-adoption.
````

### drafts/guidance/project-readmes.md

````markdown
# Monorepo project README guidance

Each maintained app, service, library, or tool with its own responsibility and
development commands has a project README, including internal packages.
Fixtures, generated code, and organizational directories do not qualify.

Use a plain Markdown title and a concise developer-facing description. Explain
the project's purpose, development commands, important configuration, and
relevant documentation. State the working directory for commands when it is
not apparent; link shared setup and contribution instructions instead of
duplicating them.

Discover projects from repository evidence, including manifests, build
configuration, existing documentation, and meaningful component boundaries.
Directory names alone do not define project membership.

Use a v2 repository declaration with separate discovery guidance to identify
individual Project README paths. Include missing READMEs with absence evidence
and positive evidence of a maintained Project; explain excluded candidates and
unresolved membership. The adopter reviews coverage and concrete scope in the
complete inspection before confirmation. Newly discovered targets require
confirmed scope before editing; existing scope never implies coverage of an
unrepresented Project.
````

### drafts/guidance/repository-readme.md

````markdown
# Repository README guidance

Target: the adopting repository's top-level README.md. Keep its project facts
and write the document for someone discovering the repository.

Start with a centered title, a one-sentence description, and technology badges
for the major languages, frameworks, and runtimes actually used. Preserve
accurate useful badges; verify their labels and links against the project.

Use these recognized sections in relative order, omitting inapplicable sections:
Installation, Features, Usage, Configuration, Documentation, Contributing,
License. Installation is first when applicable. Place useful project-specific
sections between the recognized sections where they help the reader.

Give the shortest working installation path and one representative usage
example. Keep prose concise, aiming for roughly 300 words without a hard limit.
Move detailed explanations to the appropriate documentation category and link
them. Distinguish user installation from contributor setup.

The Contributing section links to CONTRIBUTING.md. When documentation is
present, the Documentation section links to docs/README.md. The License section
contains only a link using the repository's actual license name and LICENSE
file. Missing or ambiguous licensing requires maintainer clarification; do not
select a license or invent licensing facts.

Report evidence for the commands, technology choices, and links. Mechanical
structure checks do not establish that these facts or explanations are useful.
````
