---
name: orchestrate
description: Turn the owner's feature or problem into an approved plan across tickets, keep its state in the workbench, and run it to an announced close.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Orchestrate

Follow each repository's `CONTRIBUTING.md` for triage, readiness, questions, findings
and delivery, and installed comment rules for posts. `triage` handles one request;
`factory` delivers factory tickets and held, stopped or skipped work.

Read [templates](references/templates.md) before you write a workbench file,
[launches](references/launches.md) before you launch, take over, hand over,
observe or arm a wait, and [close](references/close.md) before you close a plan.
Apply `codebase-design`'s [Ownership check](../codebase-design/SKILL.md#ownership-check) to your inbox recommendations, plan updates and friction.

## Workbench

The workbench is a private Markdown git repository outside projects. Use the path in your global instructions,
or create one before proposing a plan. Commit straight to its default branch; push if it has a private remote.
Repository issues, briefs, comments and decision records must be self-contained: copy every relied-on decision,
with its date and quoted words, even when duplicated. Never reference or require the private workbench from a
repository: no URL, host path or instruction to consult it as input or provenance. Repository records may cite
each other; private planning retains its own sources. Its files:

- `index.md`: repositories, plans, the current owning session.
- `inbox.md`: decisions; [reconcile and process answers](references/templates.md#inboxmd) before other work.
- `wishes.md`: ideas outside the goal; `now.md`: current state, rewritten each pass.
- `incoming/`: [other sessions' messages](references/templates.md#incoming).
- `<plan>/`: current `plan.md`, append-only `log.md`, decision and run records.

## Lifecycle

Use the **Canonical stages** in the repository's installed `factory-workflow`
rules (source: `rules/factory-workflow.md`). Read coverage with `.factory/config.json`.
For each covered stage hand off through `factory` and wait; otherwise perform it
by hand to the same contract with the factory's own scripts. Log one
`Gap | <stage> | <repository> | <why>` line in the friction log, `log.md`.
Intake of ideas is permanent orchestrating work, exempt from gap logging and
retro counts; [intake](references/intake.md) owns its method.

A **plan update** includes proposals and heartbeat replies. Open with
`wait.mjs --status --from <now.md>`, adding `--budget <status.json>` for the
Scriptorium observation from [launches](references/launches.md#starting-a-launch).
Keep `Item | Running | Waiting on owner | Since (UTC) | Next check`; read only
records/budget, never harness thread lists or a second view. In this update, act
on each `your move` row or turn it into a real wait: launch, factory, owner,
named third party or date. Show arrivals as [templates](references/templates.md#nowmd) says,
the inbox and unseen inferred-intent items with citations; log those items.
Link every row/decision code and issue number to its row, record or issue;
expand unfamiliar codes once per owner-facing message. Deferred checker: implement over
`now.md`, `inbox.md` and `plan.md` only at the first recorded post-release bare-code slip.

Present goal, Done means, specifications, tickets and Close reviews for approval;
[record proposal and approval](references/templates.md#planmd-and-logmd) before execution.
Research, filing and contract preparation may precede it; execution readiness
waits for approval, which replaces no independent review or readiness condition. An owner's
request for work now skips only the plan: [Expedited change](references/launches.md#expedited-change).

Read [intake](references/intake.md) when an owner's idea, a `state:grill` issue,
or a retro or architecture-review report arrives. After a grill, retain the
contribution guide's writer publication, final split and independent acceptance
responsibilities; use `to-spec` and `to-tickets` through the launch template.

Log friction with evidence, **Value owner**, exposed seam and route (row, finding or wish).
Keep deferrals at their code. Route Findings under the guide even outside the goal
without waiting for resolution. A **new requirement** mid-plan, unless wanted now, takes:

- **Row:** serves the goal and passes the guide's inference test; add and log a
  row, and list it in the next update.
- **Amendment:** changes goal or scope; grill it, possibly one round in the
  orchestrating thread. Apply only after owner approval, with a new approval
  line superseding the old, and publication under the contribution guide.
- **Wish:** outside the goal and not a Finding; add to `wishes.md`, needing no issue.

When all rows end, [close](references/close.md): reconcile issues, run Close reviews and announce the close.

## The wait step

Keep one background wait continuously armed during foreground work and between turns,
covering every In-flight wake mechanism, launch report and incoming message. Owner-only
rows use recorded owner waits and incoming responses; with no work, wait on incoming.
Use harness events for what the script cannot observe. On wake/timeout, minimally
reconcile expected facts and records, then immediately re-arm before other work or
updates. Rewrite records to change watches. Without background waits or events,
report the limit and reread records each turn.

## Report-back

Launches hand back only through their current-turn report, final line `status: done`:
“this turn ended; read the report”, including owner waits, never success. Follow
[launches](references/launches.md) for prerequisites/relay and [consume reports](references/templates.md#nowmd).
Other sessions write to `incoming/`.

## Reads

Paths are relative to each repository or the workbench.

- `CONTRIBUTING.md` and `.repo-standards/rules/comments.md`: the sections and
  comment rules named above. When either is missing, carry out this method as
  written, and put each rule it leaves to it in `inbox.md` for the owner.
- `AGENTS.md`: delegation, naming and workstation convention. If missing, pass
  context only and name sessions for operation/target where naming is supported.
- The `codebase-design` skill: Ownership check. If missing, file the gap under Findings; retain the fields above.
- The workbench, whose format this skill owns: its `index.md`, `inbox.md`,
  `wishes.md`, `now.md`, `inbox-archive.md`, `incoming/`, `<plan>/plan.md`, `<plan>/log.md` and `retro.md`.
  Create missing files as [templates](references/templates.md) says.
- A tracked repository's Repository Standards adoption record: the Repo Canon
  source its Selection names, for the `workbench` profile offer and lessons
  about a Repo Canon skill or rule. When it is missing, use the example source.
- `.repo-standards/rules/factory-workflow.md` and `.factory/config.json`: stages,
  coverage and Model selection. When configuration is missing, do uncovered work by hand;
  when rules are missing, consult source `rules/factory-workflow.md` for the stages.
- Scriptorium status JSON: budget/model observations. When absent or unavailable,
  report missing facts and establish them before launching.
- The `babysit` skill: the wait's GitHub CLI connection and merge continuation.
  When missing, re-read records each turn as [the wait step](#the-wait-step) says.
