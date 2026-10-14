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
