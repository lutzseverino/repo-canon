# Release v0.1.1

Repo Canon **v0.1.1** is a patch release that corrects the standards-owned
`PR metadata validation` workflow. It carries no other selected source change.
The [first release](first-release.md) records the publication procedure, the
`v0.1.0` baseline, and the coordinated real-adoption boundary; this record
covers only what the patch changes. The bump convention is in
[Release versioning](../usage/versioning.md).

## Corrected failure

The shipped workflow pins `actions/setup-node` v5, which enables
package-manager caching by default and selects the cache tool from the
`packageManager` field of the adopting repository's `package.json`. An adopter
that declares a package manager other than npm failed the `Use Node.js 24` step
with `Unable to locate executable file: pnpm`, because hosted runners do not
preinstall it, and the `PR metadata` check never ran.
[Repository Standards run 35094939087](https://github.com/lutzseverino/repo-standards/actions/runs/35094939087)
recorded that failure during the first real adoption of `v0.1.0`. The job installs no
dependencies, so the cache had no purpose;
[PR #53](https://github.com/lutzseverino/repo-canon/pull/53) disables it with
`package-manager-cache: false`.

This is a compatible fix. Under the confirmed `0.x` convention a compatible fix
advances the patch number, so the release is `v0.1.1`.

## Refreshed source identity

`.github/workflows/pr-metadata.yml` is the exact declaration
`pr-metadata-workflow`, so its bytes changed the accepted source identity. The
reviewed closure is now the 115-file set at commit
`8369d823edb035c55a79f88d657db5a29efca2ce`. Exactly one path changed relative to
accepted `v0.1.0`; the other 114 are byte-and-mode
identical, and none were added or removed. The
[closure comparison](source-closure.json) enumerates every path, role, mode,
Git blob, and SHA-256 for both versions, and
[complete source acceptance](completion-record.md) records the refreshed
identity and the evidence classes that this change does and does not renew.

## Publication procedure

Compare every path in the closure before publication, then run `npm run check`,
`npm test`, `git diff --check`, and public CLI 1.2.2 `source validate` for all
profiles. Complete independent Standards and Spec reviews and integrate through
passing PR checks. Publish an annotated `v0.1.1` tag at the reviewed `main`
commit and an ordinary GitHub release using the notes below. Verify the remote
tag's peeled commit, release `draft: false` and `prerelease: false`, and
acquisition by the public CLI. `v0.1.0` keeps its original target: a published
tag is never moved, deleted, or retargeted.

## v0.1.1 release notes

This patch fixes the `PR metadata validation` workflow that Repo Canon installs
in adopting repositories. The workflow's Node.js setup step enabled
package-manager caching by default and read the `packageManager` field of the
adopting repository's `package.json`. A repository that selects a package
manager other than npm failed that step, because hosted runners do not
preinstall those package managers, and the required `PR metadata` check was
skipped. The workflow installs no dependencies, so caching is now disabled
explicitly.

No migration is needed. Re-adopt `v0.1.1` with the same `complete` profile and
the same public Repository Standards CLI **1.2.2** compatibility pin; the
re-adoption replaces one exact file. This release contains no breaking standards
change: declarations, targets, guidance, discovery, operations, skills, and the
`PR metadata` check name are unchanged, and nothing that conformed to `v0.1.0`
stops conforming. Repositories that use npm are unaffected but should still take
the fix.

The source remains one complete profile with 52 declarations, five operations,
and all 25 pinned regular author skills. See the
[acceptance record](https://github.com/lutzseverino/repo-canon/blob/v0.1.1/docs/development/completion-record.md),
[Adopt Repo Canon](https://github.com/lutzseverino/repo-canon/blob/v0.1.1/docs/usage/adopt-repo-canon.md),
and [Release versioning](https://github.com/lutzseverino/repo-canon/blob/v0.1.1/docs/usage/versioning.md).

## Evidence boundary

This release renews whole-source review and all-profile public CLI validation
for the changed bytes. The workflow change is verified by the repository's own
`PR metadata` check running on this source and by the focused fixtures in
`test/pr-metadata.test.mjs`. The disposable-adopter live evidence retained in
[the adoption evidence](adoption-evidence.md) was produced against earlier
source bytes and is not rerun here; the real adopter's own re-adoption remains
separate work tracked in
[Repository Standards #71](https://github.com/lutzseverino/repo-standards/pull/71).
