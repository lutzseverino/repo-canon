# Agent guidance

- Before changing anything: [contribution guide](CONTRIBUTING.md).
- Before any work, including work that changes no file:
  [installed-rules lookup](.agents/skills/repository-standards/SKILL.md).
- Before planning: [planning rules](.repo-standards/rules/planning.md).
- For repository-specific constraints, when present:
  [project guidance](docs/agents/project.md).
- For setup and validation: [development guide](docs/development/README.md).

## Agent skills

Route a person's request by its requested outcome, uncertainty and authority to
its stage's hand skill in the installed `factory-workflow` rules' Canonical
stages, else by `CONTRIBUTING.md`'s Triage; answer status questions read-only;
propose `triage`, `grill-with-docs` or `orchestrate`, starting it only on their
yes; where user-level instructions name a workbench, read its running
orchestrator from `index.md` and offer to report through `incoming/`.

- Before handing work to another agent, subagent or session:
  [delegation and naming](.agents/skills/implement/DELEGATION.md).
- For issues, specifications and tickets: [issue tracker](docs/agents/issue-tracker.md).
- For triage labels: [label mapping](docs/agents/triage-labels.md).
- Before using domain docs: [domain guidance](docs/agents/domain.md).
