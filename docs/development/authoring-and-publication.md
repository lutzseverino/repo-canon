# Authoring and publication

Source authoring, publication, and adoption are separate stages:

1. Repo Canon maintainers edit and validate the local source. The
   [development guide](README.md) gives the repository checks, and the
   [source profile](source-profile.md) gives exact public CLI validation.
2. The owner publishes a stable Repo Canon source version through the
   [release procedure](release.md), which reviews and validates its source
   inputs before publication.
3. An adopting maintainer adopts a published version with `adopt`, as the
   [Repository README](../../README.md#installation) and the
   [adoption guide](../usage/adopt-repo-canon.md) describe. `adopt` acquires
   only published stable releases, so a source change reaches adopting
   repositories, Repo Canon's own included, only through the first two stages.

## Canon's self-adoption

Canon authors skills at the same paths that adoption installs. When its own
`standard` or `factory` lock still owns `.agents/skills/orchestrate`, the
first update to workbench-only selection removes that installed directory.
Preserve the authoritative source as a one-time transition:

1. From the clean authoring checkout, record the pre-update commit with
   `authoring_head=$(git rev-parse HEAD)` before running the normal adoption.
2. Complete the CLI run, including its normal ownership/conflict handling.
   Then restore only the tracked source with
   `git restore --source="$authoring_head" -- .agents/skills/orchestrate`.
3. Before committing, run `pnpm validate`, all-profile source validation as
   described in the [source profile](source-profile.md#executable-prerequisites),
   and the normal adoption status check. The repository conformance suite
   requires the complete orchestrate source and credits even under Canon's
   factory adoption; missing source fails `pnpm validate`.

Do not edit CLI state or exempt removed installations. After this run the
lock no longer owns orchestrate; later updates leave its authoring source
alone, like the workbench-only creation skills. This restore applies only
to Canon while its lock still owns orchestrate. Other standard/factory
adopters receive the normal selected removal described in
[adoption compatibility](adoption-compatibility.md#workbench-only-orchestrate-migration).
If later documentation discovery asks about the now-unselected skill's
Markdown files, exclude them as source authoring, like the creation skills'
source; do not move or delete them as repository documentation.
