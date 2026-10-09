# Run the factory

Repo Canon installs the factory in `.sandcastle/`. A factory host runs it from
a checkout of the adopting repository on its default branch:

```sh
node .sandcastle/main.ts
```

It runs itself again under a pinned `npx` of
[Sandcastle](https://github.com/mattpocock/sandcastle), so the repository
needs no dependency. Each pass pulls the checkout forward, reads the open
issues, starts the runs it decides on, and settles the runs that ended. It
repeats every `FACTORY_POLL_SECONDS`, 300 by default.

## Host prerequisites

The host needs Node.js 24, Git, Docker, and the GitHub CLI authenticated with
permission to edit issue labels and comments. Sandcastle passes the
variables listed in `.sandcastle/.env`, such as `GH_TOKEN` and the agent's
credentials, into each sandbox. The file stays on the host;
`.sandcastle/.gitignore` keeps it, the run logs, and Sandcastle's worktrees
out of Git.

## Sandbox image

Every run starts in the repository's own image, built from
`.sandcastle/Dockerfile`: Repo Canon's base, with Node.js, Git, the GitHub CLI,
Claude Code, and Codex, followed by the repository's toolchain from its
[development guide](../development/README.md). Adoption writes the file, and
the [sandbox image check](../development/sandbox-image-check.md) keeps the base
intact. Before each pass that launches a run, the factory builds the image as
`factory-<owner>-<name>` from the file in the checkout, without a build context
and with the host user's IDs for the sandbox's `agent` user. When the build
fails, the factory launches nothing, leaves the issues unclaimed on the
frontier, and logs the error.

## Host settings

The host sets these in the factory's environment. Repo Canon ships no values,
and the factory refuses to start until the required ones are usable.

| Variable                     | Required | Meaning                                                                              |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `FACTORY_DEFAULT_MODEL`      | Yes      | The model for an issue without a `model:` label, written as a label names one        |
| `FACTORY_RETRY_MODEL`        | No       | The model for the one retry of a failed run; without it, a failed run is not retried |
| `FACTORY_CAPS`               | Yes      | The most agents each provider may run at once, such as `claude-code=2,codex=1`       |
| `FACTORY_USAGE_THRESHOLD`    | Yes      | The usage percentage at or above which a provider launches nothing                   |
| `FACTORY_TIME_LIMIT_MINUTES` | Yes      | How long a run may take before it is stopped and fails                               |
| `FACTORY_POLL_SECONDS`       | No       | The time between passes                                                              |

A provider that `FACTORY_CAPS` omits launches nothing.

## Pickup

The frontier is every open issue that carries `ready-for-agent`, has no open
native blocker, and carries neither `factory:running` nor `factory:failed`.
The oldest issue launches first.

- **Direct run**: one agent started with `/implement #<n>`. An issue runs
  directly by default.
- **Orchestrated run**: one agent started with `/implement-spec #<n>`. A ticket
  labelled `run:orchestrated` runs this way.
- **Specification**: an issue with native sub-issues always runs orchestrated,
  and only once it and every open child carry `ready-for-agent`. The factory
  never picks up a child of a specification.

The factory claims an issue with `factory:running` before it launches the run.
Each skipped ready issue is logged with its reason.

## Models

A `model:` label names the model as `<slug>` or `<provider>/<slug>`, with an
optional `@<effort>` suffix. The effort is `high` by default.

- A bare `claude-*` slug runs on Claude Code (`claude-code`), and a bare `gpt-*`
  slug on Codex (`codex`). Any other slug names its provider, such as
  `model:codex/o5@medium`.
- Claude Code accepts the efforts `low`, `medium`, `high`, `xhigh`, and `max`;
  Codex accepts all but `max`.
- An issue with an unusable or more than one `model:` label is skipped with the
  correction.

## Gates

A provider launches a run only while fewer agents than its cap run there and its
usage is below the threshold. An issue held by a gate stays on the frontier.

- Codex usage is read through the Codex app-server's `account/rateLimits/read`,
  as the fuller of its rate-limit windows. The host needs the `codex` CLI
  signed in.
- Claude Code publishes no usage read. The factory reads it best-effort with
  the `CLAUDE_CODE_OAUTH_TOKEN` in its environment.
- An unreadable usage reading gates the provider by count only.

## Claims and failures

A run's pull request is one that closes its issue. A run that opened its pull
request keeps the claim while `babysit` works. When the run ends, the factory
removes the claim if the pull request merged or the issue closed, and leaves
it while the pull request is open.

A run that ends without an open pull request, or exceeds the time limit, has
failed. A failed first run retries once on the retry model, keeping the claim.
Otherwise the factory removes the claim, comments the failure, the model, and
the run's log, and labels the issue `factory:failed`. Each run's log is
`.sandcastle/logs/issue-<n>-attempt-<a>.log` on the host. The factory skips a
failed issue until someone removes `factory:failed`.

The factory tracks its runs in memory. After a restart, an issue still claimed
by a run of the earlier process keeps `factory:running` until someone removes
it.
