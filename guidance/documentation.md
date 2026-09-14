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
at the repository or context root and use `CONTEXT-MAP.md` only when multiple
domain contexts actually exist.

The root `docs/development/README.md` is required because the shared
`CONTRIBUTING.md` links to it. It provides the project's real prerequisites,
setup, development commands, and required validation, or points to the relevant
development documents containing those details.

Preserve useful existing documentation when reorganizing it. Update affected
links and account for both old and new paths. Preserve exact shared agent
configuration. Project-specific agent constraints belong in optional
`docs/agents/project.md`.

Assess documents against their actual audience and topic. Mechanical checks
cover categories, directory READMEs, required entry points, and local link
targets. They do not prove correctness or usefulness.
