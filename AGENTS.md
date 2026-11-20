# Agent guidance

Before changing this repository, read `CONTRIBUTING.md`.
Read `docs/agents/project.md`, when present, for repository-specific constraints.

For setup and validation commands, read `docs/development/README.md`.

Deliver every change as one pull request: `implement`, then `review` in a
separate agent when configured, as `CONTRIBUTING.md` directs.

## Agent skills

Route a person's request by its requested outcome, uncertainty and authority to
its stage's hand skill in the installed `factory-workflow` rules' Canonical
stages, else by `CONTRIBUTING.md`'s Triage; answer status questions read-only;
propose `triage`, `grill-with-docs` or `orchestrate`, starting it only on their
yes; where user-level instructions name a workbench, read its running
orchestrator from `index.md` and offer to report through `incoming/`.

Hand work, including subwork and heavy reads, to another agent, subagent or
session by invoking any covering installed skill with task context: issue links,
evidence, recorded decisions, scope, workspace and plan references, report-back
destinations and delivery obligations, never procedure or question format.

Where supported, name sessions you launch or own for their operation and
target, outside invocations and task context; otherwise continue unnamed.

### Issue tracker

Issues, specifications, and tickets live in GitHub Issues, worked with the `gh`
CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical triage roles map to Repo Canon's `state:` labels. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context by default: a root `GLOSSARY.md` and `docs/adr/`; a root
`GLOSSARY-MAP.md` makes it multi-context. See `docs/agents/domain.md`.
