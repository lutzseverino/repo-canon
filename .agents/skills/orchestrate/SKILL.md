---
name: orchestrate
description: Turn the owner's feature or problem into an approved plan across tickets, keep its state in the workbench, and run it to an announced close.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Orchestrate

You are the orchestrating agent. Turn the owner's feature or problem into a plan
they approve; keep its state in the workbench and run it to an announced close.

Each repository's `CONTRIBUTING.md` decides triage, readiness, question routing
and delivery: its Triage, Readiness, Owner questions, Findings and Pull requests
sections, and the installed comment rules what you post. This skill carries
those rules across a plan; the installed `triage` skill triages one request.
Where a factory serves, its installed `factory` skill hands it tickets and
delivers held, stopped or skipped work.

Read [templates](references/templates.md) before you write a workbench file,
[launches](references/launches.md) before you launch, take over, hand over,
observe or arm a wait, and [close](references/close.md) before you close a plan.
One session owns each plan, handing over at close and after compaction.

## Workbench

The workbench is a private Markdown git repository outside projects. Use the path in your global instructions,
or create one before proposing a plan. Commit straight to its default branch; push if it has a private remote.
Repository issues, briefs, comments and decision records must be self-contained: copy every relied-on decision,
with its date and quoted words, even when duplicated. Never reference or require the private workbench from a
repository: no URL, host path or instruction to consult it as input or provenance. Repository records may cite
each other; private planning retains its own sources. Its files:

- `index.md`: tracked repositories, plans and their owners, and launch caps.
- `inbox.md`: the decision inbox. [Reconcile after rule updates and process
  owner decisions](references/templates.md#inboxmd) before other work.
- `wishes.md`: one line per wish, an idea outside a plan's goal.
- `now.md`: the current state, rewritten on every pass.
- `incoming/`: [messages](references/templates.md#incoming) from any session.
- `<plan>/plan.md`: the plan's current state; `<plan>/log.md`: its append-only
  history; other `<plan>/*.md`: its records and draft briefs.

## Lifecycle

A **plan update** is any report to the owner about a plan, the proposal
included. Each lists the inferred-intent items the owner has not yet seen, with
their citations, and shows the decision inbox; log those items in `log.md`.

1. **Propose.** Present the goal, Done means, ticket table and Close reviews to
   the owner for approval, as a plan update. Record the proposal before filing
   work, and then its approval, as
   [templates](references/templates.md#planmd-and-logmd) says. Research, filing
   and brief preparation may precede plan approval. Hold ticket readiness for
   plan execution until the owner's plan approval is recorded. Plan approval
   replaces neither independent brief review nor any other readiness condition
   in the guide and installed rules. An owner's request for something now skips
   only the plan: [Expedited change](references/launches.md#expedited-change).
2. **Intake.** Route each new request as the guide's Triage section says, with
   the `triage` skill's method, in triage runs. Put your own ideas under
   `Suggestions (not decisions)` in the issue you file, posted as
   `.repo-standards/rules/comments.md#disclaimers` says.
3. **Grill.** Follow the [Grill path](references/launches.md#grill) for intent
   questions and issues waiting on a grill. Then decide the split, file issues as step 2
   says and accept the briefs, as the guide says, marking drafts as the
   [wiki rules](references/templates.md#layout) say.
4. **Run.** Launch the plan's ticket workers and observe progress. Handle a
   Finding as the contribution guide's Findings section says, even outside the
   goal, without waiting for its resolution. A **new requirement** that arrives
   mid-plan, unless the owner wants it now, takes one route:
   - **Row:** it serves the goal and passes the guide's inference test. Add it
     as a row, log it, and list it in the next plan update.
   - **Amendment:** it changes the goal or scope. Propose it; it applies once
     the owner approves, recorded as a new approval line superseding the old.
   - **Wish:** it lies outside the goal and is not a Finding. Add it to
     `wishes.md`; it needs no issue merely because it is a wish.
5. **Close.** Once every row has ended, reconcile the plan's issues, run its
   Close reviews, and announce the close as the last plan update.

## The wait step

Keep one background wait continuously armed during foreground work and between
turns, covering every In-flight wake mechanism, current launch report and incoming
message. Owner-only rows use recorded owner waits and incoming responses; keep an
incoming-only wait with no other work. Use harness events for events the script
cannot observe. On wake or timeout, minimally reconcile, update expected facts and
records, then immediately re-arm before other work or a substantive owner update.
Rewrite records to change watches. Where the harness can neither wait in the
background nor deliver events, report the limit and reread records each turn.

## Report-back

Every launch writes its designated current-turn report, ending its complete
content with the final line `status: done`, including when owner steps end its
turn. Preserve each launch's row marks, owner questions and commit/push duties
in [launches](references/launches.md); consume it as [templates](references/templates.md#nowmd)
says. Other sessions write to `incoming/`. Harness messages are only nudges;
act on the files. Without messaging, the owner also announces completed grills.

## Reads

Repository paths are relative to each tracked repository's root, and workbench
paths to the workbench's.

- `CONTRIBUTING.md` and `.repo-standards/rules/comments.md`: the sections and
  comment rules named above. When either is missing, carry out this method as
  written, and put each rule it leaves to it in `inbox.md` for the owner.
- `AGENTS.md`: its Agent skills requirements for delegation and session naming.
  When it is missing, give each launch only its task context, and name each
  session for its operation and target where naming is supported.
- The workbench, whose format this skill owns: its `index.md`, `inbox.md`,
  `wishes.md`, `now.md`, `incoming/` and each plan's `<plan>/plan.md`,
  `<plan>/log.md`, `retro.md` and other files. When it is missing, create it as
  [templates](references/templates.md) says, and a plan's files as it starts.
- A tracked repository's Repository Standards adoption record: the Repo Canon
  source its Selection names, for the `workbench` profile offer and lessons
  about a Repo Canon skill or rule. When it is missing, use the example source.
- The `babysit` skill: `wait.mjs` imports its GitHub CLI connection, and a
  worker's merge resumes it. When it is missing, the wait script cannot start:
  re-read the records at each turn, as the [wait step](#the-wait-step) says.
