---
name: retro
description: Perform a plan-close or session retrospective from its launch report, record the evidence and lessons, and route each lesson to its value owner.
---

A prompt or brief naming this skill is its invocation.

Your only input is one launch report path. Read its header for inputs,
evidence links and scope. Use the primary plan files, cited issues, PRs,
comments and run records, and the latest Closed plan's retro record as evidence;
never use the orchestrating agent's summary or context. Session retros outside
plan closure use this same method, lesson routes and gap routes.

The `orchestrate` skill owns workbench formats and the launch-report protocol.
Read its [templates](../orchestrate/references/templates.md) for the records you
use and its [launch duties](../orchestrate/references/launches.md#shared-launch-template)
for finishing the report. Read each responsible repository's `CONTRIBUTING.md`
and installed comment rules before filing or reopening issues.

## Read the evidence

Follow the header's evidence links to primary records. Read the plan's goal and
Done means, its history and run records, and the decision records in `inbox.md`
and `inbox-archive.md`. Use `index.md` to find the latest Closed plan's `retro.md`.
Compare that retro and open issues before routing lessons. Record unavailable
evidence as missing.

## Write the retro record

Write the record into the launch report, with evidence links for:

- Outcome against Done means.
- Where the time went, attributing waits separately to owner, review, check,
  blocker and launch.
- Lessons ranked by cost, each with its route and link.
- Comparison with the previous retro and open issues; explicitly record when
  no previous retro or matching issue exists.
- Filed or reopened issues, each with its repository and number, also logged
  in the plan's `log.md` with creation evidence (and the reopening record for a
  reopened issue). Outside a plan, keep that evidence in the report.
- Counts of owner answers matching recommendations, by decision type; propose
  preapproval of a type the owner always accepted. A proposal grants no approval.
- The friction log's gap-line count, excluding intake of ideas. File the top
  recurring gap with the factory's project (Scriptorium), reusing or reopening
  an existing issue when it already reports that gap. With no recurring gap,
  record that fact.

## Route each lesson

- **Rule or skill lesson:** file an issue in its value owner's repository with
  `state:triage`, under its issue forms and comment rules. For a Repo Canon rule
  or skill, use the source repository named by the Repository Standards
  adoption record's Selection; never edit an adopter's copy. Link an existing
  issue for a recurring lesson, or reopen it when closed.
- **Owner setup outside repositories:** record an owner chore in `now.md`'s
  Waiting on you, linking its evidence.
- **One-off:** retain its evidence in the retro record.

Complete the report under the launch-report protocol. The orchestrating agent
consumes it and marks the Close review done before announcing the close.

Seam (deferred): workbench record reads use orchestrate's format; consumers: 2
(orchestrate and retro); propose extraction at 3 under the Ownership check.

## Reads

Paths are relative to the workbench or the responsible repository.

- The supplied launch report: header and output destination. If missing, stop
  and request the correct report path; if its header lacks evidence or scope,
  record the missing input there and hand back without inventing it.
- The `orchestrate` skill: workbench formats and launch-report protocol linked
  above. If missing, record that gap in the report and stop rather than invent
  the format or completion protocol.
- `index.md`: the latest Closed plan. If missing or no Closed plan exists,
  record that no previous retro is available.
- `<plan>/plan.md`: goal and Done means. If missing for a plan retro, record the
  unavailable comparison; for a session retro use the header's session scope.
- `<plan>/log.md`: history, friction, gaps and issue-creation evidence. If
  missing, record unavailable timing and gap counts; create it for new issue
  records only when the supplied plan and orchestrate's format establish it.
- `<plan>/retro.md`: the previous retro selected through the index. If missing,
  record the unavailable comparison.
- `inbox.md` and `inbox-archive.md`: owner answers and recommendations. If either
  is missing, report the unavailable counts rather than infer answers.
- `now.md`: owner chores. If missing, create it under orchestrate's format when
  a lesson calls for a chore.
- The header's cited issues, PRs, comments and run records, and the responsible
  repositories' open issues: primary evidence and duplicate comparison. If
  missing or inaccessible, record that limit and any unfiled lesson with its
  destination; do not claim it was filed or reopen an unverified issue.
- A responsible repository's Repository Standards adoption record: Selection's
  source for Canon lessons. If missing, record the unresolved destination and
  ask for that source rather than edit an installed copy or guess its owner.
- `CONTRIBUTING.md`, `.repo-standards/rules/comments.md` and
  `docs/agents/issue-tracker.md`: posting and tracker conventions. If
  missing, use the lesson routes above and the repository's available issue
  forms; without a usable tracker, record unfiled lessons and their destinations
  in the report.
