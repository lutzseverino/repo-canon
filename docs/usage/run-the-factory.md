# Run the factory

Repo Canon installs the factory in `.sandcastle/`. A factory host runs it from
a checkout of the adopting repository on its default branch:

```sh
node .sandcastle/main.ts
```

It runs itself again under a pinned `npx` of
[Sandcastle](https://github.com/mattpocock/sandcastle), so the repository
needs no dependency. Each pass pulls the checkout forward, reads the open
issues, starts the runs it decides on, and settles the runs that ended. When
the checkout does not update, the pass is skipped, so no run starts from stale
guidance. It repeats every `FACTORY_POLL_SECONDS`, 300 by default.

## Host prerequisites

The host needs Node.js 24, Git, Docker, and the GitHub CLI authenticated with
permission to edit issue labels and comments and open pull requests. The
repository must have a completed adoption and a restorable pinned runtime for
the daily update check. Sandcastle passes the
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
`factory-<owner>-<name>-<hash>`, where the hash of the full repository identity
keeps repositories whose names flatten alike apart on a shared Docker daemon,
from the file in the checkout, without a build context
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
| `FACTORY_TIME_LIMIT_MINUTES` | Yes      | How long a run may take before it is stopped and fails, at most 35791 minutes        |
| `FACTORY_POLL_SECONDS`       | No       | The seconds between passes, at most 2147483                                          |

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

An issue's `model:` label chooses its model, as the contribution guide's
[Readiness section](../../CONTRIBUTING.md#readiness) describes; without one,
the host's default model runs.

- A bare `claude-*` slug runs on Claude Code and a bare `gpt-*` slug on Codex.
  The providers are named `claude-code` and `codex`.
- The effort is `high` by default. Claude Code accepts the efforts `low`,
  `medium`, `high`, `xhigh`, and `max`; Codex accepts all but `max`.
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

A run's pull request is one from the repository itself, not a fork, that
closes its issue or comes from the run's branch, `factory/issue-<n>`. For a run the factory is tracking, only pull
requests opened after the run started count, so an earlier run's pull requests
on the same branch don't decide it. A `factory:running` claim is held by a run the
factory is tracking or by the issue's open pull request, so it stays while
`babysit` works. On each pass, the factory settles every claim that neither
holds: it removes the claim once the issue closed, and otherwise fails the
issue. This covers a pull request closed without merging and a claim left by
an earlier factory process.

A pull request that merged while its issue is still open, with none of its
pull requests open, does not release the claim, since the factory would run the issue again. The factory fails the
issue instead, whether its run just ended or no run holds the claim, and never
retries it. The comment says the pull request merged without closing the
issue: close the issue if that finished it, or remove `factory:failed` to run
it again.

A run that ends without an open pull request, or exceeds the time limit, has
failed. A run counts as over the limit by how long it ran, whether the factory
stopped it or Sandcastle's idle timeout ended it. A failed first run retries once on the retry model, keeping the claim.
The retry takes its issue's turn in oldest-first order, waits for its
provider's gate, and launches only while the issue would still be picked up,
apart from its own claim. When the run cannot retry, the factory removes the
claim, comments the failure, the model, and the run's log, and labels the issue
`factory:failed`. Each run's log is `.sandcastle/logs/issue-<n>-attempt-<a>.log`
on the host; a failed claim that no run holds names neither. The factory skips
a failed issue until someone removes `factory:failed`.

## Daily updates

Once per 24 hours, starting with the first pass, the factory runs the project's
pinned `outdated --json`. Before each CLI command, the host checks the installed
runtime against the current lockfile and restores it with `npm ci --ignore-scripts`
when the pin changes. When a pin has an available update, it reads
`status --json` and inspects the candidate using that exact CLI through the
pinned bootstrap, without changing the project's pin. A standards update
selects the same source and profile with the available tag; a CLI-only update
keeps retained standards. An unknown pin alone launches nothing. A failed
check is logged and tried on the next daily check; it does not stop issue work.

The decision core classifies the inspection's `confirmation` report. When it
requires confirmation, the adapter files a `needs-triage` issue naming the
selection, inspection identity, and every reason. It does not create another
issue for that candidate while an earlier one exists, including a closed one.

A routine update uses spare capacity on the host's default model and the same
provider gates and time limit as issue work. Its agent follows the candidate
CLI's `adopt-standards` skill, inspects afresh with a new discovery proposal
when needed, delivers the adoption as a pull request, and uses `babysit` to
merge it. No implementation ticket is opened. If that fresh inspection or a
later fix needs confirmation, the agent stops and files the reasons for triage
before confirming anything. The factory never supplies `--confirmed`.

The adoption branch is `factory/update-standards-update-<hash>`, determined by
the candidate CLI, source, standards tag and profile. An open update pull
request from the repository itself holds the update across host restarts; any
in-repository pull request on that candidate's branch prevents another run of
the same candidate. These lookups paginate candidate branch history and open
pull requests, so repository history has no fixed cutoff. Fork pull requests
reserve no update slot. Held candidates
are reconsidered on the next daily check, without image builds or repeated
pull request reads between checks. After an update agent exits, the host checks
its exact branch for a pull request. An ended run without a pull request is
logged with its log path and may run again at the next daily check. Daily checks
continue during a long adoption without queuing its candidate again; a different
candidate may wait for the active run to exit.
