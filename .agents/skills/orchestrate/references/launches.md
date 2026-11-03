# Launches

Each agent launch you start, with the task context and obligations it
carries; the handover to the next orchestrating session; and how you observe
launches and filed work, including the wait script that wakes you.
[Lifecycle](../SKILL.md#lifecycle) says when each launch starts.

## Starting a launch

Follow `AGENTS.md`'s Agent skills requirements for delegation and session naming.
Use the available naming capability separately from the command and task context.
Use the session's supported invocation for the commands below, followed by their
task context. Illustrative names include `triage repo-canon#726`,
`grill plan 07` and `orchestrate: plans 07–10`; case and punctuation are flexible.

Run at most three agent launches you started at once, or the cap `index.md`
names for this host's hostname. To check the cap, count the rows under
`now.md`'s Running launches for this host: every grill, triage run, research
run, worker and Close review has one.

Give heavy reads, such as whole session transcripts, long logs and large
diffs, to a subagent that returns what the step needs, or read a bounded
tail. Select any covering installed skill under `AGENTS.md`'s delegation
requirements; an uncovered read needs only its task context.

## Triage run

Open each triage run with `/triage`, followed by the issue, evidence, recorded
decisions, scope, repository checkout, plan directory and report-back
destination. Its task context includes these workbench delivery obligations:

- write its result to the plan directory, citing the brief or findings it
  posted by link;
- add each decision it leaves open for the owner to `inbox.md`;
- mark its row `triaged <file>` in `plan.md`;
- commit and push its writes, as [Workbench](../SKILL.md#workbench) says;
- report back, as [Report-back](../SKILL.md#report-back) says.

## Grill

Open a grill with the owner in its own session, and record the session's
reference in the row's State. Launch it with `/grill-with-docs`, followed by
the issue links, evidence, recorded decisions, unresolved questions, scope,
plan directory and report-back destination. Supply the owned branch and
checkout for domain-document edits and one pull request destination per
affected repository, as the contribution guide's Triage section requires. Its
task context also includes these workbench obligations:

- write the owner's decisions and the draft briefs to the plan directory;
- add each decision it leaves open for the owner to `inbox.md`;
- mark its row `grilled <file>` in `plan.md`;
- commit and push its writes, as [Workbench](../SKILL.md#workbench) says;
- report back, as [Report-back](../SKILL.md#report-back) says.

To take over an owner's grill or prototype, continue in that session.

## Worker

Launch a ticket worker with `/implement`, followed by its issue, scope,
repository checkout and report-back destination. Workers deliver as the
contribution guide's Pull requests section says.
When applicable installed rules assign a worker's merge to you, read its
authoritative implementation contract and PR handoff, then resume `babysit`,
including when resuming a plan. After an owner question is resolved, follow
the applicable installed continuation rules to resume the worker or that same
open PR.

## Retro

Start a separate session that reads primary sources, such as the plan
directory and the issues, pull requests, comments and run records it cites,
and never your session's context or a summary of it. Select any covering
installed skill under `AGENTS.md`'s delegation requirements. Its task context
is the plan directory, the repository checkouts, the previous plan's
`retro.md`, from the plan most recently moved under `Closed` in `index.md`,
and the report-back destination, with these obligations:

- write `retro.md` in the plan directory, with the outcome against the plan's
  Done means, with evidence; where the time went, attributing each wait to
  what it waited on, such as the owner, a review, a check, a blocker or a
  launch; and its lessons, ranked by cost;
- compare each lesson with the previous plan's retro and the open issues
  before filing it;
- route each lesson as [Close](close.md#route-each-lesson) says, recording its
  route and link in `retro.md`, and record each issue it files or reopens in
  `log.md` with its creation evidence;
- mark the retro done on the Close reviews line in `plan.md`;
- commit and push its writes, as [Workbench](../SKILL.md#workbench) says;
- report back, as [Report-back](../SKILL.md#report-back) says.

## Architecture review

Open each `improve-codebase-architecture` review with
`/improve-codebase-architecture`, followed by its repository checkout, the
plan's changes there, the plan directory and report-back destination. Supply
the owned branch and checkout for domain-document edits and that repository's
pull request destination, as for a grill. Like a grill, it asks the owner its
questions in its own session. Its task context also includes these
obligations:

- route each of its findings as [New requirements](../SKILL.md#lifecycle)
  says: a Finding becomes an issue in that repository, and any other idea a
  wish naming it;
- write its result to the plan directory, citing those issues and wishes by
  link;
- mark its review done on the Close reviews line in `plan.md`;
- commit and push its writes, as [Workbench](../SKILL.md#workbench) says;
- report back, as [Report-back](../SKILL.md#report-back) says.

## Handover

One orchestrating session at a time owns every plan in the workbench. It
hands over at each plan's close, and whenever it has compacted since it took
over. To hand over, bring `index.md` and `now.md` up to date, commit and push
the workbench, start a fresh session with `/orchestrate` and the workbench
path where your harness can, and otherwise tell the owner the handover is
ready. Then stop: `index.md` and `now.md` are the handover.

A fresh session reads `index.md`, `now.md`, `inbox.md` and each active
`plan.md`, and nothing else, not even a plan's `log.md`, before it acts. It
then records its own session reference as each active plan's owner in
`index.md`, marking the previous reference superseded, and takes over.
Before anything else, it re-arms a wake-up for every row under `now.md`'s In
flight that does not wait on the owner, as the
[wait step](../SKILL.md#the-wait-step) says.

## Progress observation

Observe unresolved filed work associated with the plan from filing, before
plan approval and before a PR exists: factory tickets, directly launched
workers and recorded blockers, plus the report-back of every running launch.
Keep that coverage when taking over or resuming a plan; refresh it as issues,
blockers and launches are recorded. You wake on events, through the
[wait step](../SKILL.md#the-wait-step). A recurring check is optional: use the
harness's recurring mechanism alongside the wait step only if you choose to.
Where the harness can neither wait in the background nor deliver events,
report that limit and re-read these records at each turn.

Read issue state and labels, latest comments and owner answers, blocker state,
run progress and any PR. Compare with the previous dated observation in a
bounded tail of the plan's `log.md`. Record approval and blocker waits
separately from unexplained lack of progress, and keep each wait as a row under
`now.md`'s In flight. When an answered owner question has no observable
continuation, surface it with current state and issue/run/PR evidence links,
recording absent run or PR evidence explicitly. Route any intervention through
the contribution guide and applicable installed recovery rules. Observation
authorizes no execution and adds no stall timeout or recovery procedure.

### The wait script

Where the harness can run a command in the background and wake you when it
exits, arm each wake-up the [wait step](../SKILL.md#the-wait-step) needs with
this skill's wait script, in the background:

```sh
node <this skill's directory>/wait.mjs --interval <seconds> --max-duration <seconds> <item>...
```

- An item is an issue or pull request, as `<owner>/<name>#<number>` or its
  `https://github.com` link, or a file, as `file:<path>`. For a launch, watch
  its report-back file in the plan directory and the plan's `plan.md`, where it
  sets its done mark. A file item reads the workbench checkout the wait runs
  in, so a launch writing in another clone wakes it only once its push is
  pulled here; arm such a launch's wake-up on its tracker items or the
  harness's own events instead.
- It exits when any item changes: an issue's or pull request's state, labels,
  or new comments, an issue's linked pull requests, or a file's creation, edit
  or removal. It measures changes from when it starts, so arm it after your
  own writes to watched files and before you read the items' current state.
- `--interval` is the time between polls and `--max-duration` the longest the
  wait runs. Both are required; choose both for each invocation.
- It needs Node.js 24 or 26, and the GitHub CLI's current credential for
  issues and pull requests. It prints nothing while it waits.

Its exit code says what comes next:

- `0`: an item changed; each line names the item and how. Observe as
  [Progress observation](#progress-observation) says, then arm the wait again.
- `2`: the maximum duration passed with no change; arm the wait again.
- `1`: follow the contribution guide's Credentials section for a permission
  refusal; otherwise fix the invocation or platform error and arm it again.
