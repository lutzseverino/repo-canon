# Contributing

## Issues

Use an issue for behavior changes and substantive work unless the maintainer
requests the change in a thread. Work without a ticket is a Direct change; see
[pull requests](#pull-requests). Agree on the scope and acceptance criteria
before implementation. Open issues with the repository's issue
templates. Specifications and implementation tickets live in the issue tracker;
repository documents keep durable domain language, decisions, usage guidance,
and development knowledge.

Use short, descriptive issue titles in sentence case and the project's
terminology. Name the observed failure for bugs, the desired capability for
features, the action for implementation tickets, and the capability being
specified for specifications. Avoid redundant type prefixes, issue numbers,
and trailing periods; aim for roughly 72 characters without a hard limit.

## Implementation contracts

A directly authored specification or implementation ticket carries its
implementation contract in its issue body and needs no intake triage, Agent
Brief, or category label. A triaged request's contract is its latest Agent
Brief comment; the intake body and discussion remain context.

Before implementing, read the whole issue, its discussion, its parent
specification, and its blockers, and clarify contradictions. Start a ticket
only after its blockers are closed.

Every ticket merges into its base branch on its own, with its checks passing.
Expand–contract batches that can't each stay green become a single ticket, not
tickets sharing an integration branch.

When adding a native blocker, pass the blocking issue's numeric database ID as
`issue_id`, not its issue number or `node_id`.

## Readiness

Applying `ready-for-agent` or `ready-for-human` is the review action and needs
the repository `admin`, `maintain`, or `triage` role. After revising a contract
or posting an Agent Brief, wait for the issue-contract workflow's revision
notice before applying readiness. Editing a contract removes its readiness. The
workflow keeps one workflow state label on an issue: authorized readiness or a
newly applied state replaces the previous one, and an issue left with none gets
`needs-triage` on every run, even if it has never carried a state. This applies
to open intake requests, specifications, tickets, and unrecognized issues;
Wayfinder maps and children stay outside workflow states. The validator's own
`needs-triage` is a fallback and never supersedes authorized readiness bound to
the current revision, even when applied after its review. A person's later
workflow state still supersedes readiness. A closed issue loses `needs-triage`
and keeps its other labels and feedback unchanged.
A specification or ticket can be ready while its blockers are open.

## Development setup

See the [development guide](docs/development/README.md) for prerequisites,
local setup, and development commands.

## Validation

Add or update tests for changed behavior where applicable. Run the required
checks documented in the development guide before requesting review.

## Findings

Every agent run records findings: implementation, release, review, and adoption or update. A
finding is a defect, gap, or stale instruction the run observed outside the
work it is responsible for. Fix defects inside the change's responsibility in
the change. An adoption run's own contextual work in the adopting repository
is not a finding.

Before filing, check for an open issue that already reports the finding and
link it instead of creating a duplicate. Otherwise, open one issue per finding
through the target repository's issue forms, labelled `needs-triage`. File it
in the repository responsible for the affected material or tooling. Each issue
cites the run's pull request or issue and distinguishes what the run observed
from what it only read in code. Leave the issues to triage.

Link every filed or existing issue in this order:

1. A run with a pull request links them from a comment on that pull request.
   For adoption, use its check-outcomes comment.
2. A run without a pull request links them from the issue it was working on,
   if there is one, such as a release run's planning issue.
3. Only a run with neither a pull request nor an issue lists them in its final
   message.

If filing fails, list each unfiled finding in the same place the links would
go, name its target repository, and state that it was not filed. Findings never
block or delay the run's pull request or other work.

## Titles and commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
for pull request titles and final commits on the default branch:

```text
fix(cli): reject incompatible standards versions
feat!: remove the legacy configuration format
```

Use lowercase types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`,
`ci`, `style`, `chore`, or `revert`. An optional scope names a stable component
or project. Write a concise action without a trailing period, preserving
proper names and identifiers. Use `style` for formatting changes.

Mark breaking changes with `!` and explain their impact and migration in the
message body. Prefer Conventional Commits during development; temporary
work-in-progress commits are allowed.

No commit or pull request credits an agent, a model, or a tool as an author or
a source. Omit every `Co-authored-by:` trailer, for any co-author, including
people and bots; any "Generated with …" or "Generated by …" attribution line;
and agent session links. The merging account already records who did the work.

## Pull requests

Keep each pull request focused. Describe the problem and resulting change,
report the checks you ran and their outcomes, and link the relevant issue.
A pull request that finishes its issue links it with a closing reference, such
as `Closes #123`, so merging it closes the issue. A pull request that does only
part of an issue's work links it without a closing reference, such as
`Part of #123`. A closing reference closes the issue only when the pull request
merges into the default branch; with another base branch, whoever merges closes
the issue after the merge. If the work finished the issue, close it.

A Direct change is work without a ticket, requested by the maintainer in a
thread or making a minor correction, such as a typo, broken link, or formatting
fix. Write `Direct change:` and a meaningful reason instead of the issue link.

Keep the pull request template's sections in order: Summary, Evidence, Merge
Danger, and Related issue. Include checks and outcomes in Evidence, and
relevant limits in Merge Danger. Put any other material, such as scope, impact,
or migration, in a subsection of the section it belongs to.

### Opening a pull request

Open the pull request against the base branch that `docs/agents/project.md`
names, else the default branch. Its branch holds only the work: branch from the
up-to-date base, and leave unrelated changes out of its commits. Title it as
[titles and commits](#titles-and-commits) describe.

Before opening, run the required checks on the final commit. When the checkout
holds unrelated uncommitted edits, run them in a clean checkout of that commit,
such as a temporary Git worktree. Run a check that reads a diff, such as
`git diff --check`, over the whole change against the base.

For an ordinary pull request, write the body with the `pr` skill, in the pull
request template's sections: the skill's Summary, Evidence and Merge Danger,
then Related issue. For an adoption pull request, use the adoption record as
described below.

### Adoption pull requests

An adoption pull request holds one completed Repository Standards adoption or
update run and nothing else. Open it once the project's pinned
`.repo-standards/runtime/node_modules/.bin/repo-standards status` reports the
run ready to commit. Otherwise finish or recover the run with
`repo-standards adopt`, using the pinned runtime once a run has started.

Title it `chore: adopt <source> <version> with CLI <version>`, naming the
source by the repository name in its URL and the versions from the record's
Selection table, such as `chore: adopt repo-canon v0.6.0 with CLI 5.1.0`. An
adoption is not breaking unless the maintainer judges it breaking for the
project.

Its body is the adoption record: the output of `status --summary`, byte for
byte, starting with its `# Repository Standards adoption record` heading. The
record's Operations table lists the standards source's fixes and checks with
their results. Post one check-outcomes comment with the repository's own
validation outcomes, confirmation of the ready-to-commit verdict, and findings
links or unfiled findings under the
[findings rule](#findings). The record stays the body; for a breaking (`!`)
title, add Impact and Migration sections after the record.
Write the check-outcomes comment under the [comment rules](#comments).

For adoption or update findings, use these target repositories:

- For the standards source's guidance, discovery, checks, fixes, installed
  files, or drafter, use the source repository identified by the source URL in
  the adoption record's Selection.
- For the Repository Standards CLI and its `adopt` command, use
  `lutzseverino/repo-standards`.

### Merging

Merge a pull request once every required check passes on its latest head and
every review thread is answered with its fix or a reasoned decline under the
[comment rules](#comments).
The optional repository-owned `.github/pull-request-reviewer.json` configures
its reviewer and wait bounds; the `github-repository-configuration` rules
state its schema. A review request is the pull request's opening when
`request.onOpen` is true, or a later comment whose whole trimmed body equals
`request.comment`; a push is not one.

When `request.onOpen` is false and the pull request has had no review request,
an agent must post the review request comment for its head before it first
waits on the pull request. The request bound cannot stop this first request,
since none has been counted yet.

After that first request, an agent must post the review request comment for a
new head when its push fixes, fully or partly, a review finding these rules do
not let it decline, and the request bound has not been reached.

No other push gets a request: a push that only follows declines, changes only tests,
documentation or wording, or only fixes a failing check gets none.
The optional `bounds.reviewRequests` is a positive integer limiting the total
review requests a pull request gets. Count the opening when `request.onOpen`
is true and every comment whose whole trimmed body equals `request.comment`,
whoever posted it. Once that count reaches the bound, no agent requests another
review. Without the field there is no count bound.

When the configured reviewer does not review the latest head, because it is
unavailable, no review was requested
after the head's push, it did not respond within `bounds.responseMinutes` of
the latest review request, or no review arrived within `bounds.reviewMinutes`
of it, the pull request merges once those conditions hold, and the merging
agent comments on it that the configured reviewer did not review that head
and why, under the [comment rules](#comments). For a head with no request after
its push, the comment says whether the request rule required none or the bound
was reached. Without the file, no reviewer wait or comment about an absent
review is required.
Squash-merge pull requests into their base branch, passing the subject
`<title> (#<number>)` and the current PR body explicitly, with the body passed
byte for byte through a file or stdin. GitHub's default squash message must
never apply, because it can add co-author trailers. Preserve issue references
and breaking-change explanations in the final message.

Fix a review finding about a defect in what the change is responsible for.
Decline a finding that does not hold. A real finding may also be declined when
it is outside the change's ticket or scope; when it guards a rule another layer
owns, such as by duplicating that layer's validation; or when it guards against
the owner misconfiguring files only the owner writes, or a component corrupting
state it owns itself, which lie outside the threat model. Answer a decline with
its reason in its review thread under the [comment rules](#comments). Record real findings declined because they
are outside the change's ticket or scope, or because another layer owns the
rule they guard, under the [findings rule](#findings). Do not file findings
declined because they do not hold or lie outside the threat model.

These findings rules still apply after the request bound is reached: fix every
finding the agent may not decline and push without another request; answer any
review that arrives anyway. The bound creates no decline reason and no grouped
follow-up issue; record findings one issue per finding under the
[findings rule](#findings).

## Credentials

An agent run uses only the credentials it was given. It never looks for, tests,
or uses another identity, whether a token, a CLI login, an environment variable,
a connector, or an app, including one reached through the agent provider's own
login. Searching for one, such as listing credential environment variables or
probing other `gh` configurations, counts as looking. When a push, merge, or API
call is refused for permission, the refusal stands: the agent stops and asks
the owner, as for any answer only the owner can give, and never retries under
another identity.

## Comments

When an agent needs an answer only the owner can give, post the question as one
issue comment under these rules, and stop without a pull request if none is open,
or leaving the open pull request unmerged and linked from the question. Work
without an issue asks on its pull request instead. This owner handoff ends the
agent's babysitting of the pull request. The agent neither closes the pull
request nor waits for the answer.

If the answer changes the implementation contract, edit the contract; that
drops readiness and requires review again.

An agent comments on an issue or pull request to record a decision, an outcome,
or a question that needs an answer, never to narrate progress. Consolidate
everything the agent has to say on one occasion into one comment. In an Agent
Brief comment, the brief's heading comes right after the triage disclaimer, and
triage notes follow the brief.

Every comment an agent writes on an issue or pull request starts with this AI
disclaimer line, `>` included, followed by a blank line:

```markdown
> _This was generated by AI._
```

During triage, use the triage skill's line in the same form instead:

<!-- prettier-ignore -->
```markdown
> *This was generated by AI during triage.*
```

Issue and pull request titles and bodies are exempt: their own format rules govern them.
A review request comment is also exempt and holds only the request.

Comments, issue and pull request titles, and their bodies never contain secret,
token, or credential values. Write `<REDACTED>` in their place.

Write the configured reviewer's request phrase only in a comment that
requests a review. That comment holds exactly `request.comment` from
`.github/pull-request-reviewer.json`, with no disclaimer. The phrase never
appears in prose, quotations, or code spans in any other comment, issue or
pull request title, or body. To mention the request, describe it as "the review
request comment".
