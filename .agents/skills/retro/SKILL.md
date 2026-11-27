---
name: retro
description: Perform a plan-close or session retrospective from its generated launch brief, record the evidence and lessons in its report, and route each lesson to its value owner.
---

A prompt or brief naming this skill is its invocation.

Your input is the generated brief that invokes you. Read its Context for
inputs, evidence links and scope, and write into the report its
`Launch report:` line names. Use the primary plan files, cited issues, PRs,
comments and run records, and the latest Closed plan's retro record as evidence;
never use the orchestrating agent's summary or context. Session retros outside
plan closure use this same method, lesson routes and gap routes.

The `orchestrate` skill owns workbench formats and the launch-report protocol.
Read its [templates](../orchestrate/references/templates.md) for the records you
use; the brief's fixed duties finish the report. Read each responsible
repository's planning and comment rules before filing or
reopening issues.

## Read the evidence

Follow the Context's evidence links to primary records. Read the plan's goal and
Done means, its history and run records, and the decision records in `inbox.md`
and `inbox-archive.md`. Use `index.md` to find the latest Closed plan; the
report its Close reviews line links for its retro is the previous retro.
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
- Filed or reopened issues, each with its repository, number and creation
  evidence (and the reopening record for a reopened issue).
- Owner chores a lesson needs, each with its evidence.
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
- **Owner setup outside repositories:** list an owner chore in the report,
  linking its evidence.
- **One-off:** retain its evidence in the retro record.

Complete the report under the brief's duties, writing nothing else in the
workbench. The orchestrating agent consumes it, logs the listed issues with
their creation evidence in the plan's `log.md`, adds the listed chores as Open
`inbox.md` entries and adds the report to the plan's Close reviews line.

Seam (deferred): workbench record reads use orchestrate's format; consumers: 2
(orchestrate and retro); propose extraction at 3 under the Ownership check.

## Reads

Paths are relative to the workbench or the responsible repository.

- `.repo-standards/rules/planning.md` in the target repository: planning policy
  named by this skill. If absent, use that repository's `CONTRIBUTING.md`;
  if both are absent, report the missing policy and stop the dependent step.

- The generated brief: its Context and the report its `Launch report:` line
  names. If missing, stop and ask for the brief; if its Context lacks evidence
  or scope, record the missing input in the report and hand back without
  inventing it.
- The `orchestrate` skill: workbench formats linked above. If missing, record
  that gap in the report and stop rather than invent the format.
- `index.md`: the latest Closed plan. If missing or no Closed plan exists,
  record that no previous retro is available.
- `<plan>/plan.md`: goal and Done means. If missing for a plan retro, record the
  unavailable comparison; for a session retro use the Context's session scope.
- `<plan>/log.md`: history, friction, gaps and issue-creation evidence. If
  missing, record unavailable timing and gap counts.
- The previous retro's report, linked on the latest Closed plan's Close reviews
  line. If missing, record the unavailable comparison.
- `inbox.md` and `inbox-archive.md`: owner answers, recommendations and
  chores. If either is missing, report the unavailable counts rather than infer
  answers.
- The Context's cited issues, PRs, comments and run records, and the responsible
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
