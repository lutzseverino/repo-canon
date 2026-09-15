# Complete source acceptance

Repo Canon's `complete` profile has satisfied the implementation and evidence
requirements in specification [#1](https://github.com/lutzseverino/repo-canon/issues/1).
This is source acceptance, not a Repo Canon release. The accepted selected and
transitive source is the 115-file closure at commit
`e63f0d1438eb89c3df51a827ec169a8f5c489ded`; it resolves one profile with 52
declarations, including five operations and 25 author skills. Public Repository
Standards CLI 1.2.2 validated and adopted those exact bytes from temporary tag
`v0.0.4`.

The earlier acceptance remains historical evidence for exact commit `eb98da8`
and its 114-file closure. Issue
[#46](https://github.com/lutzseverino/repo-canon/issues/46) separately reviewed
the rendered-Markdown refactor's final installed and retained resource graph,
recomputed the source closure, and refreshed the affected public adoption and
live workflow evidence.

The historical `v0.0.3` record's initial 115-file accounting was incorrect
because it included contextual adopter target `README.md`; the corrected count
for that closure is 114. The current closure independently reaches 115 because
#45 added `operations/lib/local-markdown-links.mjs`. It still excludes the
contextual README. The [machine-readable closure comparison](source-closure.json)
enumerates every source path, role, mode, Git blob, and SHA-256. No selected
material was removed.

Relative to accepted `eb98da8`/`v0.0.3`, seven selected paths changed and
`operations/lib/local-markdown-links.mjs` was added. The other 107 files are
byte-and-mode identical, and no selected path was removed. The fixture-authoring
refactor in #44 remains outside the closure. Any future selected or transitive
byte change creates a new source identity and must repeat whole-source review,
all-profile CLI validation, and the evidence affected by that change.

## Evidence classes

Each claim below is supported by its own evidence. Passing one class does not
stand in for another.

| Evidence class | Accepted evidence | What it establishes |
| --- | --- | --- |
| Material review | [Shared material review](shared-material-review.md) and [upstream compatibility](upstream-compatibility.md) | The shared files, public templates, full promoted skill directories, native workflows, and ownership boundaries match the accepted design. |
| Whole-source review | [Complete profile integration PR #31](https://github.com/lutzseverino/repo-canon/pull/31), the whole-source audits at `51fbed5`, [metadata correction PR #39](https://github.com/lutzseverino/repo-canon/pull/39), [rendered-Markdown refactor PR #48](https://github.com/lutzseverino/repo-canon/pull/48), and the [exact closure comparison](source-closure.json) | The profile, every reference, ownership, retained operation resource, notice, and policy mapping form one coherent 115-file source. Independent Standards and Spec reviews approved exact `e63f0d` before temporary publication. |
| Source validation | [Source profile](source-profile.md#validation-boundary) and the retained [machine-readable acceptance record](adoption-acceptance.json) | Installed public CLI 1.2.2 on Node.js 24.21.0 returned `valid: true`, no errors, one `complete` profile, and 52 declarations for exact commit `e63f0d`. Source validation does not execute operations or inspect an adopter. |
| Operation fixtures | The five records in [operation evidence](#operation-evidence) | Each public operation's results, error boundary, prerequisites, preservation, and relevant repeat behavior were exercised without treating a local GitHub fixture as live remote state. |
| Skill content review | [Upstream compatibility](upstream-compatibility.md#snapshot-review-and-verification) | All 25 promoted directories and referenced resources match upstream commit `3cca18b368ae95cdbdebbff572ccafa662551015`, with no local edits or missing regular skills. |
| Skill runtime exercise | The three records in [skill evidence](#skill-evidence) | Every included skill performed a relevant bounded exercise. The records preserve harness inputs, observed outcomes, corrections, artifacts, and limitations separately from inventory review. |
| Local adoption exercise | [Local scope and lifecycle executions](adoption-evidence.md#local-scope-and-lifecycle-executions) | Real temporary Git repositories exercised initial adoption, active amendment, re-adoption, empty and unresolved scope, retroactive-write rejection, protected targets, stale evidence, preservation, and failure incompletion. Generated `gh` state remains fixture evidence. |
| Public package execution | [Final public CLI and source identity](adoption-evidence.md#final-public-cli-and-source-identity) | The run used the public npm 1.2.2 package at its retained registry URL and integrity, without a product checkout, preload, proxy, or modified transport. |
| Live remote evidence | [Final v0.0.4 public adoption and protected-main readback](adoption-evidence.md#final-v004-public-adoption-and-protected-main-readback) | An authorized disposable public adopter completed full `v0.0.4` adoption. A separate final-state incarnation completed two same-pin re-adoptions, including unchanged repetition; protected `main` blocked direct push, integrated both durable states through passing required-check PRs, and passed fresh PR and issue workflow probes against its exact final SHA. |
| Historical evidence | [CLI 1.1.0 compatibility audit](adoption-compatibility.md#historical-cli-110-scope-audit), [CLI 1.2.1 acquisition failure](adoption-evidence.md#observed-public-acquisition-blocker), and the retained `v0.0.2` matrix in the [acceptance record](adoption-acceptance.json) | These records explain earlier constraints and retain unaffected scope/lifecycle evidence without representing it as rerun against `v0.0.3`. |

The public source and adopter used for live evidence were temporary. The
[cleanup records](adoption-evidence.md#final-temporary-repository-cleanup)
confirm that both repositories, their tag, branches, rules, and settings were
deleted after the evidence was retained.

## Parent requirement accounting

The parent specification was implemented through tickets #2 through #17. This
table accounts for the resulting capabilities and their durable evidence.

| Requirement | Implementation and acceptance record |
| --- | --- |
| Confirmed repository, contribution, agent, issue, and pull request conventions | [Shared workflow material](shared-material-review.md), implemented by [#2](https://github.com/lutzseverino/repo-canon/issues/2) |
| Complete pinned regular skill collection and standards-managed update boundary | [Upstream compatibility](upstream-compatibility.md), implemented by [#5](https://github.com/lutzseverino/repo-canon/issues/5) |
| Repository README, Project README, and documentation structure checks | [Repository README check](repository-readme-check.md) and [documentation checks](documentation-check.md), implemented by [#3](https://github.com/lutzseverino/repo-canon/issues/3) and [#4](https://github.com/lutzseverino/repo-canon/issues/4) |
| Trusted pull request and issue-contract automation, including review-bound readiness | [Pull request metadata validation](pr-metadata-validation.md) and [issue contract validation](issue-contract-validation.md), implemented by [#6](https://github.com/lutzseverino/repo-canon/issues/6), [#7](https://github.com/lutzseverino/repo-canon/issues/7), and [#8](https://github.com/lutzseverino/repo-canon/issues/8) |
| Repeat-safe GitHub label, required-check, and squash configuration | [GitHub label setup](github-label-setup.md) and [PR integration setup](github-pr-integration-setup.md), implemented by [#9](https://github.com/lutzseverino/repo-canon/issues/9) and [#10](https://github.com/lutzseverino/repo-canon/issues/10) |
| Runtime evidence for all 25 included author skills and the separate adoption-preparation route | [Planning](planning-skill-exercises.md), [engineering](engineering-skill-exercises.md), and [productivity](productivity-skill-exercises.md) exercises, implemented by [#11](https://github.com/lutzseverino/repo-canon/issues/11), [#12](https://github.com/lutzseverino/repo-canon/issues/12), and [#13](https://github.com/lutzseverino/repo-canon/issues/13) |
| Owner-selected license and preserved upstream notices | The root [MIT License](../../LICENSE), [third-party notices](../../THIRD_PARTY_NOTICES.md), and retained upstream licenses, implemented by [#14](https://github.com/lutzseverino/repo-canon/issues/14) |
| One complete v2 profile with accepted ownership, discovery, operation, and compatibility wiring | [Standards source profile](source-profile.md) and [adoption compatibility](adoption-compatibility.md), implemented and reviewed by [#15](https://github.com/lutzseverino/repo-canon/issues/15) |
| Complete adoption, preservation, scope lifecycle, public-package execution, and authorized remote readback | [Complete adoption evidence](adoption-evidence.md) and its [machine-readable record](adoption-acceptance.json), implemented by [#16](https://github.com/lutzseverino/repo-canon/issues/16) |
| Auditable final accounting, maintainer and adopter guidance, and the remaining publication boundary | This record and [Adopt Repo Canon](../usage/adopt-repo-canon.md), implemented by [#17](https://github.com/lutzseverino/repo-canon/issues/17) |

## Operation evidence

The complete profile declares three checks and two fixes. The issue and pull
request metadata validators are trusted exact-file workflows rather than
Repository Standards operations; their fixture evidence is documented in
[issue contract validation](issue-contract-validation.md#running-the-fixtures)
and [pull request metadata validation](pr-metadata-validation.md).

| Operation | Fixture command | Covered boundary |
| --- | --- | --- |
| `repository-readme-structure` | `node --test test/repository-readme-check.test.mjs` | Rendered headings, section order, license-link outcomes, protocol errors, and byte preservation |
| `project-readme-structure` | `node --test test/project-readme-check.test.mjs` | Concrete Project README targets, title and link structure, diagnostics, protocol errors, and byte preservation |
| `documentation-navigation` | `node --test test/documentation-check.test.mjs` | Confirmed documentation roots, category indexes, link and migration paths, blocked ambiguity, and byte preservation |
| `canonical-labels` | `node --test test/github-label-setup.test.mjs` | Identity, versions, authentication, permissions, partial failures, readback, preservation, retry, and unchanged repetition through a stateful `gh` fixture |
| `pull-request-integration` | `npm run test:github-pr-integration` | Classic checks and rulesets, merge settings, identity, permissions, partial failures, readback, preservation, retry, and unchanged repetition through a stateful `gh` fixture |

Structural check success does not establish factual writing quality or complete
scope. Local GitHub fixtures do not establish live configuration. Those limits
are addressed by contextual assessment and authorized remote readback in the
adoption record.

## Skill evidence

These groups account for every author skill declared by the profile:

| Group | Count | Skills | Evidence |
| --- | ---: | --- | --- |
| Engineering | 9 | `ask-matt`, `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `improve-codebase-architecture`, `research`, `resolving-merge-conflicts`, `tdd` | [Engineering skill exercises](engineering-skill-exercises.md) |
| Productivity | 7 | `grill-me`, `grilling`, `handoff`, `teach`, `to-questionnaire`, `wait-what`, `writing-for-agents` | [Productivity skill exercises](productivity-skill-exercises.md) |
| Planning and delivery | 9 | `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `prototype`, `wizard` | [Planning and adoption-preparation skill exercises](planning-skill-exercises.md) |

The product-owned `adopt-standards` system skill is outside the 25 author-skill
declarations. The CLI installed it as the 26th skill directory in the public
adoption; the separate AGENTS preparation route is recorded in the planning
exercise and adoption evidence.

## Combined audit disposition

Independent GPT 5.6 Terra high Standards and Spec audits of the complete source
at `51fbed5` found no material gaps. Later architecture exploration identified
three independent corrections. Issue #36 changed the selected PR metadata
validator so hidden rendered HTML cannot satisfy required sections or issue
links. Issue #37 disabled inherited commit signing in disposable repositories
and made fixture source-input provenance complete. Issue #41 made the repository
syntax check pass every matched JavaScript filename robustly. All three fixes
were independently reviewed and passed focused tests, Codex review, and CI.

Issue #44 later consolidated fixture authoring outside the selected closure.
Issue #45 shared rendered Markdown interpretation across trusted validators and
documentation checks. The [closure comparison](source-closure.json) enumerates
the resulting 115 files: seven changed, one added, 107 byte-and-mode identical,
and none removed relative to `eb98da8`. Independent Terra high Standards and
Spec reviews approved exact `e63f0d` and its final installation/resource graph
before temporary `v0.0.4` publication. The public run renewed acquisition, all
five operation outcomes, contextual assessment, preservation, live setup,
validator workflows, and same-pin re-adoption evidence. The unaffected local
scope and lifecycle matrix remains explicitly historical rather than being
described as rerun.

Final Codex review found that the first live readback restored a prepared default
branch without the trusted workflow, leaving its required check unusable. Before
the correction ran, targeted GPT 5.6 Terra high review approved the intended
default-branch, workflow, ruleset, integration, and probe sequence. The same
reviewed `v0.0.3` source was recreated without changing its object or closure.
The corrected run completed same-pin re-adoption from adopted `main`, proved the
rule blocked direct push, integrated durable state through a passing required
check, and passed a fresh workflow probe whose base SHA equals final `main`.
Issue #46 did not repeat that failed transition. Its reviewed sequence first
completed full adoption in one adopter incarnation, then recreated the adopter
with that accepted commit already on `main`. Both durable same-pin readoption
states entered protected `main` through passing required-check pull requests.
The second run returned both fixes unchanged, a direct push was rejected, and
fresh PR metadata and issue-contract workflow probes passed against the same
final main SHA. Authenticated readback confirmed the expected workflows,
validators, operation resources, state, tree, labels, ruleset, and settings
before both temporary repositories were deleted.

## Publication prerequisite

The owner selected **v0.1.0** as the first permanent source version in
[release issue #50](https://github.com/lutzseverino/repo-canon/issues/50).
Its tag must retain the accepted 115-file source closure. Verify the ordinary
[published GitHub release](https://github.com/lutzseverino/repo-canon/releases/tag/v0.1.0)
before adoption; [first release delivery](first-release.md) records the
publication procedure and separate real-adoption boundary. The temporary
acceptance work and ticket #17 did not publish a permanent version. The owner
subsequently authorized publication and real adoption through the
[First release interview](../../authoring-notes.md#first-release-interview).

If publication preparation leaves the selected closure byte-identical to
`e63f0d1438eb89c3df51a827ec169a8f5c489ded`, the accepted source identity and
evidence remain applicable. If any selected or transitive byte changes, review
and validate the new closure and repeat affected evidence before calling that
version adoption-ready. The [usage guide](../usage/adopt-repo-canon.md) starts
at the publication boundary and gives the supported inspection and adoption
commands.
