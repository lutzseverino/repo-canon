# Complete adoption evidence

Issue [#16](https://github.com/lutzseverino/repo-canon/issues/16) requires the
installed public Repository Standards CLI 1.2.2 under Node.js 24 to adopt the
same final `complete` profile in distinct real Git repositories. The evidence
must cover discovery, confirmed concrete scope, contextual work, operation
execution, assessment, completion, amendments, retained re-adoption, unsafe and
stale rejections, preservation, and actual authorized remote readback.

This document distinguishes the prepared local exercise from the final evidence.
The fixture preparation described below does not inspect or adopt a source,
contact GitHub, or establish remote configuration.

Status: final public CLI validation and adoption are pending verified CLI 1.2.2
publication. Issue #16 remains open and no complete-adoption or remote-readback
acceptance is claimed.

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

The final CLI 1.2.2 run must inspect a public GitHub standards source at a stable
SemVer tag. Repo Canon has no tag or release, and issue #16 authorizes neither
one. A temporary public source and an explicitly authorized disposable adoption
remote are therefore required before the prepared repositories can produce the
requested evidence.

The approved temporary names were
`lutzseverino/repo-canon-source-evidence-16` and
`lutzseverino/repo-canon-adopter-evidence-16`. The source remote received
the reviewed source-integration commit
`662fdfa88db1833d76a6a4d403a6f567d22b08d9` and temporary tag `v0.0.1`; no
release was created. The issue #16 changes present at that attempt affected only
unreferenced evidence tooling, tests, and documentation, so every selected
manifest input in `v0.0.1` remained byte-identical to that whole-source-reviewed
commit. The adopter remote received one fixture commit and was intended to
receive the 12 canonical labels, a required `PR metadata` ruleset, and the
configured squash-only merge defaults during adoption. Acquisition failed
before those operations ran.

The same authorized repository names may be recreated for the final run. Because
the selected manifest now intentionally differs by pinning CLI 1.2.2, the
recreated source will use a newly reviewed snapshot tagged `v0.0.2`; it will not
recreate or move the previously observed `v0.0.1` tag.

Before that explicit authorization, source validation and fixture preparation
were local preparation only. The authorized attempt below still does not satisfy
the adoption or remote-readback acceptance criteria because acquisition failed.

## Observed public acquisition blocker

The owner authorized the temporary repositories on 2026-09-15. The source
remote received the whole-source-reviewed commit
`662fdfa88db1833d76a6a4d403a6f567d22b08d9` at `v0.0.1`, and the adopter remote
received the prepared monorepo's two commits. Repo Canon itself received no tag
or release.

Installed public package `@lutzseverino/repo-standards@1.2.1` under Node.js
24.21.0 then ran:

```sh
repo-standards inspect \
  --source https://github.com/lutzseverino/repo-canon-source-evidence-16 \
  --standards-version v0.0.1 --profile complete \
  --project /tmp/repo-canon-adoption-run/prepared-monorepo --json
```

It returned the retained
[SOURCE_UNAVAILABLE report](adoption-acquisition-failure.json) after GitHub
responded with HTTP 403 for a source blob. The public acquisition implementation
uses unauthenticated GitHub REST requests and exposes no supported authentication
option. It first requests repository metadata, the tag reference, the commit,
and the recursive tree, then requests every tree blob separately. The reviewed
source commit contains 188 files (`git ls-tree -r --name-only 662fdfa | wc -l`),
so one fresh acquisition needs about 192 core API requests. GitHub reported the
unauthenticated core limit as 60 requests per hour, with all 60 consumed. The CLI
does not retain a partial source snapshot, so waiting for a reset cannot let a
later invocation continue at blob 61.

No supported public route can acquire this complete source through CLI 1.2.1.
No preload, proxy, modified package, partial profile, or reduced skill snapshot
was substituted. Consequently no inspection identity, scope proposal, confirmed
start, operation execution, contextual assessment, complete adoption, or live
configuration readback was produced. The temporary adopter's only repository
setting changed before inspection was its default branch, from the empty-repo
placeholder `master` to its pushed fixture branch `main`; the authored adoption
operations did not run.

## Temporary repository cleanup

Cleanup was attempted with the authorized commands:

```sh
gh repo delete lutzseverino/repo-canon-source-evidence-16 --yes
gh repo delete lutzseverino/repo-canon-adopter-evidence-16 --yes
```

The first calls returned HTTP 403 because the active GitHub CLI credential lacked
the separately required `delete_repo` scope. After the authorized credential was
refreshed, the same two commands succeeded. No credential value is retained
here. An authenticated owner-repository listing returned no entries matching
either exact name, and authenticated requests to each former repository endpoint
returned HTTP 404. Together these checks distinguish completed deletion from a
transient unauthenticated lookup failure. Deleting the repositories removed the
temporary source tag, fixture branch, default-branch setting, and default remote
labels with them.
