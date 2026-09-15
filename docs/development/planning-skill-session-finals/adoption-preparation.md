Completed the two-commit adoption preparation:

1. `c0cc7080d30ca45010cafbf09defdc99e6ad6fd1` — `docs(agents): preserve project guidance before adoption`
   - Added [project guidance](/tmp/repo-canon-skill-exercises-11/adoption-preparation/docs/agents/project.md), preserving Parcel terminology, opaque-ID ADR requirements, local-only scope, contribution rules, and API verification.
   - No contradictions found.

2. `f44ed880d3dae67233b3734d7de0dadb01e7a9c9` — `docs(agents): adopt canonical agent guidance`
   - Replaced [AGENTS.md](/tmp/repo-canon-skill-exercises-11/adoption-preparation/AGENTS.md) byte-for-byte from `candidate/AGENTS.md`.
   - Recorded the prepared-HEAD inspection in [adoption-inspection.md](/tmp/repo-canon-skill-exercises-11/adoption-preparation/.scratch/adoption-inspection.md).

Evidence: `cmp -s AGENTS.md candidate/AGENTS.md` succeeded; all six candidate-referenced documents exist and are linked from the adopted instructions. `git diff --check` and `npm test` passed (0 tests, 0 failures). Working tree is clean.
