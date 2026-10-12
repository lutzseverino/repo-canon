# Sandbox image build workflow

Repo Canon installs `.github/workflows/sandbox-image.yml` as the exact
`factory-sandbox-image-workflow` declaration. Its source is its installed
path, so this repository runs the same bytes that adopting repositories use.
The workflow complements the [sandbox image text check](sandbox-image-check.md)
by proving the image builds before the factory's first launch.

## Pull request behavior

Every `pull_request` run has one `Sandbox image` job on `ubuntu-latest`.
There is no event path filter: pull requests with unrelated changes report
success without invoking Docker. The job checks out the pull request's head
with full history and compares its base and head commits. Any added, modified,
deleted, or renamed path under `.sandcastle/`, or the workflow file itself,
triggers a build. Paths are null-delimited, and rename detection is disabled
so moving a file out of `.sandcastle/` still counts as removing it.

The build reproduces the factory's input contract:

```sh
docker build \
  --build-arg "AGENT_UID=$(id -u)" \
  --build-arg "AGENT_GID=$(id -g)" \
  - < .sandcastle/Dockerfile
```

The Dockerfile arrives on standard input without a build context, and the
`agent` user takes the runner user's IDs. Build output stays in the job log,
and a build failure fails the job. The workflow runs nothing inside the built
image. It builds only when these paths change and does not catch later drift
in the floating base tag.

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
They cover unrelated changes, Dockerfile and workflow changes, nested paths
with unusual names, a removed Dockerfile, build failure diagnostics, and an
unavailable comparison revision. When Docker is available, a fixture builds
a Dockerfile with a deliberately missing toolchain executable and verifies
that its failing `RUN` fails the workflow step. The GitHub-hosted CI runner
executes that fixture; local runs without Docker skip it. The shared workflow
fixtures check event permissions, action pins, and exact declaration coverage.
