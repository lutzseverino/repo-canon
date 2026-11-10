---
name: orchestrate
description: Turn the owner's feature or problem into an approved plan across tickets, keep its state in the workbench, and run it to an announced close.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Orchestrate

Each repository's `CONTRIBUTING.md` governs triage, readiness, questions,
findings and delivery; its installed comment rules govern posts. Carry those
rules across the plan: `triage` handles one request; where a factory serves,
its `factory` skill delivers tickets and held, stopped or skipped work.

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

- `index.md`: repositories, plans, owning sessions and launch caps.
- `inbox.md`: decisions; [reconcile and process answers](references/templates.md#inboxmd) before other work.
- `wishes.md`: ideas outside the goal; `now.md`: current state, rewritten each pass.
- `incoming/`: [other sessions' messages](references/templates.md#incoming).
- `<plan>/`: current `plan.md`, append-only `log.md`, records and draft briefs.

## Lifecycle

A **plan update** is any owner report about a plan, including its proposal.
Every update and heartbeat reply opens with the existing records projection:
`wait.mjs --status --from <now.md>`, including its completed-turn diagnostic.
Keep `Item | Running | Waiting on owner | Since (UTC) | Next check` unchanged;
read records only, never harness thread lists or a second view. Each update
shows the inbox and unseen inferred-intent items with citations; log the items.
In owner-facing material link every row/decision code and issue number to its
row, record or issue; expand unfamiliar codes once per message. Deferred checker:
implement over `now.md`, `inbox.md` and `plan.md` only at the first recorded
post-release bare-code slip. The later [launch rewrite](https://github.com/lutzseverino/repo-canon/issues/693)
owns status/model/effort reads and budget integration, preserving this interface
and the Ownership check reference above for every launcher.

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
4. **Run.** Launch workers and observe progress. Record friction in `log.md` with
   evidence, **Value owner**, exposed seam and route (plan row, finding or wish).
   Deferrals stay at their code location, never in the friction log. Route Findings
   under the guide even outside the goal, without waiting for resolution. A **new requirement**
   that arrives mid-plan, unless the owner wants it now, takes one route:
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

Launches hand back only through their designated current-turn report, with final
line `status: done`: “this turn ended; read the report”, including owner waits,
never success. Follow [launches](references/launches.md) for early prerequisites,
relay and retained duties; [consume reports](references/templates.md#nowmd).
Other sessions write to `incoming/`.

## Reads

Paths are relative to each repository or the workbench.

- `CONTRIBUTING.md` and `.repo-standards/rules/comments.md`: the sections and
  comment rules named above. When either is missing, carry out this method as
  written, and put each rule it leaves to it in `inbox.md` for the owner.
- `AGENTS.md`: delegation, naming and the repository's workstation convention.
  When it is missing, give each launch only its task context, and name each
  session for its operation and target where naming is supported.
- The `codebase-design` skill: its Ownership check. When missing, record the
  gap through the contribution guide's Findings route; retain the fields above.
- The workbench, whose format this skill owns: its `index.md`, `inbox.md`,
  `wishes.md`, `now.md`, `incoming/`, `<plan>/plan.md`, `<plan>/log.md` and `retro.md`.
  Create missing files as [templates](references/templates.md) says.
- A tracked repository's Repository Standards adoption record: the Repo Canon
  source its Selection names, for the `workbench` profile offer and lessons
  about a Repo Canon skill or rule. When it is missing, use the example source.
- The `babysit` skill: the wait's GitHub CLI connection and merge continuation.
  When missing, re-read records each turn as [the wait step](#the-wait-step) says.
