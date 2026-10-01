# Documentation guidance

Bring the documentation in line with the documentation rules in
`CONTRIBUTING.md`. The categories hold:

- usage: using, configuring, and integrating the product.
- development: building, testing, architecture, and maintenance.
- adr: consequential decisions and their rationale.
- agents: agent workflow configuration.

In the root documentation README, each category README's description states
what belongs in that category.

The root `docs/development/README.md` is required because `CONTRIBUTING.md`
links to it. Its Setup and validation section states the project's real
prerequisites, setup, development commands, and required validation, or links
the development documents that contain them.

For point-in-time records, an adoption or update pull request carries the
tool's summary, a release carries its notes and any machine-readable records as
release assets, and bulk raw output remains a CI artifact. CI artifacts expire,
so base each conclusion on a lasting record, such as a pull request summary or
a release asset. There is no evidence documentation category. Remove records
already committed to the documentation; Git history retains them, and a
maintained document that still needs one cites its commit permalink.

Preserve useful, current documentation when reorganizing it. Update affected
links and account for both old and new paths. Preserve exact shared agent
configuration. Project-specific agent constraints belong in optional
`docs/agents/project.md`.

Assess documents against their actual audience and topic. Mechanical checks
cover categories, directory READMEs, required entry points, and local link
targets. They do not prove correctness or usefulness, and they do not check
index format, that each document has one index, or where records are kept.
