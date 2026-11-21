# Sandbox image build workflow

Repo Canon's `factory` profile installs
`vendor/repo-canon/sandbox-image.mjs` as the exact
`factory-sandbox-image-command` declaration at every check location. At
`github`, it also installs `.github/workflows/sandbox-image.yml` as the exact
`factory-sandbox-image-workflow` declaration. The workflow calls the entry
point beside the repository's own `.scriptorium/Dockerfile`, so this
repository runs the same bytes that adopting repositories use. The check
proves the repository's toolchain image builds before the factory needs it.

## Pull request behavior

Every `pull_request` run has one `Sandbox image` job (`build`) on
`ubuntu-latest`, GitHub's hosted runners, which supply the Docker CLI and
daemon this job needs. The workflow installs only at the `github` check
location; the [runner rules](../../rules/github-repository-configuration.md#installed-workflow-runners)
describe the location and the retired runner variable.
There is no event path filter: pull requests with unrelated changes report
success without invoking Docker. The job checks out the pull request's head
with full history and compares its head with the merge base of its base and
head commits. Changes made only on the base branch do not trigger a build on
an unrelated pull request. Adding, modifying, deleting, or renaming
`.scriptorium/Dockerfile` or the workflow file itself triggers a build; other
paths, including `.scriptorium/config.json`, do not. Paths are null-delimited, and
rename detection is disabled so moving the Dockerfile away still counts as
removing it, which fails the build.

The build reproduces how the factory builds the repository's toolchain image:

```sh
docker build - < .scriptorium/Dockerfile
```

The Dockerfile arrives on standard input without a build context. The
workflow builds only the toolchain image: the factory's agent layer, with its
`agent` user and agent tools, belongs to the factory release and is tested
there. Build output stays in the job log, and a build failure fails the job.
The workflow runs nothing inside the built image. It builds only when these
paths change and does not catch later drift in the floating base tag.

The workflow passes no token and posts no commit status; its job supplies the
`Sandbox image` check. It executes pull request code with only `contents: read`, no
secrets, and checkout credentials disabled. It uses `pull_request`, rather
than `pull_request_target`, because Dockerfile instructions execute during
the build. It adds no required check to the pull request integration ruleset.

## Running outside Actions

From the repository root, with Node.js 24 or 26, Git history containing the
base and head commits, and a Docker CLI and daemon, run:

```sh
node vendor/repo-canon/sandbox-image.mjs "$BASE_SHA" "$HEAD_SHA"
```

Both arguments are full commit SHAs. Check out the requested head before
running; a different checkout commit is refused. The entry point uses the
same merge-base comparison, context-free build and exit result as the
workflow. Build output stays on standard output and standard error; a failed
Docker build preserves its nonzero exit code. Unchanged inputs succeed
without invoking Docker. Comparison and Dockerfile read errors fail too.
Changing only the entry point is outside the two-path build trigger set.

To also post a `Sandbox image` commit status, supply `owner/repo` as the third
argument and set `POSTERN_TOKEN` to a token with commit-status write permission
for that repository:

```sh
node vendor/repo-canon/sandbox-image.mjs "$BASE_SHA" "$HEAD_SHA" owner/repo
```

With the token set, the command posts success or failure on the exact head
SHA through Postern. Skipping an unchanged image reports success. A failed
status post fails the command; without a token it makes no platform request.
`Sandbox image` stays non-required for merge at every location.

At `runner`, the repository's named runner invokes the installed entry point
on each pushed pull request head and supplies its repository and token.
Scriptorium's event delivery is implemented by
[scriptorium #287](https://github.com/lutzseverino/scriptorium/issues/287).

At `self-reported`, the review run runs the entry point on the exact current
head when image inputs changed and Docker is available. A failed build hands
the pull request back to the worker. When Docker is unavailable on the review
host, the review records that the build did not run and posts no status. The
review-run step is implemented by
[#1229](https://github.com/lutzseverino/repo-canon/issues/1229); this entry
point supplies its build, without scheduling the review.

## Validation

Run the workflow fixtures with Node.js 24 or 26:

```sh
node --test test/sandbox-image-workflow.test.mjs test/shared-workflows.test.mjs
```

The fixtures execute the entry point directly and through the workflow's
shell step in disposable Git repositories
and capture Docker's arguments and standard input at its process boundary.
They cover unrelated changes, base-only fixes on a diverged branch,
Dockerfile and workflow changes, other `.scriptorium/` paths and paths with unusual
names that build nothing, a moved Dockerfile, build failure diagnostics, and an
unavailable comparison revision. When Docker is available, a fixture builds
a Dockerfile with a deliberately missing toolchain executable and verifies
that its failing `RUN` fails the workflow step. The GitHub-hosted CI runner
executes that fixture; local runs without Docker skip it. The shared workflow
fixtures check event permissions, action pins, and exact declaration coverage.
Status fixtures fake only Postern's HTTP transport and verify the head,
context and build outcome. The public-CLI fixture installs the workflow and
entry point together and executes the installed workflow through that entry
point without development dependencies.
