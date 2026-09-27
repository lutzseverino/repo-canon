# Agent guidance

Before changing this repository, read `CONTRIBUTING.md`.
Read `docs/agents/project.md`, when present, for repository-specific constraints.

For setup and validation commands, read `docs/development/README.md`.

## Available updates

At the start of work, when the pinned CLI is installed, you may run
`.repo-standards/runtime/node_modules/.bin/repo-standards outdated --json`. It
changes nothing except an ignored cache. Mention to the maintainer each pin it
reports as `update: available`, with the pinned and newest versions; `unknown`
means no answer.

Propose each available update as separate work: an exact update as its own
small pull request, and a contextual update as a ticket. The update's
inspection reports its class as `updateClass`; until an inspection has run,
propose a ticket. The `adopt-standards` skill performs the update. Continue the
current work as planned either way, and keep update changes out of its branch.

## Agent skills

### Issue tracker

Before working with issues, specifications, tickets, or pull requests, read
`docs/agents/issue-tracker.md`.

### Triage labels

Before triaging work or changing readiness, read `docs/agents/triage-labels.md`.

### Domain docs

Before exploring or changing code, domain terminology, or architecture, read
`docs/agents/domain.md`.
