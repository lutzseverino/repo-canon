# Intake

Read this when an owner's idea, an issue in `state:grill`, or a retro or
architecture-review report arrives. Wishes park ideas before conversation;
a conversation may start from one.

## Ideas

Converse only while the idea is unclear. Restate one goal sentence and its
target: a new plan, or an amendment of a named plan. The owner's assent, or a
direct request for a grill, schedules it. A grill is never an owner decision;
`inbox.md` holds decisions only.

The default is a grill. Suggest a shorter path (expedited change, an issue
straight to triage, or direct change) only as an option, and take it only on
the owner's yes for that idea. A report of broken existing rules or contracts
is a Finding: file for triage under the contribution guide, with no grill or yes.

## Grill queue

Schedule agreed ideas, `state:grill` issues and routed review candidates. Keep
one grill open with the owner at a time; the others wait in `now.md`'s In flight
on the orchestrating agent, ordered by plan order then age. Merge queued items
about the same plan into one grill. An owner-requested grill opens at once,
whatever else is open. Use [Grill](launches.md#grill) when it can start.

Record a queued grill's wake mechanism, such as the open grill's completion
event, in Watches; it is not an owner-only wait. A launched grill gets a
Waiting on you row linking the grill's questions, with Since and Next check
`owner answers, at your pace`; the status projection then shows its owner wait.
Reuse its session across observations and takeover.

## Filed requests and reports

Leave filed requests to factory triage where enabled, within the installed
factory-workflow rules' Handoffs trigger and Triage run limits. Otherwise use
`triage` by hand and log the gap. An outside reporter's issue waits for the
owner's word under that trigger. Put your own suggestions in filed issues under
`Suggestions (not decisions)`, following installed comment rules.

For example, manually triaging a filed request with factory triage disabled
logs `Gap | Intake | org/repo | triage run disabled`; the retro counts it.
Taking the owner's idea through conversation and a grill logs no gap line and
is never counted as an intake gap. Other uncovered stages retain gap accounting.

Every retro, including a session retro outside plan closure, routes lessons
under [Close](close.md#route-each-lesson). Intent-bound triage outcomes join the
grill queue. For architecture candidates, pick under the owner's delegation
(2026-11-05: “the orchestrator decides architecture cleanup changes, weighting
simplicity and less code”), and file each picked candidate for triage. Intent
beyond that delegation goes through triage to `state:grill` and the queue;
unpicked candidates stay in the review record.

Seam (deferred): intake as a reusable skill; consumers: 1 (orchestrate); extract
at a second consumer under the Ownership check.
