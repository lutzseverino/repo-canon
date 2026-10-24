# Standards update workflow

Both profiles install `.github/workflows/standards-update.yml` as exact content
through `standards-update-workflow`. The installed
[`github-repository-configuration` rules](../../rules/github-repository-configuration.md#automated-standards-updates)
state its behavior; the [adoption guide](../usage/adopt-repo-canon.md#automated-updates)
explains the repository settings that opt in.

## Caller behavior

The daily schedule runs at 06:23 UTC, and `workflow_dispatch` allows a manual
run. The single job runs only when `vars.REPO_CANON_UPDATES` is `true`, so
installing the workflow alone runs no steps. It uses `vars.REPO_CANON_RUNS_ON`
with the hosted default and a fixed concurrency group with
`cancel-in-progress: false` to keep scheduled and manual runs from overlapping.
The workflow requests only `contents: write`, `pull-requests: write`, and
`issues: write`.

The caller creates an App token before checkout only when both the variable
`REPO_CANON_UPDATE_APP_ID` and secret `REPO_CANON_UPDATE_APP_PRIVATE_KEY` are
present. A job environment value exposes only the secret's presence so the
step condition can test it. The recommended App installation needs Contents,
Pull requests, Issues and Workflows repository permissions set to read and
write; Workflows permits updates to workflow files. The installation token is
scoped to the current repository by the token action's defaults.

Without either credential, checkout and the update action receive
`github.token` (`GITHUB_TOKEN`). Pull requests that token opens trigger no CI,
and it cannot push workflow-file changes. The repository's Actions settings
must allow Actions to create pull requests for that fallback to open one.
Checkout selects the default branch even for a manual run from another ref
and disables persisted credentials. All actions use full commit pins with
release tags in comments. The token action is pinned to v3.3.0; Repository
Standards is pinned to v10.0.0, whose `action.yml` defines `token` and optional
`agent-command`. This caller supplies only `token`. An adopter who wants an
agent command maintains a separate caller workflow.

## Rolling updates

The Repository Standards action checks the pinned adoption for updates and
moves both pins together to the newest CLI and standards release. A complete
headless update becomes one rolling pull request on `repo-standards/update`.
A stop for contextual work or other open questions, or a refused push, becomes
one rolling issue explaining what remains. A newer target refreshes the item;
an unchanged target leaves it untouched. The action closes obsolete rolling
items when the update lands or is superseded.

Remote setup is always deferred until the next local `adopt`, including after
an automated pull request merges. Automated updates include majors and
breaking minors (`0.x` minor advances), using `chore!:` titles and Impact and
Migration sections as the [contribution guide](../../CONTRIBUTING.md#adoption-pull-requests)
requires. The action owns these update decisions and rolling items; this
repository owns the opt-in caller. Its
[upstream usage guide](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/usage/automated-updates.md)
describes the action.

## Validation

Run `node --test test/shared-workflows.test.mjs test/repository-conformance.test.mjs`
for caller permissions, triggers, opt-in, token selection, action pins, shared
runner and checkout conventions, declaration placement, and interpolation
checks. `test/repository-wide-rules.test.mjs` also adopts both profiles with
public CLI 10.0.0 and checks the installed workflow byte for byte. These tests
do not enable scheduled updates, create an App, or mutate live GitHub settings.
