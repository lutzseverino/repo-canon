# First release

This record covers the `v0.1.0` publication. The later patch release is recorded
in [Release v0.1.1](release-v0-1-1.md); `v0.1.0` keeps its original tag target,
release, and contents.

The owner approved publication of **v0.1.0** and real adoption of its `complete`
profile in Repository Standards. [Repo Canon #50](https://github.com/lutzseverino/repo-canon/issues/50)
and [Repository Standards #69](https://github.com/lutzseverino/repo-standards/issues/69)
track this coordinated delivery. The confirmed policy is in the
[First release interview](../../authoring-notes.md#first-release-interview).

## Verified publication

[Repo Canon v0.1.0](https://github.com/lutzseverino/repo-canon/releases/tag/v0.1.0)
was published on 2026-09-15 as an ordinary release (`draft: false`,
`prerelease: false`). Its annotated tag resolves to reviewed main commit
`639af070ddeef2d82c96b8427a805da0e1bf8ba9`, integrated through
[PR #51](https://github.com/lutzseverino/repo-canon/pull/51).

Every one of the 115 accepted source inputs matched its recorded SHA-256,
Git blob and mode at that commit. Public CLI 1.2.2 validated all profiles and
acquired the permanent pin, reporting that exact commit and the `complete`
profile. [The publication record](first-release-publication.json) retains the
tag object, npm package integrity, release readback, and acquisition result.
The repository has the `repo-standards` discovery topic; search indexing is
separate from the verified direct acquisition.

Preparation passed 252 tests, public source validation, and final PR checks.
Independent Standards and Spec reviews found no remaining findings. Both Codex
review findings were corrected and independently re-reviewed before integration:
release status now distinguishes historical temporary evidence, and release
notes use absolute tag-pinned URLs. Real adoption remains tracked separately in
[Repository Standards #69](https://github.com/lutzseverino/repo-standards/issues/69).

## Publication procedure

Release preparation preserved the 115 selected and transitive source inputs
accepted at `e63f0d1438eb89c3df51a827ec169a8f5c489ded`. The
[comparison retained at this tag](https://github.com/lutzseverino/repo-canon/blob/v0.1.0/docs/development/source-closure.json)
records those bytes; the [current comparison](source-closure.json) records the
later `v0.1.1` identity. Compare each path's SHA-256, Git blob, and file mode
before publication. Changes outside that closure do not invalidate its accepted
evidence; source changes require the refresh described in
[complete source acceptance](completion-record.md).

Run `npm run check`, `npm test`, `git diff --check`, and public CLI 1.2.2
`source validate` for all profiles. Complete independent Standards and Spec
reviews and integrate release preparation through passing PR checks. Publish
an annotated `v0.1.0` tag at that reviewed main commit and an ordinary GitHub
release using the notes below. Verify the remote tag's peeled commit, release
`draft: false` and `prerelease: false`, and acquisition by the public CLI.
A permanent published tag retains its original target.

## v0.1.0 release notes

Repo Canon's first release supplies one complete profile for repository
README structure, categorized documentation, contribution and agent guidance,
GitHub issue and PR contracts, repeat-safe labels and PR integration setup,
and all 25 pinned regular Matt Pocock author skills with their notices.

Use public Repository Standards CLI **1.2.2**; compatibility is pinned to that
exact version. The source has 52 declarations and five operations. The
[acceptance record](https://github.com/lutzseverino/repo-canon/blob/v0.1.0/docs/development/completion-record.md) distinguishes material review,
whole-source validation, operation fixtures, skill exercises and public
adoption evidence.

This is the initial standards baseline; there is no earlier published Repo
Canon version to migrate from. First adoption can require documentation moves,
exact-file replacements, and workflow changes. Preserve project guidance in a
separate reviewed preparation change, inspect all replacements and concrete
scope, then confirm adoption. See [Adopt Repo Canon](https://github.com/lutzseverino/repo-canon/blob/v0.1.0/docs/usage/adopt-repo-canon.md).

Version 0.1.0 denotes initial development. Features and breaking standards
changes advance the minor number during 0.x; compatible fixes advance patch.
Future release notes identify breaking requirements and migration explicitly.
See [Release versioning](https://github.com/lutzseverino/repo-canon/blob/v0.1.0/docs/usage/versioning.md).

## Delivery boundary

Publication verification and the real adopter's completion record follow the
release preparation. Finish with reviewed adoption merged into `repo-standards`
and its packaged output validated, including compatibility for all nine
previously published documentation paths. A new product package publication is
outside this delivery. The earlier disposable adoption evidence remains
separate from this first real adoption.
