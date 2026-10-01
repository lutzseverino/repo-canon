# Install skill setup files verbatim from upstream seeds

The issue tracker, triage label, and domain configurations under `docs/agents`
are skill setup files: the installed skills read them as their per-repository
configuration and look up named sections in them. Repo Canon declares each one
as an exact file whose source is the vendored upstream setup seed for GitHub,
installed byte for byte, and writes nothing into them; its own rules live in the
[contribution guide](../../CONTRIBUTING.md). Repo Canon had seeded these files
from upstream and then rewritten them to carry its contract, readiness, pull
request, and documentation rules, as the
[`v0.4.0` specification](https://github.com/lutzseverino/repo-canon/issues/122)
records. The rewrite dropped the issue tracker's "Wayfinding operations"
section, which the wayfinder skill reads, and spread each rule across several
files. Two alternatives were rejected: keeping Repo Canon-authored files that
restore the sections the skills read, because every upstream snapshot would
need a manual comparison to find sections the skills newly expect; and
customizing the seeds for Repo Canon, because any edit makes the files diverge
from the snapshot the skills were written against.

## Consequences

- The skill setup files change only with a reviewed upstream snapshot, as
  [ADR 0001](0001-manage-shared-skills-through-standards-releases.md) decides
  for the skills themselves. Source validation proves that each declaration
  names an existing seed.
- Seed text addressed to whoever runs the setup skill, such as the triage label
  table's invitation to edit its right-hand column, ships unchanged. The
  defaults stay as upstream sets them: GitHub as the tracker, external pull
  requests not a request surface, the default triage label strings, and a
  single-context domain layout unless a root `CONTEXT-MAP.md` exists.
- The agent instructions point to each file in the setup skill's format: a
  one-line summary and a pointer per file.
- The files are third-party material under the skill collection's license
  notice, which adoption already installs beside the copied skills.
