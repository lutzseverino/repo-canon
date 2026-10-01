# Discover documentation scope

Inspect every existing documentation root, documentation link, domain glossary,
context map, and project-specific agent guidance. Identify the individual files
needed to meet the documentation rules in the `CONTRIBUTING.md` this source
installs and its documentation guidance, `guidance/documentation.md`, preserving
useful material and repairing links affected by any move or deletion.

Propose every existing documentation file, glossary, and index, whether or not
it needs work, so that later documentation work stays inside the confirmed
scope. That is every file under each documentation root apart from the
exact-owned shared files below, every domain glossary and context map, and, as
a move source, every document outside a documentation root that belongs in a
category. Add each intended new path: a move destination, a missing directory
README, and `docs/agents/project.md` when repository-specific constraints
require it. Other files enter the scope only for link repairs, when a link in
them to documentation needs repair. For a missing file, provide absence
evidence plus positive evidence for its owning topic or Project.

Represent each applicable documentation root with its root `README.md` path and
the `README.md` path of at least one directly nested usage, development, adr, or
agents category when that root has content. This lets the read-only operation
distinguish a root at an arbitrary location from an ordinary nested directory
index. If the confirmed individual paths cannot make that distinction, leave
the root question unresolved rather than guessing that structural coverage is
complete. A documentation root never lies inside another: a category-named
directory deeper inside a root is an ordinary directory, and its `README.md` is
a directory index, not a root to confirm.

Do not propose directory trees or globs. Keep the exact-owned shared files
`docs/agents/README.md`, `docs/agents/domain.md`,
`docs/agents/issue-tracker.md`, and `docs/agents/triage-labels.md` outside this
scope. Keep all other declarations' paths disjoint. A move requires authority
for its source, destination, and affected link repairs.
