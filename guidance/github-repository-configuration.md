# GitHub repository configuration adoption guidance

Bring the adopting repository's GitHub settings into line with the
`github-repository-configuration` rules through the `canonical-labels` and
`pull-request-integration` fixes. The repeat-safe operations infer one
unambiguous github.com repository from Git remotes, require authenticated
access and the needed permissions, apply only missing settings, and read the
result back. Review blocked and partial results before retrying. Operation
evidence describes the state at execution time; it does not provide remote
freshness, rollback, or an ownership baseline.

When the repository's plan offers neither branch protection nor rulesets, the
`pull-request-integration` fix completes without requiring the `PR metadata`
check, and the next adoption or update requires it once GitHub offers either.
The fix reads the check location from Repository Standards' operation request.
At `github`, until the PR metadata validation workflow is on the default
branch, requiring the check is deferred, and the next adoption or update after
the workflow merges requires it. At `runner` and `self-reported`, no workflow
reports the check, so the fix requires it without reading or waiting for one;
where GitHub offers neither protection mechanism, its result reports that
merge's trusted required-check declaration enforces the gate.

For a public repository at `github`, the fix establishes the active
`Repo Canon PR metadata events` repository Actions policy alongside that check,
allowing `pull_request_target` for `.github/workflows/pr-metadata.yml` after
GitHub's default block. The policy uses `conditions.workflow_path.include`
and a `restrict_action_events` rule with `allowed_events` containing
`pull_request_target`. It creates a missing policy, matches its name without
case sensitivity, and blocks duplicate managed names. Differences in existing
enforcement, targeting or event rules require confirmation before any writes;
confirmed reconciliation keeps other conditions, rules and allowed events
and leaves other policies untouched. Final readback confirms active workflow
targeting and the event allowance. Matching configuration needs no writes.

Unsupported or refused policy requests return `blocked` with the missing
capability or permission and credential-redacted platform status and message,
confirmed partial effects and remaining work; no further mutation follows.
There is no trigger fallback. Private and internal repositories, and every
repository at `runner` and `self-reported`, receive no policy requests. At
`github`, an absent workflow on default defers the policy with the
check until the next adoption or update. Enterprise or organization Actions
policies can still block execution; repository-level readback cannot detect
that. See the [setup policy documentation](../docs/development/github-pr-integration-setup.md#public-repository-actions-event-policy)
for API and reconciliation details.

## Adoption delivery

Once a run starts, use its pinned runtime for completion and recovery. Before
committing each completed run, preserve that runtime's `status --summary`
output and `status` ready-to-commit verdict.

For a remote project, deliver one completed run per adoption PR under the new
`CONTRIBUTING.md`: adoption branch, complete adoption record, separate review
and squash merge. The standard profile has no configured PR reviewer by
default; follow its contribution-guide delivery without imposing factory
review-agent configuration.

For a first remote project adoption that installs the PR metadata validation
workflow absent from default, deliver through the owner, including when both protection mechanisms are proven
unavailable on the private plan. After separate review, leave the PR open and
stop with its exact reviewed head, pre-commit ready-to-commit summary and
verdict, validation outcomes, missing prerequisites and owner action. Record
absent hosted checks as absent, not passed. This bootstrap step grants no agent
merge exception and changes no wait or merge refusal. Once owner delivery or
correction is confirmed, continue from clean updated default with the next
full adoption, preserving its own pre-commit evidence and ordinary gates.

For local-only project adoption, commit the completed run on its adoption
branch and leave it ready to push and open its adoption PR once a remote
exists. Report that branch, saved pre-commit evidence, remaining review/merge
steps and the later `adopt` continuation. Keep the adopted tree for vision
work on a separate deliverable branch if needed; a remote PR waits for a
remote.

A workbench commits each completed adoption directly on its default branch,
including local-only adoption. It installs no project remote setup.

After remote adoption is delivered, return to the clean, updated default
branch and run `adopt` again without a source. Inspect its actual selection:
it may propose a newer CLI or standards release. This is a fresh full adoption
run, including scope and contextual assessment; even an unchanged selection
can write adoption bookkeeping. Complete it, apply available remote setup or
record the documented deferral, and preserve its own pinned pre-commit summary
and verdict before committing changed files. Deliver those files as another
adoption PR, or a direct workbench commit.

## Required-check freshness

The `pull-request-integration` fix establishes and reads back strict
required-check freshness through
classic protection or its managed ruleset when it establishes the required
check, preserving other checks, rules and bypass settings. Changes to existing
policy require confirmation. Adoption deferrals do not authorize unattended
merging. On a confirmed private repository, immediate merging-agent freshness
verification under the rules requires recognized plan-limit 403 responses on
the branch-rules and rulesets-list reads. The classic-protection read must
return either the recognized plan-limit 403 or HTTP 403 with the platform
message `Resource not accessible by integration`; this integration refusal
qualifies only on that protection probe after the plan-limited branch-rules
read. The residual concurrent-base race is accepted only on this proven
plan-limited path. Strict GitHub enforcement remains required wherever
available; every other permission refusal, unreadable or missing evidence and
unconfirmed freshness stop delivery.

## Remote setup

The `canonical-labels` and `pull-request-integration` fixes are remote setup:
they change GitHub's settings for the repository, not project files. Each has
a read-only readiness probe that inspection runs before anything is written.
A probe is ready only when its fix could run:

- GitHub CLI (`gh`) 2.57.0 or newer and Git 2.18.0 or newer are installed;
- the repository-local Git remotes name exactly one github.com repository, and
  GitHub resolves that same repository;
- `gh` has an authenticated active account for github.com;
- that account has write, maintain, or admin access for `canonical-labels`,
  and admin access for `pull-request-integration`.

Otherwise the probe is not ready and its reason names what to do, such as
installing `gh`, resolving the remotes, or signing in with
`gh auth login --hostname github.com`. Resolve the reason and inspect again, or
defer that remote setup and complete adoption locally: answer `defer` to
`adopt`'s remote setup question. The adoption record and `status` list each
deferred remote setup with its reason. Every later `adopt`, including one that
applies the unchanged selection again, probes again and applies a deferred
remote setup once its probe is ready. A probe changes nothing, locally or on
GitHub, and does not read the labels, rules, or settings its fix reconciles,
so a ready fix can still return `confirmation-required` or `blocked`.

`canonical-labels` renames each workflow state or category label the rules'
families replace in place, so its issues keep it. Readiness approved before the
rename names the former label, so the issue-contract workflow removes it on
its next run; review each such issue's current revision again before applying
`state:ready`. Issues left with a former label that has no single successor
get `state:triage` and go back to triage.

## Required checks

The required repository-owned `.github/required-checks.json` follows the rules'
Required-check authority and merge gate schema. The declaration owns no file or
names and adoption never creates or rewrites it. Its read-only check fails on
absence, malformed data, an empty list or a list naming both `Runner checks`
and `Review rerun`. At `runner`, declare `PR metadata` and `Runner checks`; at
`self-reported`, `PR metadata` and `Review rerun`. For remote GitHub project
adoption, have the owner establish repository-chosen exact names on the
destination default branch before starting adoption, in a separate
repository-policy change outside the adoption commit and PR; for a new
repository, after its founding commit. A local or proposed declaration cannot
satisfy this trusted-default prerequisite. If it is missing or invalid, stop
before adoption, report that owner action and retain the repository and any
gathered answers for continuation. Local-only and workbench adoption use their
delivery paths above without this remote prerequisite.

An absent trusted declaration stops wait and merge: correct it on the destination
default branch through the applicable owner procedure, then invoke again.
Do not infer names from observed results or GitHub settings, or bypass the gate
to bootstrap a declaration present only locally or on the PR branch.

## Pull request reviewer

The optional `.github/pull-request-reviewer.json` is the repository's own
configuration, not adoption output. The declaration owns no reviewer file or
preset and its confirmed scope is empty, so the run leaves the file untouched:
it neither creates nor changes it. Its read-only `pull-request-reviewer` check
passes without the file and validates the schema when present.

If the repository wants a reviewer, the agent or a maintainer adds or changes
the file in a separate commit after the run completes, following the schema in
the rules, never in the adoption commit or pull request. The check validates it
on the next `check` or update.

For existing reviewer configurations, omission of `bounds.reviewRequests` now
means a total bound of **4**, where it previously meant unbounded requests.
Explicit positive-integer bounds keep their value. To deliberately retain
unbounded requests, set `bounds.reviewRequests` to the exact JSON string
`"unbounded"` in repository-owned configuration after the run, outside its
adoption commit and adoption PR. Explain this migration without rewriting the
reviewer file during adoption. An absent file still means no reviewer, request
or reviewer wait, and the factory host remains independent of this file.

## Factory app-author review policy

The optional `.github/factory-review-policy.json` is the repository's own
configuration, not adoption output. Adoption and update leave it untouched:
they neither create nor edit it, supply a preset, select an app author nor
enable a review exemption. Deliberate configuration belongs in a separate
commit after the run completes, following the schema in the rules, never in
the adoption commit or pull request.

Only a run first selecting the factory profile asks about opting in, as the
[factory workflow guidance](factory-workflow.md#app-author-policy-opt-in)
specifies. Standard-only runs do not ask; routine updates whose previous
adoption record already selected factory do not ask again.

The read-only `factory-review-policy` check passes without the file; absence
is supported and requires no policy. Outside that first factory selection,
absence requires no owner question. When present, it
validates the version-1 schema with the same reader as the installed request
and wait commands, without account lookup or GitHub access. Valid declarations
using REST `<slug>[bot]` or CLI `app/<slug>` identities pass unchanged. Invalid
declarations, including plain human logins, and file-read failures fail with
a correction identifying the policy and the requirement from the rules. The
check never rewrites the file or treats invalid content as absence.

## Check location

Assess against the selection's check location, following the
[discovery guidance](../discovery/github-repository-configuration.md) and the
runner rules. At `github`, Repo Canon's workflows install and every job runs
on `ubuntu-latest`; disclose when a private repository's jobs consume its
account's hosted Actions minutes. At `runner` (a repository-named machine
posting commit statuses, independent of the Actions scheduler) or
`self-reported` (the authoring agent's own sandbox, identified as such and
repeated by the separate review run), Repo Canon installs no workflow file.
Every location runs the one required check command the repository's
development guide names; the repository owns that command.

At `runner`, the runner posts issue-contract results, `PR metadata` and
`Runner checks` through Repo Canon's neutral entry point, and wait and merge
count only statuses from the account `REPO_CANON_RUNNER_ACCOUNT` names. At
`self-reported`, the worker and the separate review run post `PR metadata`,
the review run posts `Review rerun`, and nobody posts issue-contract results,
so the owner applies readiness. At both locations, the standards update
command in the rules' **Automated standards updates** section keeps the
repository current. The runner or maintainer schedules it. Merge gates
require the declared results.

The `REPO_CANON_RUNS_ON` variable is retired: the run neither reads nor sets,
changes, or deletes it, and repository-owned workflows that read it keep their
own behavior. The assessment changes nothing remotely.
