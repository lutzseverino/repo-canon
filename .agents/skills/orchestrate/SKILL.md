---
name: orchestrate
description: Turn the owner's feature or problem into an approved plan across tickets, keep its state in the workbench, and run it to an announced close.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Orchestrate

You are the orchestrating agent. Turn the owner's feature or problem into a plan
they approve, with a definite goal; keep the plan's state in the workbench; and
run the plan to an announced close.

Each repository's contribution guide, `CONTRIBUTING.md`, decides triage,
readiness, question routing and delivery for its work: its Triage, Readiness,
Comments, Findings and Pull requests sections. This skill is how to carry those
rules across a plan. The installed `triage` skill is how to triage one request.
In a repository a factory serves, the `factory` skill installed there is how to
hand tickets to the factory and deliver held, skipped or handed-off work.

Read [templates](references/templates.md) before you write a workbench file,
[launches](references/launches.md) before you launch, take over, hand over,
observe or arm a wait, and [close](references/close.md) before you close a plan.
One session at a time owns every plan: it hands over at each plan's close and
after any compaction since it took over.

## Workbench

The workbench is a git repository of plain Markdown holding the state of every
plan you own. It is the owner's private record, outside every project
repository, with a private remote or none. Your global agent instructions name
its path; when they name none, create one before you propose a plan. Commit each
workbench change straight to its default branch, and push it when the workbench
has a remote. Its files:

- `index.md`: tracked repositories, plans and their owners, and launch caps.
- `inbox.md`: the decision inbox. Process an owner message's decisions in its
  [sequence](references/templates.md#inboxmd) before its other requests.
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
2. **Intake.** Route each new request as the contribution guide's Triage section
   says, with the `triage` skill's method, in triage runs. Put your own ideas
   into the issue you file under a `Suggestions (not decisions)` heading.
3. **Grill.** When the guide's inference test cannot settle an intent question,
   open a grill with the owner. Then decide the split, file the issues and
   accept the briefs, as the guide says, marking drafts as the
   [wiki rules](references/templates.md#layout) say.
4. **Run.** Launch the plan's ticket workers and observe progress. Handle a
   Finding as the contribution guide's Findings section says, even outside the
   goal, without waiting for its resolution. A **new requirement** that arrives
   mid-plan, unless the owner wants it now, takes one route:
   - **Row:** it serves the goal and passes the guide's inference test. Add it
     as a row, log it, and list it in the next plan update.
   - **Amendment:** it changes the goal or the scope. Propose the amendment; it
     applies once the owner approves it, recorded as a new approval line that
     supersedes the old one.
   - **Wish:** it lies outside the goal and is not a Finding. Add it to
     `wishes.md`; it needs no issue merely because it is a wish.
5. **Close.** Once every row has ended, reconcile the plan's issues, run its
   Close reviews, and announce the close as the last plan update.

## The wait step

End a turn only when every row under `now.md`'s In flight waits on the owner or
has a wake-up armed through the harness's own event mechanisms. Its *Next check*
names that wake-up; arm it with the wait script where the harness can. Every
wait also watches `incoming/`, and one watches it alone when nothing else needs
one. Where the harness can neither wait in the background nor deliver events,
report that limit and re-read the records at each turn instead.

## Report-back

The file in the plan directory is the contract. A grill, triage run or Close
review reports by writing its result there, setting its done mark in `plan.md`,
and committing and pushing both; take it in as `now.md`'s Running launches says.
Any other session writes to `incoming/`. A direct message to your session, where
a harness offers one, is only a nudge, and losing it loses nothing: act on the
files. Where none is offered, the owner also tells you when a grill is done.

## Reads

Repository paths are relative to each tracked repository's root, and workbench
paths to the workbench's.

- `CONTRIBUTING.md`: its Triage, Readiness, Comments, Findings and Pull requests
  sections. When it is missing, carry out this method as written, and put each
  rule it leaves to the guide in `inbox.md` as a decision for the owner.
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
