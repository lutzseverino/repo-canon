# First real adoption

Repository Standards adopted Repo Canon's `complete` profile from the public
pin and merged the result. This record completes the delivery that
[Repo Canon #50](https://github.com/lutzseverino/repo-canon/issues/50) and
[Repository Standards #69](https://github.com/lutzseverino/repo-standards/issues/69)
track, following the [first release](first-release.md) and the
[v0.1.1 patch](release-v0-1-1.md). The confirmed policy is in the
[First release interview](../../authoring-notes.md#first-release-interview).

Status: complete and merged. The adopter pinned `v0.1.0` first, then re-adopted
`v0.1.1` after this adoption surfaced the workflow defect recorded below. The
`v0.1.1` run is the pin on the adopter's default branch. The earlier disposable
exercises in [the adoption evidence](adoption-evidence.md) remain a separate,
historical evidence class; they are not this adoption.
[The machine-readable record](real-adoption-record.json) binds the identities and
outcomes below.

## Adopter and merged result

The adopter is [lutzseverino/repo-standards](https://github.com/lutzseverino/repo-standards),
the agreed first adopter. Its reviewed adoption merged through
[pull request #71](https://github.com/lutzseverino/repo-standards/pull/71) as
squash commit `5f4d308696f4d37fe6ce8e33aeb4fdec474c3590` on `main` at
2026-09-16T14:36:07Z, over previous `main` `b18fef940aeefd142ab6410bf536d5005503a97b`
from the separately merged preparation change. The merged tree equals the
reviewed and CI-green head `9fd15a3a7a0c5e314d1b4b5172f9e0f17e77e51d`; both are
tree `182152013fa6c38c652555c33fdd2278d90a492d`.

Four commits were squashed into that merge:

| Commit | Subject |
| --- | --- |
| `3a0aeed761ed318caf92e1e4a23b4248b5f5fce9` | docs: make acceptance links migration-safe |
| `fe49e06ee01a1aa3b54eca2d5416d151e2413740` | chore: adopt the Repo Canon v0.1.0 complete standards profile |
| `07055c1c836af7a0960e8a89e084ba1dfc27913a` | test: check local links in every packaged document |
| `9fd15a3a7a0c5e314d1b4b5172f9e0f17e77e51d` | chore: update the standards pin to Repo Canon v0.1.1 |

Both runs used installed public Repository Standards CLI **1.2.2** and the
`complete` profile against `https://github.com/lutzseverino/repo-canon`.

## Adoption runs

### Final run from v0.1.1

The adopter updated its standards pin from `v0.1.0` to `v0.1.1` with the same
source and profile. `v0.1.1` resolves to commit
`0f313ef435c715889303ec1157f1006bee1fb9f4`.

- Confirmed inspection identity
  `sha256:dd4129e2e9e4f750b56e8e73e135c728726ac1cf9782ee8e66ee1072a6d39c3a`.
- Confirmed run `913f6556-330a-4139-96dd-96c2e8598d46`, selection identity
  `sha256:72208d014eb46b8958d855599c8d94a4f82d0cf3c0fa5ec79828c92fb0691277`.
- Scope proposal request identity
  `sha256:fa498ad4b976f67e185508da5f39863e0e863340f7bca23c5c2ef8f367f96367`.
- The after-fixes snapshot and the assessed snapshot are the same identity,
  `sha256:406ca05a2143c486d931cb0d910433b395cbfcbc23fc09637f45857ad8d7aa7f`,
  because the patch needed no contextual work.
- CLI-recorded adoption HEAD `07055c1c836af7a0960e8a89e084ba1dfc27913a`,
  `outcome: complete` at 2026-09-16T14:13:38.632Z.
- 48 exact declarations: 47 `match` and one `replace`,
  `.github/workflows/pr-metadata.yml`. No observed agent change, scope
  violation, or boundary change.
- Operation results: `canonical-labels` `unchanged`,
  `pull-request-integration` `unchanged`, `documentation-navigation` `passed`,
  `project-readme-structure` `passed`, `repository-readme-structure` `passed`.
- The confirmed documentation scope covers 38 paths: the `v0.1.0` scope without
  the sixteen flat `docs/*.md` sources that the migration removed. The GitHub
  configuration and Project README scopes are intentionally empty and explained.

### Historical first run from v0.1.0

The superseded first run adopted `v0.1.0`, commit
`639af070ddeef2d82c96b8427a805da0e1bf8ba9`.

- Confirmed inspection identity
  `sha256:4ef78c2b40da290f419ba9174284d519c7113ce0ef6b6d3408cbc02e609f957c`.
- Confirmed run `0b76fcf9-2bd9-42f6-a312-94b54e181504`, selection identity
  `sha256:b3e36979bcc5f90448942ace875a93e8acdee5c4b543a1fd6da3db115555f28e`.
- After-fixes snapshot
  `sha256:d1498add4b9fcaaebd37ab19efa4e3caf963f747dab80d1ca69219eade19d1c5`;
  assessed snapshot
  `sha256:7327e653d5a495c1aa7036f16db65ab3aed7bd5db281e99e155aec981a421dc5`,
  because the documentation migration changed the tree between the two points.
- `outcome: complete` at 2026-09-16T11:43:18.534Z with 49 observed changed paths,
  a 54-path documentation scope, and no scope violation.
- The same operation results: both GitHub fixes `unchanged`, because the earlier
  abandoned run had already reconciled the live labels and pull request
  integration, and all three checks `passed`.

This run is retained evidence that the published `v0.1.0` pin completed a real
adoption. The `v0.1.1` run supersedes it as the adopter's current pin.

### Historical abandoned run

An earlier run, `f3172c5f-80c8-43b7-a6d2-e3edce0ccdbb`, was abandoned in a prior
session and remains in the adopter's retained run history. Its
`documentation-navigation` check was blocked because that run's confirmed scope
carried an index from the executable acceptance harness without making that
directory resolvable as a documentation root:

```text
ABANDONED: OPERATION_BLOCKED: Operation documentation/documentation-navigation
is blocked: Documentation root selection is ambiguous: Cannot determine whether
acceptance is a documentation root from the confirmed paths; include its root
README and at least one confirmed category README under usage, development, adr,
or agents, or remove the unrelated index from this declaration.
```

The later confirmed scope excluded that unrelated index, and the check passed.
No Repo Canon source byte changed because of it, and it is recorded here as
historical evidence of a scope correction rather than a source defect.

## Defects and observations surfaced by this adoption

This was the first adoption of the published source by a repository other than
Repo Canon, and it surfaced material that Repo Canon's own checks could not.

- **The `v0.1.0` `pr-metadata.yml` caching defect.** The installed workflow
  pinned `actions/setup-node` v5 with package-manager caching left at its
  default, so the `Use Node.js 24` step read the adopter's
  `"packageManager": "pnpm@11.20.0"` and failed with
  `Unable to locate executable file: pnpm`; the validator step never ran.
  [#55](https://github.com/lutzseverino/repo-canon/issues/55) and
  [PR #53](https://github.com/lutzseverino/repo-canon/pull/53) fixed it, and
  [v0.1.1](release-v0-1-1.md) published the fix. Repo Canon's own repository uses
  npm and was unaffected, which is why only a real adopter could find it.
- **The bootstrapping consequence of that defect.** The `PR metadata` check runs
  under `pull_request_target`, so GitHub loads the workflow definition from the
  adopter's base branch. An adopter whose base branch carries the defective
  workflow therefore cannot land the fix through a normally gated pull request:
  the check executes the exact bytes being replaced and cannot pass. This
  adoption needed the one-time authorized bypass below. Adopters starting from
  `v0.1.1` do not meet this condition.
- **[#54](https://github.com/lutzseverino/repo-canon/issues/54) remains open.**
  Approved specifications and implementation tickets keep `needs-triage` because
  `validate()` returns `triaged: false` for those direct outcomes, so
  `replaceTriagedState` is never called. The defect is present in the adopted
  `v0.1.1` bytes and is not fixed by this record.
- **Adoption commits multi-megabyte durable run state.** The completed adoption
  writes `.repo-standards/state.json` and
  `.repo-standards/inputs/scope-history.json` into the adopting repository, and
  those two files dominate the merge diff. This is the product's retained-state
  behavior rather than a Repo Canon declaration, and it is recorded here as an
  observed consequence for future adopters.

## Integration, checks, and the authorized bypass

The adopter's own `Validate` workflow passed on the reviewed heads. All four
`pnpm validate` jobs were green on `07055c1` (runs `35092790141` and
`35092783704`) and on the final head `9fd15a3` (runs `35107162388` and
`35107158781`, jobs `104831265121`, `104831265599`, `104831250514`, and
`104831250127`). The post-merge run on `main` at `5f4d308`, run `35109649363`,
succeeded on both `ubuntu-latest` (job `104839713574`) and `macos-latest`
(job `104839713743`).

The required `PR metadata` check **failed on every head of the pull request and
was not satisfied**. Runs `35107160368`, `35109540653`, and `35109576546` all
failed identically at `Use Node.js 24`, with `Validate title and description`
skipped, for the base-branch reason described above. The check's contract was
verified separately instead: running the exact installed validator against pull
request #71's final title and body printed `PR metadata validation passed.` and
exited `0`. That is a local verification of the metadata, not a passing required
check.

The maintainer authorized a one-time ruleset bypass for this merge only. The
sequence and its readbacks were:

1. Before: ruleset `23476826` "Repo Canon required PR checks",
   `target: branch`, `enforcement: active`, condition `~DEFAULT_BRANCH`, one
   `required_status_checks` rule requiring context `PR metadata`,
   `bypass_actors: []`, `current_user_can_bypass: "never"`.
2. Exactly one bypass actor was added,
   `{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}`,
   the repository admin role. Enforcement stayed `active`; the required check
   was neither disabled nor removed.
3. The pull request was squash-merged with an administrative merge, producing
   `5f4d308`.
4. The bypass actor was removed immediately. A field-by-field comparison with
   the pre-bypass readback shows no difference apart from `updated_at` and
   `_links`: `bypass_actors: []`, `current_user_can_bypass: "never"`,
   `enforcement: active`, and the required `PR metadata` context intact.

Merged `main` now carries the corrected workflow, so the next pull request's
`PR metadata` run uses the fixed bytes. This merge is recorded as an authorized
bypass, not as a passing required check.

## Packaged-output validation

Validation ran from detached merged `main` at `5f4d308`. The product's release
packaging produced `lutzseverino-repo-standards-1.2.2.tgz` with SHA-256
`30999c1f12d117cce4cd6cf9826d83dbf5304349f161de2519b592fde99ddbdf` and integrity

```text
sha512-QV9SascgH8Ori5BUPVnCPF7Jz1NrAqWcWUGONeRCHg0boFsMkSgIvUQc0WTUH7IE25kOQYsQK7K4tRK1DMg1ww==
```

alongside `repo-standards-bootstrap` with SHA-256
`8f593d792119f9e9a623b20c1e2d680f7a0e641c54819367c7ebe2fca575c46a`. Installing
that tarball into a temporary prefix confirmed:

- `repo-standards --version` reports `1.2.2` with the correct usage banner, and
  `repo-standards-bootstrap --help` is correct.
- The product system skills `skills/adopt-standards` and `skills/author-standards`
  are packaged, including the `cli.md`, `operations.md`, `profiles.md`, and
  `revision.md` references.
- The package contains 38 categorized Markdown documents under `docs/` out of 57
  Markdown files, with **zero broken local links** across all 38.
- All **nine previously published documentation paths** are present, non-empty,
  and have headings identical to their canonical categorized copies:
  `docs/installation.md` (7,403 B), `docs/release.md` (16,037 B),
  `docs/inspection.md` (27,340 B), `docs/adoption.md` (25,661 B),
  `docs/assessment-protocol.md` (12,563 B), `docs/authoring.md` (10,017 B),
  `docs/author-format.md` (16,479 B), `docs/discovery.md` (3,953 B), and
  `docs/script-protocol.md` (12,822 B).
- The installed CLI returned `valid: true` for both packaged example sources,
  `examples/alice` and `examples/mira`.
- A repository-wide sweep of 312 Markdown files found no link broken by the
  migration. Nine broken links remain in the
  `acceptance/results/2026-09-12` and `acceptance/results/2026-09-14`
  transcripts; they point into the synthetic projects those runs describe and
  predate this work.

No new Repository Standards package was published and no product version was
bumped; the adopter stays at `1.2.2`.

## Remote readback after merge

Authenticated readback of the adopter after the merge confirmed:

- `refs/heads/main` is `5f4d308696f4d37fe6ce8e33aeb4fdec474c3590`, and
  `.repo-standards/selection.yaml` on `main` pins CLI `1.2.2`, repository
  `https://github.com/lutzseverino/repo-canon`, version `v0.1.1`, commit
  `0f313ef435c715889303ec1157f1006bee1fb9f4`, and profile `complete`.
- `status` from merged `main` reports `active: null`, `lastComplete.inspection`
  `sha256:dd4129e2…`, all three checks `passed`, and the one abandoned run
  retained.
- Merge settings are squash-only: `allow_squash_merge: true`,
  `allow_merge_commit: false`, `allow_rebase_merge: false`,
  `squash_merge_commit_title: PR_TITLE`, `squash_merge_commit_message: PR_BODY`,
  `delete_branch_on_merge: false`, `default_branch: main`.
- Ruleset `23476826` is active for `~DEFAULT_BRANCH`, requires `PR metadata`,
  and has `bypass_actors: []` with `current_user_can_bypass: never`.
- The label inventory has 19 labels including all twelve canonical labels, with
  the adopter's unrelated labels preserved.
- `main` carries the expected workflows `issue-contracts.yml`,
  `pr-metadata.yml`, `release.yml`, and `validate.yml`, and its
  `.github/workflows/pr-metadata.yml` hashes to
  `597e2f3433f75fa25a2a24c9db6be3432c91740a2638ecb3541e549c518e6c82`, the
  corrected `v0.1.1` bytes.

Both Repo Canon tags are untouched by this work: `v0.1.0` is still tag object
`5922e2d826c284101e92a88d1635ff60b652ad39` peeling to `639af07`, and `v0.1.1`
is still `164a354adc371f7a4bb0cf4a703d2476bb831d34` peeling to `0f313ef`.

## Review and evidence boundary

Codex review was unavailable for the later phases of this delivery. It reviewed
the adoption commit `fe49e06`, where its one P2 finding on
`scripts/validate-issue-contract.mjs` was rejected downstream with a written
reason and an inline reply, and it rereviewed `07055c1` with zero findings.
It could not run on the `v0.1.1` head and was not a merge gate. Independent
Sonnet 5 high-reasoning Standards and Spec reviews were the review gates for
this work.

Those reviews covered `origin/main...07055c1` and then `07055c1..9fd15a3`. The
Standards review found no hard standard violation, no moved document that lost
content, and no dangling local link; the Spec review found no scope creep, no
version bump, and no publication, and corroborated the pull request's claims
against the retained run JSON. Their corrections landed in `07055c1`: the
packaged link check now covers all 38 packaged documents rather than only the
nine legacy pairs, four `acceptance/results/...` links that never needed to move
were restored to relative form, and two historical acceptance artifacts were
rebased off the pre-migration documentation paths. The targeted follow-up
reviews of the `v0.1.1` pin update confirmed that the workflow change is exactly
the documented fix, that installed and retained copies are byte-identical, and
that the guidance is byte-identical between `v0.1.0` and `v0.1.1`; their two
notes were accepted as accurate rather than changed.

This record covers the adopter's completion, integration, packaged output, and
remote state. It does not renew Repo Canon's source validation or the disposable
adopter evidence, and it publishes nothing. The complete run JSON, ruleset
readbacks, and packaged-validation output were retained outside both
repositories for the duration of the delivery; those session paths are not
permanent, and the durable subset is
[the machine-readable record](real-adoption-record.json).
