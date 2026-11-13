# Launches

[Lifecycle](../SKILL.md#lifecycle) selects factory coverage or hand work.

## Starting a launch

Keep application mappings outside this skill. Follow `AGENTS.md` for skill invocation.
Name each hand launch and its thread, where supported, `<stage>: <item>` using the canonical stage in lowercase; keep naming metadata outside task context. Verify repository contracts are self-contained
under [Workbench](../SKILL.md#workbench). For heavy reads, use a covering
installed skill or read a bounded tail; without one, pass context only.

Prepare the template and [record the launch](templates.md#nowmd) before starting,
including its linked Item and current-turn report; on resumption choose a fresh
report or clear the previous terminal marker. Immediately before **every** launch
below, read validated Scriptorium status **once**, from that host's installation:

```sh
node <scriptorium>/src/main.ts status <host-configuration> --json > <budget.json>
```

Check version 1; consume capacity, holds/provenance, unavailable observations and
model catalog/defaults/effort/guidance.
Use the installed factory-workflow **Model selection** rule, including for hand
reviews. Set the launch's actual model and effective effort from this read and
record both in the template; honor capacity and holds, inspecting unavailable
facts before launching. Counts cover factory work only: account for your running
launches too; the observation is no reservation or grant. Retain the same JSON
for `wait.mjs --status --from <now.md> --budget <budget.json>`; it adds this
observation without reading a harness. Refresh for each later launch.

### Shared launch template

Every hand launch invokes its Canonical stages hand skill through the supported
mechanism, then uses these fields and fixed duties. A stage with none still runs
with its gap line; file its missing skill once under Findings. Fill context, not
skill procedure or question format; there is no procedure field.

```text
<skill invocation>
Issues: <issue/specification/PR links, or none>
Evidence: <source links and observations, including status JSON>
Recorded decisions: <dates, quoted words and sources, or none>
Scope: <bounded work and deliverables>
Workspace: <owned checkout/branch and destinations; workstation convention if needed>
Plan references: <plan directory, linked row or Close review, and completion mark>
Model: <actual model and its guidance-based reason>
Effective effort: <resolved effort>
Launch report: <current-turn report path>

Before an operation makes relay late, expose prerequisite owner steps in the
report, with the preceding operation's timing/evidence and actual latest start
when one exists; complete the owner-wait report before that opportunity passes.
Write the complete launch report, put open questions in the report, set the
specified completion mark, commit the workbench writes and push when it has a
remote. Hand back through the report only; send no closing message to the
orchestrating thread. End the report with the final line exactly: status: done
```

Seam (deferred): skills declaring their inputs; consumers: 1 (these templates);
extract at a second launcher under the Ownership check. The host owns capacity/guidance/effort; the standard owns stages/templates.

## Owner steps

A chore stays the owner's only when it needs their credential, device, presence, or taste or intent. An independent agent
of another provider checks an agent's work, and the owner gets a one-screen summary and a veto. Without another provider,
the check follows installed factory-workflow Provider diversity's "No policy" row: host default, no catalog scan or wait,
unavailable diversity in the summary. Relay reported chores in one message before the preceding time-sensitive operation
ends: deadline first (actual latest start when supplied), then a card each: what it unblocks, in plain words; why it
needs the owner; about how long; what to look for and each field's meaning in your summary table, never a file without a
guide or the worker's thread; the commands verbatim from the owner's workstation, naming the host by the Workspace
repository convention (if none, use the owner-question route and record a finding); and what happens if skipped. Log
report availability, relay time, deadline and evidence; untimed chores get no invented deadline or timeout. Return owner
output to the same worker with a fresh report. Seam (deferred): workstation commands; consumers: 1; revisit at 2.

## Triage run

Scope names the request and plan-directory result linking brief/findings.
Plan references sets `triaged <file>` on its `plan.md` row.

## Grill

Start from the [intake queue](intake.md#grill-queue), in the owner's session
environment. Evidence includes unresolved questions and
Scope names the decision record in the plan directory. Workspace supplies the
owned branch/checkout and one PR destination per repository for domain edits,
as the contribution guide requires. Plan references sets `grilled <file>` and
records the session reference in the row's State. For `state:grill` issues,
retain the guide's independent acceptance and readiness rules and plan approval
gate; factory implementation of a ready issue skips triage. Continue an owner's
grill or prototype in that same session when taking it over.

## Publication and review

Name contract inputs/destinations in Scope/Workspace. Retain contribution-guide authority and
independent acceptance; a publisher never accepts its own contract.

## Worker

Supply the authoritative issue contract. Workers deliver under
the contribution guide. When installed rules assign merge ownership to you,
read the contract/PR handoff and resume `babysit`, including on takeover;
after a resolved question use the installed continuation rules for that worker
or the same open PR. Live steps need a time-bounded inbox grant: list workers
on its [grant row](templates.md#nowmd), supply grant and bound in Recorded
decisions, and launch only while it lasts. Workers never end it; ask again after
expiry. In factory repositories use the installed `factory` skill's skip route.

## Expedited change

An owner's request for work now approves it and skips only the plan, preserving
repository delivery/review/merge rules. Complete the [decision sequence](templates.md#inboxmd)
first, then add its In flight pause row; inside a plan's goal add an expedited
plan row and list it in the next update. Pause only launches and merges you own,
except this change's; running sessions continue unless the owner stops them.
Pause a serving factory through `factory`'s Pause and resume one repository.
Deliver through [Worker](#worker) or yourself. At merge, resume the factory via
that section and held launches/merges, add the PR outcome to its Answered entry,
and end the rows.

## Retro

Use a separate Close session. Evidence
supplies primary plan files, cited issues/PRs/comments/run records and the latest
Closed plan's `retro.md`, never your summary/context.
Scope names `retro.md`: outcome against Done means; time, with waits by owner/review/check/blocker/launch;
cost-ranked lessons and [routes/links](close.md#route-each-lesson); comparison with the previous retro
and open issues; filed/reopened issues in `log.md` with creation evidence; counts of owner answers matching
recommendations by decision type, proposing preapproval of a type the owner always accepted.
Count the friction log's gap lines and file the top recurring gap in Scriptorium;
exclude intake of ideas. Plan references marks the Close review `done <file>`.
Session retros outside plan closure use the same lesson and gap routes.

## Architecture review

Scope names repository/changes, Evidence names
sources, Plan references marks the review `done <file>`. Route its report through
[intake](intake.md#filed-requests-and-reports).

## Handover

Handover starts a successor orchestrating session, outside the stage pipeline.
One session owns all plans. At plan close or compaction since takeover, update
records, move Answered entries intact to `inbox-archive.md`, log the former owner
reference, and commit/push. Start a fresh
session with `/orchestrate` and the shared template where supported; otherwise
tell the owner it is ready. Then stop: `index.md` and `now.md` are the handover.
The successor reads them, `inbox.md` and active plans, records itself as the sole
current owner, arms [continuous coverage](../SKILL.md#the-wait-step), keeps any
expedited pause, and [reconciles the inbox](templates.md#inboxmd) before acting.

## Progress observation

Cover unresolved work continuously from filing, including before approval/PR:
factory tickets, direct workers, blockers and launch reports. On wake/timeout,
minimally reconcile and update expected facts, then immediately re-arm before
foreground work or updates; keep harness-only event coverage. The unsupported
fallback is [the wait step](../SKILL.md#the-wait-step); recurring checks are optional.
Read state/labels, comments, owner answers, blockers, run progress and PRs against
a bounded dated log tail. In-flight Waiting on names who causes the event;
use `orchestrator` when it is you. Surface answered questions lacking continuation with
current issue/run/PR evidence, including absent evidence. Installed recovery
rules govern intervention; observation authorizes no execution or stall timeout.

### The wait script

With background-command wake support, run one wait continuously from records:

```sh
node <skill>/wait.mjs --interval <seconds> --max-duration <seconds> --from <workbench>/now.md
node <skill>/wait.mjs --status --from <workbench>/now.md [--budget <budget.json>]
```

Records reload each poll, changing watches without process/deadline restart.
Unchanged observations persist; changed expectations compare anew. Keep harness
events armed for what the script cannot observe.
Explicit items use `org/repo#7`, its issue/PR URL, `file:<path>`, `dir:<path>` or
`launch:<report>`; paths are invocation-relative. Quote JSON as one shell argument:

```sh
node <skill>/wait.mjs --interval 10 --max-duration 300 '{"item":"org/repo#7","expected":{"labels":["state:ready"]}}' dir:incoming
```

Expected labels compare as sets before the first pause. PR `head` is the full
observed SHA; `checks` requires that head and holds
`{"runs":[{"id":1,"name":"Test","status":"in_progress","conclusion":null}],"statuses":[{"id":2,"context":"deploy","state":"pending"}]}`.
Record all check runs (`filter=all`) and current statuses with IDs/raw values.
Order is irrelevant; additions/removals/value changes wake without success interpretation. Missing expected fields use first-read baselines. Later state,
labels, comments, linked PRs, head/checks stay observable; identical watches
deduplicate and conflicting expectations fail.
`launch:<report>` fires only on the exact final `status: done` line (LF, CRLF or no
terminal newline), even already complete; progress/creation/removal stay quiet.
It prints `finished: read <report>`; reconcile even reports ending on owner steps.
File/launch readers see this checkout only; unpulled reports need tracker/harness
events. Raw files wake on any change; directories cover direct files and fetch
unpulled upstream commits, even previously fetched ones. No upstream means disk
only; fetch failures remain errors.
Require positive finite caller-chosen `--interval` and `--max-duration`, no defaults.
Use Node.js 24/26 and current GitHub CLI credentials for trackers. Silent polling
exits `0` on change/completion/maximum duration: minimally reconcile and re-arm
immediately. Exit `1`: fix usage/read/platform errors and re-arm; refusals follow Credentials.
