# Launches

[Lifecycle](../SKILL.md#lifecycle) decides when launches start. This reference
covers their context, reports, handover and observation.

## Starting a launch

Use available capabilities; keep application-specific mappings outside this skill.
Follow `AGENTS.md` for skills and naming, separate from command/task context.
Supply decisions with dates and quoted words, scope, checkout, plan and designated
current-turn report. Repository deliverables copy relied-on decisions without
requiring private workbench records, as [Workbench](../SKILL.md#workbench) says;
verify each worker's contract is self-contained before launch.

Record each launch as [templates](templates.md#nowmd) says **before** starting it,
including report path and linked Item; on resumption use a fresh report or clear
the previous final marker first. Every template below carries the shared
[Report-back](../SKILL.md#report-back) duty: complete the designated report with
final line `status: done`, including owner-step turns, and preserve its other
row-marking, owner-question and commit/push obligations.

Run at most three launches you started at once, or the host cap in `index.md`.
Count every Running-launch row on this host. For heavy reads, delegate through
any covering installed skill or read a bounded tail; otherwise pass task context.

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

When intent needs the owner, open a grill. For an issue in `state:grill`, add
one [inbox entry](templates.md#inboxmd) linking its action comment, with your
recommendation. Launch the grill in the owner's session environment within the
cap, linking it from that entry. Reuse both across observations/takeover; if the
cap holds it, keep it pending in `now.md`.

Record the session's reference in the row's State. Launch it with
`/grill-with-docs #N` for the issue, followed by
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

For an issue routed from `state:grill`, have the owner in the grill supply the
brief's readiness under the repository's readiness rules. The factory then
implements the ready issue, skipping triage. Keep the plan-approval readiness
gate in [Lifecycle](../SKILL.md#lifecycle).

To take over an owner's grill or prototype, continue in that session.

## Worker

Launch a ticket worker with `/implement`, followed by its issue, scope,
repository checkout and designated report-back destination. Write the complete
turn report with final line `status: done`, including owner-step stops. Workers deliver as the
contribution guide's Pull requests section says.
When applicable installed rules assign a worker's merge to you, read its
authoritative implementation contract and PR handoff, then resume `babysit`,
including when resuming a plan. After an owner question is resolved, follow
the applicable installed continuation rules to resume the worker or that same
open PR.

For live steps, request time-bounded host access in `inbox.md`. List workers on
its [grant row](templates.md#nowmd) before launch; supply the grant and bound.
Workers never end it. Launch only while it lasts, asking again after expiry.
In a factory repository use the installed `factory` skill's skip route.

## Expedited change

An owner's request for work now approves it and skips only the plan (no proposal
or new file). Repository delivery, review and merge rules still apply.

1. **Record.** Before acting, complete the decision
   [sequence](templates.md#inboxmd) for the request.
2. **Track.** Add its `now.md` In flight row, which states the pause below.
   When the change falls inside an open plan's goal, also add an expedited row
   to that plan and list it in the next plan update.
3. **Pause.** Pause only what you own: start no launch and make no merge other
   than the change's own; hold the rest. Running sessions keep running unless
   the owner says to stop one. In a repository a factory serves, also pause
   the factory with the `factory` skill installed there, as its Pause and
   resume one repository section says.
4. **Deliver.** Launch the change's worker within the launch cap, as
   [Worker](#worker) says, or implement it yourself.
5. **End.** The pause ends when the change merges. Resume the factory through
   that same `factory` section, then the launches and merges you held. Append
   the outcome, with its pull request link, to the change's `Answered` entry,
   and end its rows.

## Retro

Start a separate session reading primary sources: plan files and cited issues,
PRs, comments and run records, never your context or its summary. Invoke any
covering skill under `AGENTS.md`. Supply the plan directory, checkouts, previous
`retro.md` (the latest Closed plan in `index.md`) and designated report, requiring:

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

Invoke `/improve-codebase-architecture` with checkout, changes, plan directory
and designated report. Supply an owned checkout/branch and repository PR
destination for domain edits, as for a grill. It asks owner questions in its own
session. Its duties:

- route each of its findings as [Run](../SKILL.md#lifecycle) says: a Finding
  becomes an issue in that repository, and any other idea a wish naming it;
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

A fresh session reads `index.md`, `now.md`, `inbox.md` and active `plan.md`
files before acting, records itself as owner and marks prior references superseded.
Immediately arm continuous coverage from `now.md`, including launches and incoming,
as [the wait step](../SKILL.md#the-wait-step) says; keep any expedited pause.
Then [reconcile the inbox](templates.md#inboxmd) before resuming plan work.

## Progress observation

Continuously cover unresolved filed work from filing, before approval or a PR:
factory tickets, direct workers, blockers and every launch report. Update records
as they change; the running wait reloads them. On wake/timeout, take only the
observations needed to reconcile and record expected facts, then immediately
re-arm before foreground processing or a substantive owner update. Harness-only
events retain their recorded event coverage. The unsupported-harness fallback is
[the wait step](../SKILL.md#the-wait-step)'s; recurring checks remain optional.

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

With background-command wake support, run one wait continuously from records:

```sh
node <skill>/wait.mjs --interval <seconds> --max-duration <seconds> --from <workbench>/now.md
node <skill>/wait.mjs --status --from <workbench>/now.md
```

Records reload on each poll, adding/removing watches without replacing the process
or restarting its deadline. Unchanged watches keep observations; new expectations
compare anew. Keep harness events armed for events unavailable to the script.

Explicit callers may instead supply `<item>...`: `org/repo#7`, its GitHub issue/PR
URL, `file:<path>`, `dir:<path>` or `launch:<report>`. Paths are invocation-relative.
A JSON item supplies expected observations; quote it as one shell argument:

```sh
node <skill>/wait.mjs --interval 10 --max-duration 300 '{"item":"org/repo#7","expected":{"labels":["state:ready"]}}' dir:incoming
```

Expected labels compare as sets before the first pause. For a PR, optional `head`
is the full observed SHA; `checks` requires that same observed head and contains
`{"runs":[{"id":1,"name":"Test","status":"in_progress","conclusion":null}],"statuses":[{"id":2,"context":"deploy","state":"pending"}]}`.
Record all observed check runs (`filter=all`) and current commit statuses for that
head, including their IDs and raw values. Order is irrelevant; additions, removals
and value changes wake without interpreting success. Missing expected fields use
first-read baselines. Later state, labels, comments, linked PRs, head and checks
remain observable. Identical watches deduplicate; conflicting expectations fail.

`launch:<report>` fires only when the final line is exactly `status: done` (LF,
CRLF or no terminal newline), including already-complete reports. Progress,
creation and removal alone stay quiet. It prints `finished: read <report>`:
reconcile the report even if it ends on owner steps. File/launch readers see only
this checkout; for another clone's unpulled report, use tracker/harness events.
Raw file watches still wake on any creation/edit/removal. Directory watches cover
direct files and fetch upstream commits not yet pulled, including ones fetched
before arming; no upstream means disk-only. Fetch failures remain errors.

Waits require positive finite caller-chosen `--interval` and `--max-duration`,
with no defaults. They need Node.js 24/26 and the current GitHub CLI credential
for trackers, remain silent while polling, and return:

- `0`: change, completed launch or maximum duration diagnostic. Minimally
  reconcile/update records and immediately re-arm before other work.
- `1`: fix usage/read/platform errors and re-arm; permission refusals follow
  the contribution guide's Credentials section.
