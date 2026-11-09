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

Canon authors skills at the same paths that adoption installs. Its edited
orchestrate files and newer source files differ from the recorded adoption.
When its non-workbench update retires that installation, the CLI's normal
ownership policy keeps the whole locally edited skill directory, including
files that still match their installed baseline. Verify that inspection
reports the source as kept and that the completed run is ready to commit.
The new lock no longer owns orchestrate; later updates leave it alone, like
the workbench-only creation skills. No special restore or CLI state edit is
needed or permitted within the adoption pull request.

Before committing, run `pnpm validate` and all-profile source validation as
described in the [source profile](source-profile.md#executable-prerequisites).
Repository conformance requires the complete orchestrate source and credits
even under Canon's factory adoption; missing or incomplete source fails
`pnpm validate`. If an update proposes source removal or loses a source file,
stop for a supported transition rather than committing that deletion.
Downstream standard/factory adopters receive the normal removal of unchanged
installations described in
[adoption compatibility](adoption-compatibility.md#workbench-only-orchestrate-migration).
If later documentation discovery asks about the now-unselected skill's
Markdown files, exclude them as source authoring, like the creation skills'
source; do not move or delete them as repository documentation.
