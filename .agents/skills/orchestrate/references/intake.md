# Intake

## Questions

Read every question first, from launch reports, issues and incoming messages; workers
put questions in their report or on the issue, never `inbox.md`. For every choice, apply the target repository's planning rules' Decision rights
and Owner questions, with its contribution guide only when those rules are
absent. Settle facts from code, logs and records. Conduct downstream grills
with independent review by a different provider and list each decision for
veto in the next update as those rules require. Route a reserved case to its
maintainer grill under [Grill queue](#grill-queue); put operational maintainer
chores in the decision inbox with a recommendation. Only you write that inbox.
An owner approval, including a plan's **Preapproves** line, names items ahead of time:
a dated source the test may cite, covering what it names, with nothing inferred beyond it.
A blanket yes covers each item listed, with its recommendation, in the message it
answers, including a new row listed there; never later discoveries. Record each covered item.

## Ideas

Converse only while unclear; restate one goal sentence and its target: a new plan or
amendment of a named plan. Owner assent or a direct grill request schedules it.
A grill is never an owner decision; `inbox.md` holds decisions only.
The default is a grill. Suggest a shorter path (expedited change, issue straight to
triage, direct change) only as an option; take it only on the owner's yes for that idea.
Broken rules or contracts and parking an idea follow the planning rules' Findings rule, without a grill.

## Grill queue

Schedule agreed ideas, `state:grill` issues and routed review candidates as plan rows.
Keep one grill open with the owner; others wait on their rows, by plan order then age.
Merge same-plan items. Owner-requested grills open at once, whatever is open. Launch each with
`workbench brief Grill` when it can start; status shows it Running until its report
ends. Reuse its session across observations and takeover.

## Filed requests and reports

Leave requests to enabled factory triage within installed factory-workflow Handoffs
and Triage run limits; otherwise use `triage` by hand and log the gap. An outside
reporter's issue waits for the owner's word under that trigger. Put your suggestions
in filed issues under `Suggestions (not decisions)`, following installed comment rules.
Manually triaging with factory triage disabled logs `Gap | Intake | org/repo | triage run disabled`.
Owner ideas through conversation/grill log no gap. Other uncovered stages retain gap accounting.
Every retro, including session retros outside closure, routes lessons under
[the `retro` skill](../../retro/SKILL.md#route-each-lesson). Intent-bound triage joins the grill queue.
For architecture candidates, read the owner's current recorded delegation, pick
within it and file each pick for triage. Without delegation, or for intent beyond it,
use triage's normal intent-question route to `state:grill` and the queue.
Unpicked candidates stay in the review record.

Seam (deferred): intake as a reusable skill; consumers: 1 (orchestrate); extract at a second consumer.
