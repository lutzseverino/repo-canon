# Adopt published releases of this source

Repo Canon adopts its own standards through the public Repository Standards
CLI, pinned to a published Repo Canon release and the `complete` profile, never
by reading its working tree. This keeps the source repository on the exact path
every adopter takes, so its own adoption exercises the real acquisition,
discovery, fixes, and checks against the bytes adopters receive; a working-tree
route would prove nothing about a published version, and the product offers no
such route in any case. The cost is carrying installed copies of files the
source already owns, and being ahead of its own pin between a source change and
the next release.

## Consequences

- `.agents/skills/` and `.repo-standards/inputs/source/` duplicate `vendor/`
  and other source files. They match the pinned release, not `HEAD`, and the
  CLI guards them against edits.
- Between a change and the next release the source is ahead of its own pin.
  Conformance evidence describes the pinned release only.
- Self-adoption complements adoption by other repositories; it cannot surface
  what only a different repository reveals, as the
  [first real adoption](../development/real-adoption.md) did.
