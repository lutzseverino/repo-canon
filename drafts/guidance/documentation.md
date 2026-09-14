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

Use the v2 discovery route to propose individual files covering every migration
source and destination, required directory README introduction, and file whose
links need repair. Give the declaration coverage rationale and repository
evidence. Record relevant candidates with explicit include or exclude decisions
and reasons, and disclose unresolved coverage questions. Intended new files use
absence evidence plus positive evidence for their owning documentation topic or
Project.

Keep exact shared configuration, including its files under `docs/agents`,
outside contextual scope so exact and contextual ownership remain disjoint.
Review the evidence, candidate decisions, unresolved questions, complete
coverage, and concrete individual paths with the adopter in the full inspection
before confirmation. Newly discovered files require a confirmed scope amendment
before editing; after a complete adoption, use fresh discovery during deliberate
re-adoption.
