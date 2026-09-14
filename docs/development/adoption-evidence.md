# Complete adoption evidence

Issue [#16](https://github.com/lutzseverino/repo-canon/issues/16) requires the
installed public Repository Standards CLI 1.2.1 under Node.js 24 to adopt the
same final `complete` profile in distinct real Git repositories. The evidence
must cover discovery, confirmed concrete scope, contextual work, operation
execution, assessment, completion, amendments, retained re-adoption, unsafe and
stale rejections, preservation, and actual authorized remote readback.

This document distinguishes the prepared local exercise from the final evidence.
The fixture preparation described below does not inspect or adopt a source,
contact GitHub, or establish remote configuration.

## Prepared repository matrix

Run the preparation command from a clean Repo Canon checkout with Node.js 24:

```sh
npm run prepare:adoption-fixtures -- /tmp/repo-canon-adoption-fixtures
```

The command refuses to overwrite an existing output path. It creates ordinary
Git worktrees with committed content, unambiguous GitHub-shaped remotes, and a
`plan.json` inventory that binds each fixture HEAD and expected evidence paths.
The generated `bin/gh` and per-repository JSON files under `remote-state` form a
local remote-state fixture for author-operation exercises. `plan.json` records
the required `PATH` directory and each repository's `FAKE_GH_STATE` path. Using
them is never remote evidence.

For a local CLI run, select the repository's values without modifying the state
file:

```sh
export PATH="$(jq -r .fixtureEnvironment.path /tmp/repo-canon-adoption-fixtures/plan.json):$PATH"
export FAKE_GH_STATE="$(jq -r '.repositories["prepared-monorepo"].remoteState' /tmp/repo-canon-adoption-fixtures/plan.json)"
```

The reviewed scope templates under `test/fixtures/adoption` contain every
candidate decision, reason, coverage explanation, and evidence path before any
remote exists. After the first public inspection, bind one template to that
inspection's observed identities without editing its rationale:

```sh
npm run build:scope-proposal -- \
  /tmp/evidence/initial-inspection.json \
  test/fixtures/adoption/prepared-monorepo-scope.json \
  /tmp/evidence/prepared-monorepo-scope.json
```

The builder refuses to replace an existing proposal and rejects any file or
directory evidence reference that the bound inspection did not observe.

| Repository | Evidence purpose |
| --- | --- |
| `prepared-monorepo` | Two commits prove that useful `AGENTS.md` instructions were first reconciled into `docs/agents/project.md` without replacing `AGENTS.md`. Unfamiliar Rust and Node project locations need new READMEs. Generated, fixture, and organizational candidates must remain excluded. A legacy operating guide needs a source, destination, directory index, and link repair around exact `docs/agents` descendants. |
| `amendment-success` | A contextual handoff identifies one additional Project README. Amendment inspection grants no authority; confirmed `resume --amend-scope` adds the file, replays fixes, and requires renewed assessment and checks. |
| `retroactive-write-rejected` | Writing the same additional README before amendment confirmation must remain a recorded out-of-scope violation that later scope cannot authorize. |
| `readoption` | After a complete adoption is committed, a project enters scope and the former Bridge Project leaves it. Fresh `inspect --readopt` and confirmed `start --readopt` must use unchanged pins, add the new README, and leave the retired Bridge README as project content. |
| `empty-and-unresolved` | Project README and remote-configuration declarations use explained empty path lists; a separate proposal with an unresolved question must be inspectable but ineligible to start. |
| `protection` | Scope proposals target `.git`, `.repo-standards`, exact `AGENTS.md`, and a symbolic link. Each case must be rejected without writes. A changed repository after first inspection separately proves stale request and evidence rejection. |

The successful Project README work will produce plain first headings and retain
the commands, ownership, and documentation links supported by each manifest.
The documentation migration will preserve the complete operating guide bytes at
its new destination, delete the separately authorized source, add the required
index, and repair `HANDBOOK.md`. Final comparisons will cover every tracked and
untracked output, all exact files and skill inventories, executable bits,
reserved product state, Git HEAD/index, excluded candidates, unrelated content,
and local links.

## Public-source and remote boundary

CLI 1.2.1 initial inspection accepts a public GitHub standards source at a stable
SemVer tag; it does not accept a local directory or untagged branch. Repo Canon
has no tag or release, and issue #16 authorizes neither one. A temporary public
source and an explicitly authorized disposable adoption remote are therefore
required before the prepared repositories can produce the requested evidence.

The proposed temporary names are
`lutzseverino/repo-canon-source-evidence-16` and
`lutzseverino/repo-canon-adopter-evidence-16`. The source remote would receive
one snapshot commit containing the exact reviewed PR head and temporary tag
`v0.0.1`; no release would be created. The adopter remote would receive one
fixture commit, the 12 canonical labels, a required `PR metadata` ruleset, and
the configured squash-only merge defaults. Full API readback would be retained
with the local adoption reports and content hashes. Both repositories, their
tags, branches, settings, and labels would be deleted after the reviewed
evidence is committed here.

Until that explicit authorization exists, source validation and the fixture
preparation remain local preparation only. They do not satisfy the adoption or
remote-readback acceptance criteria.
