# Sandbox image build workflow

Repo Canon's `factory` profile installs `.github/workflows/sandbox-image.yml`
as the exact `factory-sandbox-image-workflow` declaration, beside the
repository's own `.factory/Dockerfile`. Its source is its installed path, so
this repository runs the same bytes that adopting repositories use. The
workflow proves the repository's toolchain image builds before the factory
needs it.

## Pull request behavior

Every `pull_request` run has one `Sandbox image` job (`build`) on
`ubuntu-latest` unless the `REPO_CANON_RUNS_ON` variable names other runner
labels as a JSON array. Unset or empty keeps the hosted default; the
[runner guidance](../../guidance/github-repository-configuration.md#installed-workflow-runners)
describes prerequisites, inheritance, and fallback, including the Docker CLI
and daemon this job needs.
There is no event path filter: pull requests with unrelated changes report
success without invoking Docker. The job checks out the pull request's head
with full history and compares its head with the merge base of its base and
head commits. Changes made only on the base branch do not trigger a build on
an unrelated pull request. Adding, modifying, deleting, or renaming
`.factory/Dockerfile` or the workflow file itself triggers a build; other
paths, including `.factory/config.json`, do not. Paths are null-delimited, and
rename detection is disabled so moving the Dockerfile away still counts as
removing it, which fails the build.

The build reproduces how the factory builds the repository's toolchain image:

```sh
docker build - < .factory/Dockerfile
```

The Dockerfile arrives on standard input without a build context. The
workflow builds only the toolchain image: the factory's agent layer, with its
`agent` user and agent tools, belongs to the factory release and is tested
there. Build output stays in the job log, and a build failure fails the job.
The workflow runs nothing inside the built image. It builds only when these
paths change and does not catch later drift in the floating base tag.

The workflow executes pull request code with only `contents: read`, no
secrets, and checkout credentials disabled. It uses `pull_request`, rather
than `pull_request_target`, because Dockerfile instructions execute during
the build. It adds no required check to the pull request integration ruleset.

## Validation

Run the workflow fixtures with Node.js 24:

```sh
node --test test/sandbox-image-workflow.test.mjs test/shared-workflows.test.mjs
```

The fixtures execute the workflow's shell step in disposable Git repositories
and capture Docker's arguments and standard input at its process boundary.
They cover unrelated changes, base-only fixes on a diverged branch,
Dockerfile and workflow changes, other `.factory/` paths and paths with unusual
names that build nothing, a moved Dockerfile, build failure diagnostics, and an
unavailable comparison revision. When Docker is available, a fixture builds
a Dockerfile with a deliberately missing toolchain executable and verifies
that its failing `RUN` fails the workflow step. The GitHub-hosted CI runner
executes that fixture; local runs without Docker skip it. The shared workflow
fixtures check event permissions, action pins, and exact declaration coverage.
