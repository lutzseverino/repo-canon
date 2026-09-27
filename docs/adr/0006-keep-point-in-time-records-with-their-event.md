# Keep point-in-time records with the event they record

Documentation holds maintained material only. A point-in-time record stays with
the pull request, release, or CI run it records: an adoption or update pull
request carries the tool's summary, a release carries its notes and any
machine-readable records as release assets, and bulk raw output remains a CI
artifact. Maintained documents cite those records by identity, such as a tag,
run ID, or commit permalink. Committing records to the tree made both adopting
repositories grow with every release, pushed Repo Canon's own evidence past the
product's 8 MiB observation limit, and kept dead machine-local links rendered as
guidance. Two alternatives were rejected: a documentation category for
evidence, because it still grows the tree and adds a fifth category every
adopter must understand; and leaving placement to each repository, because the
two adopting repositories had already diverged under that freedom.

## Consequences

- Records depend on GitHub for permanence. Release assets are permanent and bound
  to their tag; CI artifacts expire, so no conclusion may rest on an artifact
  alone.
- Records already committed are removed from the tree. Git history retains them,
  and a maintained document that still needs one cites a commit permalink.
  Files that tests pin remain as test fixtures.
- This is a breaking standards change for any adopting repository that commits
  such records.
