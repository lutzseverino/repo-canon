# Workbench templates

## Creating the workbench

Create a local git repository outside projects, seeded with `index.md`, `inbox.md`,
`wishes.md` and `now.md`. Tell the owner its path and global-instruction line:
`The orchestrating agent's workbench is <path>.`
Offer Repo Canon's `workbench` profile (pinned workflow skills, no rules/CI/branch
requirements). With the owner's yes, commit the seed and `adopt` using a tracked
repository's adoption source (else `https://github.com/lutzseverino/repo-canon`).
Update with `adopt` without a source.
Commit each completed adoption/update once its `status` says ready to commit.

## Layout

```text
index.md          tracked repositories, plans and current owner session
inbox.md          open decisions and Answered entries awaiting handover
inbox-archive.md  answered decision history
wishes.md         ideas before conversation or outside the current goal
now.md            owner waits, in-flight work, launches and arrivals
incoming/         other sessions' messages, pending intake
<plan>/plan.md    current state, goal, Done means, specifications and Close reviews
<plan>/log.md     append-only history, including previous owner sessions
<plan>/*.md       grill decisions and launch reports
```

Rewrite `now.md` and `plan.md` in place; keep superseded approvals. Elsewhere date
entries, cite sources, and preserve superseded text with date and replacement link. Repository-facing records copy
relied-on decisions, dates and quoted words under [Workbench](../SKILL.md#workbench);
private records retain sources; decisions stay intact. Plans hold specification
links, not draft briefs. Session references are their opaque harness identifiers.

## `index.md`

List tracked Repositories and one line per active plan, proposals included:
directory and goal. Name only the current owner session; history lives in
`log.md`. Move a closed plan's line under Closed, dated. Launch capacity comes
from Scriptorium status; keep no workbench launch caps.

## `now.md`

Rewrite each pass from the UTC clock. Keep all three tables even empty and retain
counts, notifications and chores until acknowledged. Include the optional last section
only for new issues, after the opening status projection in updates and heartbeat replies.

```markdown
# Now

## Waiting on you

<count> open decisions in `inbox.md`.

- <chore or notification for the owner>

| Item | Decision/owner action | Since (UTC) | Next check |
| ---- | --------------------- | ----------- | ---------- |

## In flight

| Item | Waiting on | Since (UTC) | Next check | Evidence | Watches |
| ---- | ---------- | ----------- | ---------- | -------- | ------- |

## Running launches

| Host | Kind | Session | Started (UTC) | Item | Report | Next check |
| ---- | ---- | ------- | ------------- | ---- | ------ | ---------- |

## Arrived since last update

- <new issue link in a tracked repository> — <author> — <ready, grill, owner, or waiting for the owner's word>
```

- **Identity:** Item is a linked row code, e.g. `[intake](plan.md#intake)`; its
  target joins tables. Display words and opaque Session references identify no
  watch. One row per identity in each table; joined watches form a union.
- **Owner waits:** dated rows link the decision/action. Since is the wait's
  actual beginning, never derived from report prose. Retain outstanding/deferred
  owner steps under [inbox](#inboxmd)'s do/defer/drop rules.
- **In flight:** retain Since, Next check and Evidence. Waiting on takes `owner`,
  `factory`, `launch`, `third party: <name>`, `date: <UTC date or time>` or
  `orchestrator`, optionally followed by `: <detail>`; third party/date require theirs.
  Watches is inline-code JSON naming wake mechanisms; Evidence implies no watch.
  Owner-only rows use `[{"owner":true}]` and a matching owner row. Tracker watches
  require observed labels and/or head/checks per [the wait script](launches.md#the-wait-script).
- **Launches:** record every column **before** launch, initially Session `pending`.
  Reports supply launch watches. Resumption needs a fresh report or cleared old
  final marker. Consume a report by removing its launch row and reconciling work
  and owner rows; keep owner outcomes in explicit rows until resolved. A marker
  means read, never success; remove finished work rows.
- **Paths:** resolve Report and file/directory watches beside selected `now.md`;
  absolute paths stay absolute. Incoming coverage is its `incoming/`; emitted
  record links stay relative to that directory. No literal pipes in cells;
  JSON uses `\u007c`. Report paths may be inline code.
- **Projection:** `wait.mjs --status --from <now.md>` reads records/report final
  lines only, without platform access or durations. Optional `--budget <status.json>`
  adds the [same Scriptorium observation](launches.md#starting-a-launch), retaining
  provenance, holds, unknown values and additive fields, without another status
  read. Missing, malformed or incompatible supplied JSON is an error, never free
  capacity. The fixed table is `Item | Running | Waiting on owner | Since (UTC) | Next check`.
  Orchestrator rows lead in record order as `your move[: <detail>]`; others retain order.
  Running otherwise uses Waiting on, else Kind; owner rows use `—`. Launches use
  Started/Next check, others Since/Next check. A final `status: done`
  overrides stale rows with `turn ended; read report`, owner `—`, Started and
  `read [<report>](<report>)` until consumption. No prose classifies owner work; elapsed time invents no deadline.
- **Special rows:** expedited Item starts with `expedited`, Evidence links its
  Answered entry and PR, Waiting on is `owner: expedited pause`. A time-bounded
  grant uses `launch: <workers>` and its bound event under Watches/Next check. Remove
  reporting workers; at the last report or bound, end/log the grant, tell the
  maintainer and remove its row, preserving plan/decision/chore tracking.

Repair named missing fields/tables, invalid Waiting on/Watches and conflicting expectations;
a missing report is incomplete, not invalid. Empty work tables keep incoming-only coverage.

## `inbox.md`

One entry per open owner decision across plans: question, plan, source link,
opening date and recommendation. Notifications/chores live in `now.md`; launched
sessions add open decisions here. Separate open entries from Answered history.
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

One line per wish: date, owner's quoted words/idea, source link and repository.
A wish may link a filed finding; it never replaces its tracker/reporting records.

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
**Done means:** <observable ending state>
**Approval:** <date, owner approval link and Preapproves scope>
**Specifications:** <issue links>
**Close reviews:** retro; <skill and repository, adding done <file> when complete>

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
merges point rows at one issue, only the owner drops one. Every row ends with a
closed Issue, `dropped (owner)`, or an expedited row's merged PR in State.
State holds its latest step/session/PR, including `triaged <file>` or `grilled <file>`
completion marks; expedited states start with `expedited`. Close only after all rows end.
Count/report open issues at start/close with no limit. Append to `log.md`, never rewrite: record every plan-filed issue with repository,
number and creation evidence, including outside findings; retain each factory/direct
run's issue, run, PR and final findings-report location. Date entries from the UTC
clock (`date -u +%Y-%m-%dT%H:%MZ`), never by hand.
