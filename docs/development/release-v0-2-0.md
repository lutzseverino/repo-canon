# Release v0.2.0

Repo Canon **v0.2.0** raises the exact required Repository Standards CLI version
from 1.2.2 to 1.3.0. It carries no other selected source change. It is published
and verified below. Requiring a newer CLI is mandatory migration work for
adopters, so this is a breaking standards change with an explicit note, and
under the confirmed `0.x` convention it advances the minor number. The
[first release](first-release.md) records the publication procedure and the
`v0.1.0` baseline, and [Release v0.1.1](release-v0-1-1.md) records the patch
that preceded this one;
this record covers only what the minor release changes. The bump convention is
in [Release versioning](../usage/versioning.md).

## Verified publication

[Repo Canon v0.2.0](https://github.com/lutzseverino/repo-canon/releases/tag/v0.2.0)
was published on 2026-09-18 as an ordinary release (`draft: false`,
`prerelease: false`). Its annotated tag resolves to reviewed main commit
`79ff51198465248df67c6e1d6a66c95e2f964df5`, integrated through
[PR #66](https://github.com/lutzseverino/repo-canon/pull/66).

Every one of the 115 accepted source inputs matched its recorded SHA-256, Git
blob, and mode at that commit, so the tag carries the reviewed identity. Public
CLI 1.3.0 validated all profiles at the tagged tree, returning `valid: true`,
no errors, one `complete` profile, and 52 declarations, and acquired the
permanent pin in a disposable project, reporting that exact commit, the
`complete` profile, and a `repo-standards/inspection/v2` report. The acquired
manifest declares `requires.repo-standards: "1.3.0"`.
[The publication record](release-v0-2-0-publication.json) retains the tag
object, npm package integrity, release readback, and acquisition result.

`v0.1.0` and `v0.1.1` are untouched: their annotated tags still resolve to
`639af07` and `0f313ef`, and both releases remain ordinary published releases.
Preparation passed 257 tests, public source validation under CLI 1.3.0, and
final PR checks. Independent Standards and Spec reviews of the release
preparation, and a targeted rereview of its corrections, left no open finding;
both reviews re-derived the 115-path closure from the CLI's resolved
declarations and verified every recorded mode, Git blob, and SHA-256 against
Git.

A read-only bootstrap inspection of this repository at the tagged commit,
through public CLI 1.3.0 installed outside the checkout, returns a
`repo-standards/inspection/v2` report with identity
`sha256:684e74a00fe4377a1c11da6a8d075fcb4f230ca41d0deffe75c04bf2ad3c7f1d` for
selected `v0.2.0` and the `complete` profile. An inspection identity covers the
inspected project as well as the selection, so it reproduces only for this
project root; the report's resolved selection, declarations, and manifest are
the portable part. The same CLI against published
`v0.1.1` returns `INCOMPATIBLE_CLI`, which is the requirement working as
described. That inspection is evidence that the published bytes are readable by
the CLI they require; it is not adoption, which is separate work.

## Required CLI version

Repository Standards 1.3.0 is the release that ships compact work evidence
([lutzseverino/repo-standards#75](https://github.com/lutzseverino/repo-standards/issues/75))
and compact scope evidence
([#76](https://github.com/lutzseverino/repo-standards/issues/76)) together with
the fix for the adopter lockout
([#77](https://github.com/lutzseverino/repo-standards/issues/77)). Adopting
Repo Canon with CLI 1.2.2 commits roughly 26 MB of durable run state, and a
repository whose own product state grew past the CLI's per-file observation
limit could not re-inspect itself at all. Both are resolved in 1.3.0, so
`standards.yaml` now declares `requires.repo-standards: "1.3.0"`.

The requirement is exact, not a range, exactly as it was for 1.2.2. Installed
public CLI 1.2.2 therefore refuses this source with `INCOMPATIBLE_CLI` at
`standards.yaml` line 5 instead of resolving a profile. That refusal is the
breaking part: a repository conforming to `v0.1.1` must install the newer CLI
before it can select `v0.2.0`. Nothing else in the source moved, so no
declaration, target, guidance, discovery instruction, operation, check, fix,
skill, or check name changes, and no repository content has to be rewritten.

This release is the third step of the
[self-adoption specification](https://github.com/lutzseverino/repo-canon/issues/60);
[#62](https://github.com/lutzseverino/repo-canon/issues/62) carries it. The
repository's own adoption of these bytes is separate later work.

## Refreshed source identity

`standards.yaml` is the source manifest and a selected input, so its bytes
changed the accepted source identity. The reviewed closure is the 115-file set
whose single changed path is `standards.yaml`; the other 114 are byte-and-mode
identical to published `v0.1.1` at
`0f313ef435c715889303ec1157f1006bee1fb9f4`, and none were added or removed. The
mode stays `100644`, and the resolved profile still reports 52 declarations,
five operations, and 25 author skills. Installed public CLI 1.3.0 on Node.js
24.21.0 returned `valid: true`, no errors, and one `complete` profile for those
bytes.

`.github/workflows/ci.yml` and this repository's own documentation also name the
required CLI, and both move to 1.3.0 with the requirement. Neither is a source
input: the workflow is this repository's tooling, and the documentation is
project-owned content outside the closure. They change so that the repository
validates with the CLI its own source now requires, without touching the
released bytes. The [closure comparison](source-closure.json) enumerates every
path, role, mode, Git blob, and SHA-256 for both sides, and
[complete source acceptance](completion-record.md) records the refreshed
identity and the evidence classes that this change does and does not renew.

## Publication procedure

Compare every path in the closure before publication, then run `npm run check`,
`npm test`, `git diff --check`, and public CLI 1.3.0 `source validate` for all
profiles. Complete independent Standards and Spec reviews and integrate through
passing PR checks. Publish an annotated `v0.2.0` tag at the reviewed `main`
commit and an ordinary GitHub release using the notes below. Verify the remote
tag's peeled commit, release `draft: false` and `prerelease: false`, and
acquisition by the public CLI. `v0.1.0` and `v0.1.1` keep their original
targets: a published tag is never moved, deleted, or retargeted.

## v0.2.0 release notes

This minor release requires public Repository Standards CLI **1.3.0** instead of
1.2.2. That CLI records compact work and scope evidence and fixes the adopter
lockout in lutzseverino/repo-standards#77, so adopting repositories no longer
commit multi-megabyte run state and stay inspectable as they grow. The exact
required version in `standards.yaml` is the only changed source byte; the
declarations, targets, guidance, discovery, operations, checks, fixes, skills,
and check names are identical to `v0.1.1`.

**Breaking standards change.**

Impact: the requirement is exact, so an adopter pinned to public CLI 1.2.2
cannot select `v0.2.0`. That CLI rejects the source with `INCOMPATIBLE_CLI`
before resolving any profile, and inspection, start, resume, and status all fail
the same way. Repositories already conforming to `v0.1.1` keep conforming to
`v0.1.1`; nothing in their content stops conforming, and no file they hold has
to change.

Migration: update one pin at a time. First install public Repository Standards
CLI 1.3.0 outside the project and keep the `v0.1.1` standards pin, so the CLI
change is verified on its own. Then move the standards pin to `v0.2.0` and
re-adopt with the same `complete` profile. Do not move both pins in one step:
1.3.0 against `v0.1.1` returns `INCOMPATIBLE_CLI` in the other direction, so a
failure would not say which pin caused it. An adopter that cannot update the CLI
stays on `v0.1.1`, which remains published and unchanged.

The source remains one complete profile with 52 declarations, five operations,
and all 25 pinned regular author skills. See the
[acceptance record](https://github.com/lutzseverino/repo-canon/blob/v0.2.0/docs/development/completion-record.md),
[Adopt Repo Canon](https://github.com/lutzseverino/repo-canon/blob/v0.2.0/docs/usage/adopt-repo-canon.md),
and [Release versioning](https://github.com/lutzseverino/repo-canon/blob/v0.2.0/docs/usage/versioning.md).

## Evidence boundary

This release renews whole-source review and all-profile public CLI validation
for the changed byte, now under CLI 1.3.0. The earlier CLI 1.2.2 validation,
adoption, and live disposable-adopter evidence retained in
[the adoption evidence](adoption-evidence.md) describes `v0.1.x` under that CLI
and is not rerun here; it stays historical evidence rather than evidence for
this release. No operation, check, fix, or skill changed, so their fixtures and
records carry over unchanged, and the repository's own suite runs the three
shipped checks against this tree on every pull request. Adoption of `v0.2.0`,
including this repository's self-adoption, is separate work with its own
evidence.
