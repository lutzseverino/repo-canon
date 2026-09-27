# Agent guidance

Before changing this repository, read `CONTRIBUTING.md`.
Read `docs/agents/project.md`, when present, for repository-specific constraints.

For setup and validation commands, read `docs/development/README.md`.

## Available updates

At the start of work, when the pinned CLI is installed, you may run
`.repo-standards/runtime/node_modules/.bin/repo-standards outdated --json`. It
changes nothing except an ignored cache. Mention to the maintainer each pin it
reports as `update: available`, with the pinned and newest versions.

Propose each available update as separate work. When the maintainer takes one
up, run it with the `adopt-standards` skill on its own branch; its complete
inspection, including any scope proposal, reports the class as `updateClass`.
Deliver an `exact` update as its own small pull request, and propose a
`contextual` update as a ticket. Continue the current work as planned either
way, and keep update changes out of its branch.

## Agent skills

### Issue tracker

Before working with issues, specifications, tickets, or pull requests, read
`docs/agents/issue-tracker.md`.

### Triage labels

Before triaging work or changing readiness, read `docs/agents/triage-labels.md`.

### Domain docs

Before exploring or changing code, domain terminology, or architecture, read
`docs/agents/domain.md`.
