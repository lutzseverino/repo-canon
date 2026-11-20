# Launches

[Lifecycle](../SKILL.md#lifecycle) selects factory coverage or hand work.

## Starting a launch

Keep application mappings outside this skill. Follow `AGENTS.md` for skill invocation.
Name each hand launch and its thread, where supported, `<stage>: <item>` using the canonical stage in lowercase; keep naming metadata outside task context. Verify repository contracts are self-contained
under [Workbench](../SKILL.md#workbench). For heavy reads, use a covering
installed skill or read a bounded tail; without one, pass context only.

Write the brief into its plan directory before starting; its `Launch report:` line names the current-turn
report, and the pair is the launch's wait. On resumption choose a fresh report or clear the previous terminal marker.
Immediately before **every** launch below, read validated Scriptorium status **once**, from that host's
installation:

```sh
node <scriptorium>/src/main.ts status <host-configuration> --json > <budget.json>
```

Check version 1; consume capacity, holds/provenance, unavailable observations and model
catalog/defaults/effort/guidance. Use the installed factory-workflow **Model selection** rule, including
for hand reviews. Set the launch's actual model and effective effort from this read and record both in the
template; honor capacity and holds, inspecting unavailable facts before launching. Counts cover factory
work only: account for your running launches too; the observation is no reservation or grant. Refresh for
each later launch.

### Shared launch template

Every hand launch invokes its Canonical stages hand skill through the supported
mechanism, then uses these fields and fixed duties. A stage with none still runs
with its gap line; note its missing skill once under Findings. Fill context, not
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

Seam (deferred): skills declaring their inputs; consumers: 1 (these templates); extract at a second launcher. The host owns capacity/guidance/effort; the standard owns stages/templates.

## Owner steps

A chore stays the owner's only when it needs their credential, device, presence, or taste or intent. An independent agent of
another provider checks an agent's work, and the owner gets a one-screen summary and a veto. Without another provider, the
check, still by an independent agent, uses the host default, with no catalog scan or wait and unavailable diversity in the
summary. Relay reported chores in one message before the preceding
time-sensitive operation ends: deadline first (actual latest start when supplied), then a card each: what it unblocks, in
plain words; why it needs the owner; about how long; what to look for and each field's meaning in your summary table, never
a file without a guide or the worker's thread; the commands verbatim from the owner's workstation, naming the host by the
Workspace repository convention (if none, use the owner-question route and record a finding); and what happens if skipped.
Log report availability, relay time, deadline and evidence; untimed chores get no invented deadline or timeout. Return owner
output to the same worker with a fresh report. Seam (deferred): workstation commands; consumers: 1; revisit at 2.

## Triage run

Scope names the request and plan-directory result linking brief/findings.
Plan references sets `triaged <file>` on its `plan.md` row.

## Grill

Start from the [intake queue](intake.md#grill-queue), in the owner's session environment. Evidence
includes unresolved questions and Scope names the decision record in the plan directory. Workspace
supplies the owned branch/checkout and one PR destination per repository for domain edits, as the
contribution guide requires. Plan references sets `grilled <file>` and records the session reference in
the row's State. For `state:grill` issues, retain the guide's independent acceptance and readiness rules
and plan approval gate; factory implementation of a ready issue skips triage. Continue an owner's grill or
prototype in that same session when taking it over.

## Publication and review

Name contract inputs/destinations in Scope/Workspace. Retain contribution-guide authority and independent
acceptance; a publisher never accepts its own contract.

## Worker

Supply the authoritative issue contract. Workers deliver under the contribution guide. When installed
rules assign merge ownership to you, read the contract/PR handoff and resume `babysit`, including on
takeover; after a resolved question use the installed continuation rules for that worker or the same
open PR. Live steps need a time-bounded inbox grant: list its workers and bound in the plan's Current
state, supply grant and bound in Recorded decisions, and launch only while it lasts. Workers never end it;
remove each reporting worker, and at the last report or bound end it, log it and tell the maintainer. Ask
again after expiry. In factory repositories use the installed `factory` skill's skip route.

### Replacing a worker

Before transferring the same PR's write responsibility, identify the predecessor and establish whether it can
still write. Stop/cancel an active or write-capable predecessor through the available harness and verify
retirement first; verified finished runs need no cancellation. A provider error, including a rate limit, is no
retirement evidence. If identity, stop capability or retirement cannot be established, withhold responsibility
and use the existing owner-question route, naming the missing evidence. Stop only the predecessor for this
work. Preserve the PR, all branch work, review and handoff context; retain the predecessor reference and
retirement evidence or uncertainty in existing launch and handoff records. Delivery and owner-review gates
still apply. The host owns run mapping and stop semantics; use its instructions. Seam (deferred): harness run
control; consumers: 1 (worker replacement); reuse host capabilities, no new adapter.

## Expedited change

An owner's request for work now approves it and skips only the plan, preserving
repository delivery/review/merge rules. Complete the [decision sequence](templates.md#inboxmd)
first, its Answered entry stating the pause; inside a plan's goal add an expedited
plan row and list it in the next update. Pause only launches and merges you own,
except this change's; running sessions continue unless the owner stops them.
Pause a serving factory through `factory`'s Pause and resume one repository.
Deliver through [Worker](#worker) or yourself. At merge, resume the factory via
that section and held launches/merges, add the PR outcome to its Answered entry,
ending the pause, and end the row.

## Retro

Start a separate owner-facing session with `retro`. Prepare its launch report
header with inputs, evidence links and scope, using the shared launch template;
pass only that report path to the skill. For plan closure use `<plan>/retro.md`
as the report. After consuming it, mark the Close review `done <file>`.

## Architecture review

Scope names repository/changes, Evidence names sources, Plan references marks the review `done <file>`.
Route its report through [intake](intake.md#filed-requests-and-reports).

## Handover

Handover starts a successor orchestrating session, outside the stage pipeline. One session owns all
plans. At plan close or compaction since takeover, update records, move Answered entries intact to
`inbox-archive.md`, log the former owner reference, and commit/push. Start a fresh session with
`/orchestrate` and the shared template where supported; otherwise tell the owner it is ready.
Then stop: the records are the handover. The successor reads `index.md`, `inbox.md` and active
plans, sets `Orchestrator:` to itself, arms [continuous coverage](../SKILL.md#the-wait-step),
keeps any expedited pause, and [reconciles the inbox](templates.md#inboxmd) before acting.

## The workbench script

With Node.js 24 or 26 and current GitHub CLI credentials, run from records only:

```sh
node <skill>/workbench.mjs status <workbench> --stale-after <seconds>
node <skill>/workbench.mjs wait <workbench> --interval <seconds> --max-duration <seconds>
```

Durations are caller-chosen, with no defaults. Status prints the orchestrator, each
active plan's Done means (●/○) and every watched item by who moves next, with its link
and plan/row; Stale lists quiet items unchanged on the tracker past `--stale-after`.
A failed read prints `unavailable: <item> (<reason>)`, never "nothing changed". The
[records](templates.md) are the watches, from the moment a row names an issue: link a
row's blockers on it. Wait wakes on file events for local records, launch reports and
`incoming/`, and polls GitHub items and the workbench upstream on the interval. Both save
what they saw in the workbench's Git directory, so a change after the last status or wait
wakes the next wait at once. Exit `0` (change, finished report or maximum duration):
minimally reconcile and re-arm. Exit `1`: fix the usage, record or platform error and
re-arm; refusals follow Credentials. Surface answered questions lacking continuation with
current issue/run/PR evidence, including absent evidence. Installed recovery rules govern
intervention; observation authorizes no execution or stall timeout.
