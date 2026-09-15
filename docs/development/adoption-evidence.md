# Complete adoption evidence

Issue [#16](https://github.com/lutzseverino/repo-canon/issues/16) established the
complete Repository Standards CLI 1.2.2 adoption matrix. Issue
[#38](https://github.com/lutzseverino/repo-canon/issues/38) refreshed affected
evidence for `v0.0.3`. Issue
[#46](https://github.com/lutzseverino/repo-canon/issues/46) now binds final
architecture-refactor bytes to public acquisition, full adoption, unchanged
same-pin repetition, protected integration, both trusted workflows, and
authorized remote readback under temporary `v0.0.4`. Unaffected scope and
lifecycle results remain clearly labeled historical evidence.

This document distinguishes the prepared local exercise from the final evidence.
The fixture preparation described below does not inspect or adopt a source,
contact GitHub, or establish remote configuration.

Status: installed public CLI 1.2.2 validated exact source commit `e63f0d` and
completed public-target adoption from temporary `v0.0.4`. A separate final-state
adopter incarnation completed two same-pin re-adoptions. The second returned
both fixes unchanged and all three checks passed. Protected final `main` rejected
direct push, integrated durable state through passing required-check pull
requests, and passed fresh PR metadata and issue-contract workflow probes at the
same final SHA. Authenticated readback confirmed 98 exact baselines, 26 skill
directories, all affected runtime blobs, all 12 canonical labels, the unrelated
adopter label, the active ruleset, squash settings, and remote content. The
local Git matrix completed under historical `v0.0.2`; its unchanged cases were
not rerun. The retained [machine-readable record](adoption-acceptance.json)
binds the identities and outcomes. Repo Canon itself remains untagged and
unreleased.

## Prepared repository matrix

Run the preparation command from a clean Repo Canon checkout with Node.js 24:

```sh
npm run prepare:adoption-fixtures -- /tmp/repo-canon-adoption-fixtures
```

The command refuses to overwrite an existing output path. It creates ordinary
Git worktrees with committed content, unambiguous GitHub-shaped remotes, and a
`plan.json` inventory that binds each fixture HEAD and expected evidence paths.
The inventory retains the source `HEAD` and records SHA-256 for the builder,
shared fixture-authoring module, and copied fake-`gh` implementation, so their
exact bytes remain identifiable when the source worktree is dirty. Each
generated repository sets `commit.gpgsign=false` locally. The fixture test
creates a later ordinary commit under hostile global signing with an unusable
signer and verifies that the global configuration is unchanged. The generated
`bin/gh` and per-repository JSON files under `remote-state` form a local
remote-state fixture for author-operation exercises. `plan.json` records the
required `PATH` directory
and each repository's `FAKE_GH_STATE` path. Using them is never remote evidence.

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

The refreshed preparation command and signing fixture passed again at
`eb98da8`. The successful Project README work produced plain first headings and
retained the commands, ownership, and documentation links supported by each
manifest. The documentation migration preserved the complete operating guide
bytes at its new destination, deleted the separately authorized source, added
the required index, and repaired `HANDBOOK.md`. Final comparisons covered every
tracked and untracked output, all exact files and skill inventories, executable
bits, reserved product state, Git HEAD/index, excluded candidates, unrelated
content, and local links. The amendment, re-adoption, empty/unresolved,
retroactive, reserved, exact, symlink, and stale cases below remain the
previously accepted matrix; this refresh does not claim to have rerun them.

## Public-source and remote boundary

The final CLI 1.2.2 run inspected a public GitHub standards source at a stable
SemVer tag. Repo Canon has no tag or release, and issue #16 authorized neither
one. The owner instead authorized one temporary public source and one disposable
public adoption remote, followed by their deletion after evidence retention.

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

The same authorized names were recreated for the final run. Because the selected
manifest intentionally differs by pinning CLI 1.2.2, the recreated source used
the newly reviewed snapshot `c0d57fadaee738b65d0ff12ecd9f8ec5df86c7ef`
tagged `v0.0.2`. It did not recreate or move the previously observed `v0.0.1`
tag.

Issue #38 reused the same authorized names only after both repositories had
been verified deleted. The source remote received exact reviewed commit
`eb98da8af94e25cc66a7bd0bf5424604d5e3b7ec` at the new immutable temporary tag
`v0.0.3`. Public Git, authenticated tag, commit, and tree readback all resolved
that tag directly to the reviewed object. Evidence-only commit `226b448` and
later records were intentionally excluded, so the published source bytes did
not drift after review. The adopter received the freshly prepared two-commit
repository before any CLI write.

Issue #46 reused those names after authenticated and public checks confirmed
their absence. The source remote received exact reviewed commit
`e63f0d1438eb89c3df51a827ec169a8f5c489ded` at direct temporary tag `v0.0.4`.
Its complete tree and all 115 closure modes and blobs matched the independent
prepublication review record. The source stayed immutable while the adopter was
created in two explicitly separate incarnations under the reviewed no-bypass
sequence described below. Evidence commits in Repo Canon were not added to that
temporary tag.

Before explicit authorization, source validation and fixture preparation were
local preparation only. The historical attempt below also did not satisfy
adoption or remote-readback acceptance because acquisition failed.

## Final public CLI and source identity

Node.js 24.21.0 installed the public npm package
`@lutzseverino/repo-standards@1.2.2` from `registry.npmjs.org` with integrity:

```text
sha512-K5YejetLhzigwCrbCgwz7i/Jm7FkyZbkBu9A25+hNq3IbU2UASu2cC6Uh6bh8CCO/wl6YeDU3pO/F5ZPX4e3gw==
```

No source checkout, preload, proxy, or altered transport replaced that package.
The retained installation manifest and lock both pin `1.2.2` exactly. Applying
the documented `npm install --save-exact` retention form after the evidence run
left the already installed package version, tarball URL, and integrity unchanged.
The final CLI returned `valid: true` with no errors for exact reviewed source
commit `e63f0d1438eb89c3df51a827ec169a8f5c489ded`. It resolved one `complete`
profile with 52 declarations and exact compatibility 1.2.2. The first public
inspection independently reacquired temporary `v0.0.4`, validated it, and
reported that same commit in the selection.

Independent GPT 5.6 Terra high Standards and Spec reviews verified the complete
115-file final closure, installation and retained-resource graph, policy
preservation, and pinned upstream skill and notice bytes before publication.
Both approved exact `e63f0d` with no material findings. A separate pre-execution
review rejected a proposed default-branch transition that would have moved
`~DEFAULT_BRANCH` protection away from `main`; its targeted rereview approved
the two-incarnation sequence actually executed below.

An independent exact-head GPT 5.6 Terra high review first found the historical
closure-count error. After correction it approved `eb98da8` for immutable
temporary tag `v0.0.3` with no remaining material findings. Relative to accepted
`c0d57fa`, the only changed selected path is
`.github/scripts/validate-pr-metadata.mjs`, whose SHA-256 changed from
`1a749746127e09908cd2ea7c6f07bd5b5167b405d955ad47cf8ce16ce59259f2`
to `6896831ef69cf8594437abfd0566e395171b04653a8b67a0012309d155d2c38a`.
The other 113 paths are byte-and-mode identical. Later evidence commits do not
change the reviewed snapshot or tag.

The 114-file count corrects an earlier evidence-accounting error: the previous
115 count included contextual adopter target `README.md`, which is governed by
guidance but is not a standards source input. The retained
[closure comparison](source-closure.json) counts `standards.yaml`, enumerates
all referenced and recursively selected files, and confirms that no source
material was removed by the correction.

## Final v0.0.4 public adoption and protected-main readback

The first adopter incarnation started at freshly prepared commit
`b5de0bd7e8ce789aa00241a45e8dfdbba127c891`. Public acquisition resolved
temporary `v0.0.4` to exact `e63f0d`, and the evidence-bound full-scope
inspection was
`sha256:36d21af879c56c26aca9007a589cddb3f1ef388492242642b601ad9fe00e677e`.
Confirmed run `3bb79b71-5952-4d2b-8f32-1a11d47008d9` installed the complete
selection, configured live labels and pull request integration, completed the
contextual documentation and both arbitrary-layout Project READMEs, and passed
all three checks. Its five operation outcomes were retained individually. All
98 exact baselines, 26 installed skill directories, unrelated content,
executable modes, and migration bytes passed preservation comparison. The
accepted adopted commit was
`a491c4e42e24b200e8b400994e5f200003daed74` with tree
`1dc68606260320eb51e55fba7aa65683eaf6f106`.

That first adopter was deleted after its evidence was retained. The same
authorized name was recreated as a separate repository with the accepted
adopted commit directly on default `main`, so the branch already contained both
trusted workflows, their validators and runtime dependencies, and durable
adoption state. No continuity between the two adopter repositories is claimed.
The first same-pin re-adoption completed after one supported `resume --retry`:
GitHub's immediate squash-setting readback initially lagged the successful
mutation, and retry observed both fixes unchanged. Its durable state entered
protected `main` through pull request #1 after `PR metadata` passed; the merge
tree matched the state branch tree.

A second same-pin re-adoption used inspection
`sha256:67108f92a512f3f9162c83939270c40fb3bd29886688a87f5f71ecae1beb175b`
and run `148b7352-d121-49a7-b38b-155a48ec5e65`. Both live fixes returned
`unchanged`, all three checks passed, and renewed preservation passed. The active
ruleset rejected a direct push to `main`. Pull request #2 then passed the
required check and squash-merged the durable state without bypass; its source
and merged trees were identical.

Final default `main` was
`b15ef9910421344631cb7ed96842e307a089810d`, tree
`4599034106eb458a5415e347e13a0f1c630a1f6e`. A fresh unmerged pull request
probe passed `PR metadata` against that exact base. A real issue-event probe
then ran the installed issue-contract workflow from the same SHA and passed
after the fixture issue received its required `bug` and `needs-triage` labels;
the preceding incomplete-label failure remains in the record. Authenticated
readback confirmed default `main`, an active `~DEFAULT_BRANCH` rule requiring
`PR metadata`, squash-only title/body integration, all 12 canonical labels plus
`adopter-owned`, the complete nontruncated tree, and every affected validator,
operation, renderer, and local-link resource blob. A fresh public clone returned
the same status and preservation results.

## Historical v0.0.3 public adoption and live readback

The refreshed public adopter started at prepared commit
`0e22a9ce16d310594cf6f6506e867ba854110837`. Its parent creates the fixture;
that commit adds only `docs/agents/project.md`, preserving both useful statements
from the original `AGENTS.md`. The builder record binds exact source-input hashes
and locally disables inherited commit signing. The fresh initial inspection
bound that prepared HEAD and produced discovery request
`sha256:0fda7af65eff4b3fc8103fa7433e8c1fb21d6ac4d6bd2866ef916534048b6bdb`.
The evidence-backed proposal covered every Project, false positive,
documentation source, destination, index, and link repair. `inspect --scope`
returned confirmable identity
`sha256:a63cf0156466e6dff86d3b9ea5066ac332a68f10577f0389f5d6a16c1d9ae4c8`;
confirmed `start --scope` used that same proposal and identity.

Start installed the entire selection and ran both authorized GitHub fixes before
the contextual handoff. Label setup created nine missing labels, corrected
`wontfix`, read back all 12 canonical labels, and preserved the unrelated
defaults. PR integration created the default-branch required-check ruleset and
changed the merge defaults. Authenticated readback confirmed:

- the active `Repo Canon required PR checks` ruleset applies to
  `~DEFAULT_BRANCH` and requires `PR metadata`;
- squash merge is enabled while merge commits and rebase merge are disabled;
- squash commits take the pull request title and body; and
- the final 20-label inventory contains every canonical label and the
  deliberately unrelated `adopter-owned` label.

The contextual work created both unfamiliar-layout Project READMEs, added and
linked the usage index, moved the complete Meteor operating guide, repaired the
handbook link, and retained the prepared project guidance. The submitted
`repo-standards/assessment/v2` reviewed scope both after fixes and against the
current project. The adoption completed with all three structural checks passed
and no uncertainty. The installed `status/v4` record reads back 97 exact
baselines, all 26 installed skill directories including the reserved system
skill, the complete assessment, operation history, checks, source selection,
and both completion points.

Before the adoption commit, Git HEAD and index still matched the prepared HEAD.
All 97 exact baselines matched current bytes and executable modes. Six excluded
or intentionally unchanged files matched their prepared bytes. The moved guide's
source bytes before deletion and destination bytes are identical, with SHA-256
`32f753555f85841804e84784da1b05c1ca5ca381321449450774cb18eec08dfb`.

The completed adoption was committed locally and pushed to
`adopt/repo-canon-v3` in the disposable public repository. A deliberate retained
`inspect --readopt` then recomputed discovery with the same package, source tag,
commit, and profile. Its confirmed inspection was
`sha256:b2a67d86ad9cc57a13fd20c153e4700535c1124e9692b8078b4fea6007ffa649`.
Confirmed `start --readopt` ran both live fixes again; each returned `unchanged`
after readback. Renewed contextual assessment and all checks completed, and the
final status retained the earlier completion in history. Authenticated recursive
tree readback of the public branch was complete rather than truncated. Its
durable state, corrected validator, both Project READMEs, and moved guide blob
IDs matched local commit `b9b24c28ee22a73ef9e86a96e6efe1e1bbdd6860`, while the deleted legacy guide
path was absent.

Two focused invocations of the exact installed validator rejected a body whose
Summary, Validation, and issue link existed only in hidden elements, and accepted
visible content beside hidden decoys. To exercise the trusted workflow from an
adopted base revision, the adopted branch was temporarily made the disposable
repository's default, a probe pull request targeted it, and public run
`34939963073` completed `PR metadata` successfully. The default was restored to
the prepared `main` before readback. Codex review correctly found that this made
the resulting protection unusable: prepared `main` did not contain the workflow
or validator capable of emitting the required check. The adoption, same-pin
re-adoption, content, and preservation evidence above remain valid, while this
first live default-branch and probe state is superseded by the correction below.

### Historical corrected default-branch readback

The authorized source repository was recreated with the same direct `v0.0.3`
tag pointing to the same reviewed `eb98da8` commit. The source identity and
114-file closure did not change. The authorized adopter was recreated with
accepted adopter commit `b9b24c28ee22a73ef9e86a96e6efe1e1bbdd6860` as
`main`, so its default branch already contained the trusted workflow and
validator. An independent GPT 5.6 Terra high review approved this final
default-branch, ruleset, integration, and probe sequence before it ran.

Installed public CLI 1.2.2 performed a fresh same-pin re-adoption. The initial
inspection identity was
`sha256:b0b779dea442fab4c1a1991081db5f149b3c1a46f6897d82a1335d3a66c94215`;
the evidence-bound scope inspection was
`sha256:341360b9c5990f8f4729172d08ab4e71ffe60cefd144c9527778b28e4a471eaa`.
Confirmed run `0ea8e9ac-12f5-4d1f-98a9-64841369972a` used selection
`sha256:c4b6de44ba6034fbcf381333e94d333e04d6856fd6743bd00ae75ed68532c9bc`.
Both remote fixes returned `changed` because the repository itself was fresh,
and readback confirmed the 12 canonical labels, unrelated `adopter-owned`
label, required-check ruleset, and squash-only settings. The corrected
assessment used the current run, selection, and after-fixes identity. All three
checks passed; final status retained two completion points, 97 exact baselines,
and all 26 installed skill directories. The first assessment submission, which
still named the earlier run, was rejected and remains in the raw history.

A direct attempt to push the completed state to protected `main` was rejected
because `PR metadata` was expected. State pull request #1 initially failed when
its `Small correction` field did not meet the validator's narrow exception
contract. After that field linked issue #38, public run `34942792057` passed.
The pull request was squash-merged as
`d218ed5ee5e42904d15cf36e9d84b722759b0f12`; its tree
`8da04b66e845fe46e9d9f1ff9aaaec997e1ab7b9` exactly matched the completed
state branch. This shows the configured protection both blocked a direct push
and permitted integration through its required check.

A fresh probe pull request #2 then targeted `main` at exact base
`d218ed5ee5e42904d15cf36e9d84b722759b0f12`. Public run `34942910631`, job
`104295488560`, completed `PR metadata` successfully. Final authenticated
readback showed default `main` protected by active ruleset
`Repo Canon required PR checks` for `~DEFAULT_BRANCH`, requiring `PR metadata`;
squash-only integration with pull request title and body defaults; all canonical
and unrelated labels; workflow blob
`86a4dbc735fe071419210bd2e3aa65d38ce5d6aa`, validator blob
`80d99daf01b9313fa985170e23a07964ef6b8f0f`, and durable-state blob
`776518ca6a5f06dbce4adb987e4a4a1215f9610e`. The complete recursive tree had
388 entries and was not truncated. A fresh local clone matched final `main`,
all preservation comparisons still passed, and the deleted legacy guide stayed
absent.

## Local scope and lifecycle executions

The remaining cases are retained historical executions from distinct real local
Git repositories in the prepared matrix. They used installed public CLI 1.2.2
and public `v0.0.2` source selection for each initial acquisition, plus the
supported retained source for later amendment or re-adoption commands. Their
generated `gh` executable and JSON state are
author-operation fixtures. Their remote-operation outcomes are local fixture
evidence and are not represented as GitHub state.

Issues #38 and #46 did not rerun these cases. The closure comparison proves that
all scope/lifecycle guidance, discovery, skills, and exact files relevant to
them are unchanged. The three documentation operation scripts and their shared
rendering resources changed in #45, whose focused parity fixtures cover their
accepted behavior; issue #46 reran all three operations during full adoption
and both same-pin runs. The remaining scope and lifecycle outcomes therefore
remain applicable without being misrepresented as `v0.0.4` executions.

| Case | Retained result |
| --- | --- |
| Active amendment | Initial scope deliberately excluded Bridge. `inspect --amend-scope` proposed only `extensions/bridge/README.md`; the confirmed identity added it while retaining prior ownership, replayed both fixes as `unchanged`, required renewed assessment, reran all checks, and completed. |
| Retroactive write | Writing the Bridge README before requesting amendment remained an out-of-scope observation. `inspect --amend-scope` rejected the interval immediately with `ASSESSMENT_SCOPE`, before it could offer a new proposal or confirmation; the active run stayed incomplete without changing HEAD or index. |
| Re-adoption | Initial adoption included and completed the Bridge Project. After a committed repository change introduced Relay and explicitly retired Bridge, retained `inspect --readopt` used unchanged pins and fresh discovery. Confirmed re-adoption added only `satellites/relay/README.md`; the retired Bridge README remained ordinary project content. Renewed assessment and checks completed. |
| Empty and unresolved | The explained empty `project-readmes` and remote-content scopes produced a confirmable inspection and complete adoption. A separate proposal with an unresolved Project question was inspectable but ineligible to start. |
| Protected targets | Separate proposals for `.git/config`, `.repo-standards/escape.md`, exact-owned `AGENTS.md`, and the `docs/linked.md` symbolic link were rejected. Each inspection left repository HEAD, index, status, protected bytes, and link identity unchanged. |
| Stale scope | After initial discovery, a tracked documentation edit invalidated the old evidence-bound proposal. Inspection rejected it as stale, performed no adoption write, and the fixture was restored to its original clean tree. |

These failure outcomes are inspection or active-run incompletions. They are not
listed as completed adoptions. Exact file installation through the explicit
targets remained unchanged in the successful lifecycle repositories, while
discovery governed only the repository-owned paths in their reviewed proposals.

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

## Historical temporary repository cleanup

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

## Historical v0.0.3 final cleanup

After the first refreshed source, adoption, re-adoption, public workflow,
configuration, content, and status readbacks were retained, the same authorized
deletion commands removed both public repositories. Codex then identified the
superseded default-branch state described above. The repositories were recreated
under the same authorization, with the exact same `v0.0.3` object, and deleted
again after the corrected readoption, integration, probe, and final readback.

For the final cleanup, the active GitHub CLI account was the owner and had the
`delete_repo` scope. An authenticated owner-repository listing omitted both exact
names, and authenticated requests to each exact repository endpoint returned
HTTP 404. Public `git ls-remote` also reported repository-not-found for both
URLs. These checks distinguish completed deletion from anonymous unavailability.
Deletion removed temporary tag `v0.0.3`, the adopter branches and pull requests,
labels, ruleset, settings, and workflow history with their repositories. The
earlier `v0.0.1`, `v0.0.2`, and first `v0.0.3` cleanup records remain historical
in the machine record.

## Final temporary repository cleanup

For `v0.0.4`, the initial adopter incarnation was deleted after its complete
adoption, configuration, content, and preservation evidence had been retained.
Authenticated API returned HTTP 404, public Git reported repository-not-found,
and the owner listing retained only the still-active source. The adopter was
then recreated for the reviewed protected-main sequence.

After the unchanged second re-adoption, protected integration, PR and issue
workflow probes, complete authenticated readback, and fresh public clone were
retained, the owner deleted both final temporary repositories. The authenticated
owner listing omitted both exact names, authenticated API returned HTTP 404 for
each, and public `git ls-remote` reported repository-not-found for each. These
checks distinguish completed deletion from anonymous unavailability. Deletion
removed temporary tag `v0.0.4`, all adopter branches and pull requests, the
fixture issue, labels, ruleset, settings, and workflow history. The retained
source commit, closure identities, CLI outputs, and readbacks remain in the
machine record independently of those deleted remotes.
