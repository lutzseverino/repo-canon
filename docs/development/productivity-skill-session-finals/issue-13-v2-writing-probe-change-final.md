Added Northstar’s supplier fixture with compliant website `https://northstar.example` in [test/catalog.test.mjs](/tmp/repo-canon-productivity-runtime-issue-13-v2/writing-for-agents/test/catalog.test.mjs).

Validation passed: `npm test` on Node `v24.21.0` (2/2 tests), plus `git diff --check`.

Guidance path followed:

`AGENTS.md` → `CONTRIBUTING.md` → `docs/agents/project.md` → `docs/agents/domain.md` → `docs/development/README.md` → `CONTEXT.md` → `docs/agents/fixtures.md`

`docs/agents/sync.md` was not applicable because this was a supplier-fixture change, not synchronization behavior. I preserved the pre-existing unrelated edit to `docs/agents/project.md`.