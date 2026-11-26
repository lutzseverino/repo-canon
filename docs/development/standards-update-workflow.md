# Standards update workflow

At the `github` check location, the standard and factory profiles install
`.github/workflows/standards-update.yml` as exact content
through `standards-update-workflow`; other locations install no caller. The installed
[`github-repository-configuration` rules](../../rules/github-repository-configuration.md#automated-standards-updates)
state its behavior; the [adoption guide](../usage/adopt-repo-canon.md#automated-updates)
explains the repository settings that opt in.

## Caller behavior

The daily schedule runs at 06:23 UTC, and `workflow_dispatch` allows a manual
run. The single job runs only when `vars.REPO_CANON_UPDATES` is `true`, so
installing the workflow alone runs no steps. It runs on `ubuntu-latest` and
uses a fixed concurrency group with
`cancel-in-progress: false` to keep scheduled and manual runs from overlapping.
Workflow-level permissions are empty; the job requests only `contents: write`,
`pull-requests: write`, and `issues: write`.

The caller creates an App token before checkout only when both the variable
`REPO_CANON_UPDATE_APP_CLIENT_ID` and secret `REPO_CANON_UPDATE_APP_PRIVATE_KEY` are
present. A job environment value exposes only the secret's presence so the
step condition can test it. The recommended App installation needs Contents,
Pull requests, Issues and Workflows repository permissions set to read and
write; Workflows permits updates to workflow files. The caller explicitly
requests these four write permissions, and the token action's defaults scope
the installation token to the current repository. The Client ID is shown on
the App's settings page: from the owning account's or organization's
**Settings > Developer settings > GitHub Apps > Edit**, copy **Client ID**.

Unless both credentials are set, checkout and the update action receive
`github.token` (`GITHUB_TOKEN`). Pull requests that token opens trigger no CI,
and it cannot push workflow-file changes. The repository's Actions settings
must allow Actions to create pull requests for that fallback to open one.
Checkout selects the default branch even for a manual run from another ref
and disables persisted credentials. All actions use full commit pins with
release tags in comments. The token action is pinned to v3.3.0; Repository
Standards is pinned to v12.0.0, whose `action.yml` defines `token` and optional
`agent-command`. This caller supplies only `token`. An adopter who wants an
agent command maintains a separate caller workflow.

## Run outside Actions

At `runner` and `self-reported`, run this command from a clean, dedicated
checkout of the default branch:

```sh
npm exec --yes --package @lutzseverino/repo-standards@12.0.0 -- repo-standards-update
```

Supply `REPO_STANDARDS_TOKEN` through the environment or a secret manager.
The token needs Contents, Pull requests and Issues write permissions and
Workflows write permission when the update changes workflow files. The same
v12.0.0 release powers both entry points. The executable uses the working
directory and derives `owner/name` from its GitHub `origin`. With a different
remote layout, append `--repository owner/name` to identify the repository.
The token authorizes API requests and HTTPS pushes. An SSH `origin` uses the
machine's own SSH credentials for pushes.

Use Node.js 24 or 26, Git, `bash`, and network access to npm and GitHub. The
executable commits on and pushes `repo-standards/update` from the supplied
checkout. The runner or maintainer schedules and serializes recurring runs.
Repo Canon declares the command in `update-command` so the
`repository-standards` skill names it when an update is available at either
off-Actions location.

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
Migration sections as described in the [contribution guide](../../CONTRIBUTING.md#adoption-pull-requests).
The action owns these update decisions and rolling items; this
repository owns the opt-in caller. Its
[upstream usage guide](https://github.com/lutzseverino/repo-standards/blob/v12.0.0/docs/usage/guides/automated-updates.md)
describes the action.

An adoption or update PR may append one `## Related issue` section after the
complete record and any Impact/Migration sections, as the contribution guide
describes. The rendered summary remains byte-preserved at the start of the
body. A record without a relationship remains valid, including the action's
rolling update body; this caller composes no PR body. When an update finishes
an issue, its submitted body carries the closing reference in that trailing
section so explicit squash merge retains it.

## Validation

Run `node --test test/shared-workflows.test.mjs test/repository-conformance.test.mjs`
for caller permissions, triggers, opt-in, token selection, action pins, shared
runner and checkout conventions, declaration placement, and interpolation
checks. `test/repository-wide-rules.test.mjs` also adopts both of them with
public CLI 12.0.0 and checks the installed workflow byte for byte.
`test/standards-update-command.test.mjs` checks that the declared command, the
rules and this workflow name one release and runs the command against a stub
executable, and `test/check-locations.test.mjs` checks what the pinned
CLI reports after adoption at each location. These tests
do not enable scheduled updates, create an App, or mutate live GitHub settings.
