# Workbench templates

## Creating the workbench

Create a local git repository outside projects, seeded with `index.md`, `inbox.md`
and `wishes.md`. Tell the owner its path and global-instruction line:
`The orchestrating agent's workbench is <path>.`
Offer Repo Canon's `workbench` profile (pinned workflow skills, no rules/CI/branch
requirements). With the owner's yes, commit the seed and `adopt` using a tracked
repository's adoption source (else `https://github.com/lutzseverino/repo-canon`).
Update with `adopt` without a source.
Commit each completed adoption/update once its `status` says ready to commit.

## Layout

```text
index.md          tracked repositories, active plans and the current orchestrator
inbox.md          open decisions and chores, and Answered entries awaiting handover
inbox-archive.md  answered decision history
wishes.md         ideas about this procedure, not repository ideas
incoming/         other sessions' messages, pending intake
<plan>/plan.md    current state, goal, Done means, specifications and Close reviews
<plan>/log.md     append-only history, including previous orchestrators
<plan>/*.md       grill decisions, launch briefs and reports
```

Rewrite `plan.md` in place; keep superseded approvals. Elsewhere date
entries, cite sources, and preserve superseded text with date and replacement link. Repository-facing records copy
relied-on decisions, dates and quoted words under [Workbench](../SKILL.md#workbench);
private records retain sources; decisions stay intact. Plans hold specification
links, not draft briefs. Session references are their opaque harness identifiers.

## `index.md`

```markdown
# Workbench

Orchestrator: <current orchestrating session reference>

## Repositories

## Active

- `<plan directory>/`: <goal>

## Closed
```

List tracked Repositories and, under Active, one line per active plan, proposals
included, starting with its directory. `Orchestrator:` names only the current
session; history lives in `log.md`. Move a closed plan's line under Closed, dated.
Launch capacity comes from Scriptorium status; keep no workbench launch caps.

## `inbox.md`

One `### <question>` entry per open owner decision or chore across plans, under
`## Open`: a `Plan: <plan>/<row>` line, source link, opening date and recommendation.
Only the orchestrating agent writes this inbox. Answered history goes under `## Answered`.
On handover move Answered entries intact to `inbox-archive.md`.
After a rule update, including takeover, reconcile all open entries against it;
repair missing context/recommendations from records, naming unavailable facts.
Age exempts none; repairs leave entries open and answered history unchanged.
For an owner-only step holding a row, offer **do, defer and drop**, recommending
one and stating whether optional and/or third-party blocked, naming the blocker.
Cross-link decision, executable chore and plan row. Keep pending and deferred
rows tracked; log an owner drop and source before `dropped (owner)`. Invent no deadline.

Before other work on an owner message, apply this sequence only to decisions it
answers (identify each in bulk replies); preserve every unanswered entry:

1. Comment on each affected issue with decision, date, quoted words and a
   repository citation when available; copy private decisions without a private
   reference, following installed `.repo-standards/rules/comments.md#disclaimers`.
2. Append decision, date, source and issue links to the plan's `log.md`.
3. Move the entry under Answered, retaining question, answer, date and source.
4. Commit workbench writes and push when it has a remote under [Workbench](../SKILL.md#workbench).

An [expedited change](launches.md#expedited-change) has no open entry: enter it
directly under Answered, marked expedited with quoted words/date/source, then
its outcome. Step 2 applies only inside a plan's goal.

## `wishes.md`

One line per idea about this procedure: date, quoted words, source link; repository ideas follow the planning rules' Findings rule.

## `incoming/`

Other sessions leave one Markdown file directly here, `<UTC>-<sender>.md`, time
from `date -u +%Y%m%dT%H%M%SZ`, sender lowercase letters/digits/hyphens; cite sources
in its message; launched sessions use designated reports. Same-host senders write in the global-instructions workbench checkout, committing
nothing; elsewhere, commit in their clone straight to its default branch and push.
On an upstream-commit wake, pull first. Move each message into its plan's `log.md`,
dated and citing its filename, or the inbox for an owner decision. Delete the
file and commit under [Workbench](../SKILL.md#workbench) before acting on it.

## `plan.md` and `log.md`

Before filing, record proposal and open-issue counts in its directory and index.
Name Close reviews: retro always; `improve-codebase-architecture` for each
repository whose code changes. The owner may drop architecture reviews at approval.
Record approval and approved Close reviews; propose changed repository reviews
with amendments. Plan fields and tables:

```markdown
# <Plan title>

**Goal:** <outcome>
**Approval:** <date, owner approval link and Preapproves scope>
**Specifications:** <issue links>
**Close reviews:** retro <report link once consumed>; <skill> <owner>/<name> <report link once consumed>
**Done means:**

1. <one observable clause per line, ending met <evidence link> once it holds>

## Tickets

| Item | Repository | Issue | State |
| ---- | ---------- | ----- | ----- |

## Open issues

| Repository | At start | At close |
| ---------- | -------- | -------- |

## Current state

<current activity and waits; rewrite as it moves>
```

New row codes are one to three whole English words, hyphenated (e.g. `intake` or
`release-standards`), anchored in Item and cited by that anchor. Existing codes
stay until their rows end; grill decision codes stay, always linked to their record. Keep rows for the plan's life: splits add rows,
merges point rows at one issue, only the owner drops one. A row ends when its State
starts with `closed` (its issue), `merged` (an expedited row's PR), `moved` or `dropped (owner)`;
status watches every issue and PR linked on other rows. A launch brief, which `workbench brief` writes, is a plan-directory file with a
`Launch report: <path>` line, absolute or relative to that directory; its report finishes at its exact
final `status: done` line. Consume a completed report by appending a receipt to that
plan's `log.md`, with the row's new state:

```markdown
- 2026-11-27T03:00Z Consumed: report-01.md Row ready for review.
```

The receipt starts with `Consumed:`, optionally preceded by a Markdown list marker
and then an optional UTC timestamp (`YYYY-MM-DDTHH:MMZ`). Name the report path as
the brief's `Launch report:` gives it, bare, in backticks or as a Markdown link's
target. A bare path ends at the first whitespace; wrap paths containing whitespace.
Text after the path is free. Resolve the path against this plan's directory; only
a receipt for the complete resolved report path consumes that launch. Other report
mentions, including launch announcements and older consumption prose, do not count.

State holds its latest step/session/PR; expedited states start with `expedited`. Close only once every Done-means clause is met; end remaining open rows as `moved` or `dropped (owner)` as the Close reference says.
Count/report open issues at start/close with no limit. Append to `log.md`, never rewrite: record every plan-filed issue with repository,
number and creation evidence, including one a run opens outside the goal; retain each factory/direct run's issue, run and PR. Date entries from the UTC
clock (`date -u +%Y-%m-%dT%H:%MZ`), never by hand.
