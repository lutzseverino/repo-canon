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

## Workbench

The workbench is a private Markdown git repository outside projects. Use the path in your global instructions,
or create one before proposing a plan. Commit straight to its default branch; push if it has a private remote.
Repository issues, briefs, comments and decision records must be self-contained: copy a relied-on decision
that exists only in private planning once, with its date and quoted words; cite a decision already recorded in
a repository by link. Never reference or require the private workbench from a repository: no URL, host path or
instruction to consult it as input or provenance. Repository records may cite each other; private planning
retains its own sources. Its files:

- `index.md`: repositories, active plans, the `Orchestrator:` field.
- `inbox.md`: decisions and owner chores; [reconcile and process answers](references/templates.md#inboxmd) before other work.
- `wishes.md`: ideas about this procedure, not repository ideas (guide's Findings rule).
- `incoming/`: [other sessions' messages](references/templates.md#incoming).
- `<plan>/`: current `plan.md`, append-only `log.md`, decision records, launch briefs and reports.

## Lifecycle

Use the **Canonical stages** in the repository's installed `factory-workflow`
rules (source: `rules/factory-workflow.md`). Read coverage with `.scriptorium/config.json`. <!-- Seam (deferred): Scriptorium configuration reads; consumers: 6; extraction proposed in https://github.com/lutzseverino/repo-canon/issues/967. -->
For each covered stage hand off through `factory` and wait; otherwise perform it
by hand to the same contract with the factory's own scripts. When launching it,
log `Gap | <stage> | <repository> | <why>` in `log.md`.
Intake of ideas is permanent orchestrating work, exempt from gap logging;
[intake](references/intake.md) owns its method.

A **plan update** includes proposals and heartbeat replies. Open with
[`workbench status`](references/launches.md#the-workbench-script), never harness thread
lists or a second view. Act on each My move line or turn it into a real wait: launch,
factory, owner, named third party or date. Show Owner's move and every choice made
alone since the last update, with dated sources for veto; log each.
Route every observed unresolved grill request to its grill session; the inbox holds operational owner decisions and chores.
Link every row/decision code and issue number to its row, record or issue;
expand unfamiliar codes once per owner-facing message.

While two plans are being closed, propose no new plan or amendment and start no grill unless it is on their
Done path or the owner asks for it now. Present goal, Done means, specifications, tickets and Close reviews for
approval; [record proposal and approval](references/templates.md#planmd-and-logmd) before execution.
Research, filing and contract preparation may precede it; execution readiness
waits for approval, which replaces no independent review or readiness condition. An owner's
request for work now skips only the plan: [Expedited change](references/launches.md#expedited-change).

Read [intake](references/intake.md) for ideas, `state:grill` issues, retro/architecture
reports, or questions from launch reports, issues or incoming messages. After a grill, retain the
contribution guide's writer publication, final split and independent acceptance
responsibilities; launch `to-spec` and `to-tickets` with `workbench brief`.

Log friction with evidence and route (row, finding or wish). Fix the instance; add a standing rule only when the same failure
recurs after the fix, and name the rule it replaces or deletes. A **new requirement** mid-plan, unless wanted now, takes:

- **Row:** serves the goal, passes the guide's inference test, and edits or
  deletes existing text or code; a row that adds a mechanism (script, port,
  record kind, label or ticket family) needs a grill. Add and log it, and list
  it in the next update.
- **Amendment:** changes goal or scope; route it to its grill session, even
  for a short one-round grill. Apply only after owner approval, with a new approval
  line superseding the old, and publication under the contribution guide.
- **Idea:** outside the goal and not a Finding; follow the guide's Findings rule for parking ideas.

When every Done-means clause has evidence, [close](references/close.md): reconcile issues, run Close reviews and announce the close.

## The wait step

Keep one background [`workbench wait`](references/launches.md#the-workbench-script)
continuously armed during foreground work and between turns; records are its watches.
Use harness events for what the script cannot observe. On wake/timeout, minimally
reconcile, then immediately re-arm before other work or updates. Without background
waits or events, report the limit and run status each turn.

## Report-back

Launches hand back only through their current-turn report, final line `status: done`:
“this turn ended; read the report”, including owner waits, never success. Follow
[launches](references/launches.md) for prerequisites/relay and [consume reports](references/templates.md#planmd-and-logmd).
Other sessions write to `incoming/`.

## Reads

Paths are relative to each repository or the workbench.

- `CONTRIBUTING.md` and `.repo-standards/rules/comments.md`: the sections and
  comment rules named above. When either is missing, carry out this method as
  written, and route unresolved questions through [intake](references/intake.md#questions).
- `AGENTS.md`: delegation, naming and workstation convention. If missing, pass
  context only and name sessions for operation/target where naming is supported.
- The workbench, whose format this skill owns: its `index.md`, `inbox.md`,
  `wishes.md`, `inbox-archive.md`, `incoming/`, `<plan>/plan.md`, `<plan>/log.md`,
  launch briefs and reports (`<plan>/*.md`), and the script's `workbench-observation.json` in its
  Git directory. Create missing files as [templates](references/templates.md) says.
- A tracked repository's Repository Standards adoption record: the Repo Canon
  source its Selection names, for the `workbench` profile offer.
  When it is missing, use the example source.
- `.repo-standards/rules/factory-workflow.md` and `.scriptorium/config.json`: stages,
  coverage and Model selection. When configuration is missing, do uncovered work by hand;
  when rules are missing, consult source `rules/factory-workflow.md` for the stages.
- Scriptorium status JSON: budget/model observations. When absent or unavailable,
  report missing facts and establish them before launching.
- The `retro` skill: method and lesson routes. When missing, obtain it before closing the plan.
- The `babysit` skill: the workbench script's GitHub CLI connection and merge continuation. When missing, re-read records each turn as [the wait step](#the-wait-step) says.
