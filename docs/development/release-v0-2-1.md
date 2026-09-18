# Release v0.2.1

Repo Canon **v0.2.1** declares the required Repository Standards CLI version as
the open-ended minimum `>=1.3.0` instead of the exact version `1.3.0`. It
carries no other selected source change, and it does not move the baseline: the
validated CLI is still 1.3.0. Every adopting repository keeps conforming with
the workflow and files it already has, so this is a compatible change and
advances the patch number. [Release v0.2.0](release-v0-2-0.md) records the
release that introduced the 1.3.0 requirement, and
[first release](first-release.md) records the publication procedure and the
`v0.1.0` baseline; this record covers only what the patch changes. The bump
convention is in
[Release versioning](../usage/versioning.md).

## Required CLI version

`requires.repo-standards` is evaluated when an adopter selects a standards
version. Repository Standards settles in its own decision record, *Gate
standards selection with the author range only*, that the requirement gates
selection only and is never re-validated afterwards, and tells authors to
declare an open-ended minimum; the accompanying product specification is
[lutzseverino/repo-standards#79](https://github.com/lutzseverino/repo-standards/issues/79).
An exact requirement strands
established adopters in both directions: a repository pinned to CLI 1.3.0 cannot
select a standards version that names a newer CLI, and a repository that updates
its CLI can no longer read the standards version it already retains. `v0.2.0`
had exactly that shape, so `standards.yaml` now declares
`requires.repo-standards: ">=1.3.0"`.

The field is a SemVer range, evaluated with `semver.satisfies`, so public CLI
1.3.0 accepts the minimum today. 1.3.0 remains the oldest version this source
was validated against and the version local validation and CI install. Public
CLI 1.2.2 still refuses the source with `INCOMPATIBLE_CLI`: the floor does not
move, so no CLI below 1.3.0 begins to satisfy the requirement. What the minimum
newly admits is CLI releases above the floor, which the exact requirement
rejected. The trade-off is that an adopter can then run a CLI this source was
never tested against; the `repo-standards/v2` format version carries that
compatibility promise instead of the author.

Raising the minimum later is not a breaking standards change. Compatibility, by
[ADR 0003](../adr/0003-follow-product-release-versioning.md), concerns the
adopting repository's conformance and workflow, and neither moves when the
requirement moves: an adopter that does not update its CLI keeps the standards
version it already selected, conforming exactly as before. Such a change is
committed as a `chore` and published as a patch release.
[ADR 0005](../adr/0005-require-an-open-ended-minimum-cli-version.md) records the
decision, [Release versioning](../usage/versioning.md#the-required-cli-version)
states the rule for adopters, and `v0.2.0`'s record carries a note that its
exactness and its breaking-change classification were both reversed here.

Opinions about when an adopter should update its CLI stay out of the source.
They belong in the agent guidance Repo Canon publishes.

## Refreshed source identity

`standards.yaml` is the source manifest and a selected input, so its bytes
changed the accepted source identity. The reviewed closure is the 115-file set
whose single changed path is `standards.yaml`; the other 114 are byte-and-mode
identical to published `v0.2.0` at
`79ff51198465248df67c6e1d6a66c95e2f964df5`, and none were added or removed. The
mode stays `100644`, and the resolved profile still reports 52 declarations,
five operations, and 25 author skills. Installed public CLI 1.3.0 on Node.js
24.21.0 returned `valid: true`, no errors, and one `complete` profile for those
bytes, with `requires.repo-standards` resolved as `>=1.3.0`.

`.github/workflows/ci.yml` continues to install and run
`@lutzseverino/repo-standards@1.3.0`. It is not a source input, and the minimum
admits that version, so it does not move with this change. The
[closure comparison](source-closure.json) enumerates every path, role, mode, Git
blob, and SHA-256 for both sides, and
[complete source acceptance](completion-record.md) records the refreshed
identity and the evidence classes that this change does and does not renew.

## Publication procedure

Compare every path in the closure before publication, then run `npm run check`,
`npm test`, `git diff --check`, and public CLI 1.3.0 `source validate` for all
profiles. Complete independent reviews and integrate through passing PR checks.
Publish an annotated `v0.2.1` tag at the reviewed `main` commit and an ordinary
GitHub release using the notes below. Verify the remote tag's peeled commit,
release `draft: false` and `prerelease: false`, and acquisition by the public
CLI. `v0.1.0`, `v0.1.1`, and `v0.2.0` keep their original targets: a published
tag is never moved, deleted, or retargeted.

## v0.2.1 release notes

This patch release declares the required public Repository Standards CLI as the
minimum **`>=1.3.0`** instead of the exact version **1.3.0**. The required
version itself does not move, and the requirement line in `standards.yaml` is
the only changed source byte; the declarations, targets, guidance, discovery,
operations, checks, fixes, skills, and check names are identical to `v0.2.0`.

**Not a breaking standards change.** Repositories conforming to `v0.2.0` keep
conforming, no file they hold has to change, and no workflow of theirs changes.
Adopters running public CLI 1.3.0 or newer can select this version; adopters
below it keep selecting the version they already use, exactly as before.

Why it changed: the requirement gates which CLI versions may select a standards
version, and Repository Standards does not re-validate it afterwards. An exact
requirement therefore strands adopters in both directions once either pin moves.
Declaring an open-ended minimum removes that, at the cost of admitting CLI
versions this source was not tested against; the `repo-standards/v2` format
version carries compatibility for those.

The source remains one complete profile with 52 declarations, five operations,
and all 25 pinned regular author skills. See the
[acceptance record](https://github.com/lutzseverino/repo-canon/blob/v0.2.1/docs/development/completion-record.md),
[Adopt Repo Canon](https://github.com/lutzseverino/repo-canon/blob/v0.2.1/docs/usage/adopt-repo-canon.md),
and [Release versioning](https://github.com/lutzseverino/repo-canon/blob/v0.2.1/docs/usage/versioning.md).

## Evidence boundary

This release renews whole-source review and all-profile public CLI 1.3.0
validation for the changed byte. No declaration, target, guidance, discovery
instruction, operation, check, fix, skill, or check name changed, so their
fixtures and records carry over unchanged, and the repository's own suite runs
the three shipped checks against this tree on every pull request. The `v0.2.0`
adoption and self-adoption evidence describes those bytes and is not rerun here.
This repository's own adoption of `v0.2.1` is separate work with its own
evidence; the minimum admits the pinned CLI 1.3.0, so it is a standards update
rather than a CLI update.
