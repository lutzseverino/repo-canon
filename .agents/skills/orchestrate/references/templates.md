# Workbench templates

The shapes of the workbench files that [Workbench](../SKILL.md#workbench)
names, how to create the workbench, and the rules for writing in it.

## Creating the workbench

Create a local git repository outside project checkouts, seeded with `index.md`,
`inbox.md`, `wishes.md` and `now.md`. Tell the owner its path and global-instruction
line: `The orchestrating agent's workbench is <path>.`

Offer Repo Canon's `workbench` profile: pinned workflow skills without rules, CI
or branch requirements. With the owner's yes, commit the seed and run Repository
Standards' `adopt` with that profile and the source named by a tracked repository's
adoption record (else `https://github.com/lutzseverino/repo-canon`). Later update
with `adopt` without a source.

A completed adoption or update of the `workbench` profile is one workbench
change: commit it once `status` reports it ready to commit.

## Layout

```text
index.md     the tracked repositories, the active plans, each with its owning session reference, and launch caps
inbox.md     the decision inbox
wishes.md    one line per wish
now.md       the current state: what waits on the owner, what is in flight, and running launches
incoming/    one file per message from another session, until you take it in
<plan>/      one directory per plan
  plan.md    the plan's current state
  log.md     the plan's append-only log
  *.md       its grill decisions and draft briefs
```

`now.md` and each `plan.md` are rewritten in place, except that `plan.md`
keeps a superseded approval line, marked as the wiki rules below say. The rest
of the workbench is a wiki:

- Date every entry.
- Cite each source, such as an issue, pull request, comment or session, by its
  link or reference. Private planning retains these sources; repository-facing
  records instead copy needed decisions, dates and quoted words under
  [Workbench](../SKILL.md#workbench), with no private-workbench reference.
- Leave a superseded entry's text as written: mark it superseded, dated, and
  point to the entry that replaces it.
- Once a draft brief is filed, add a dated line at its top linking the issues
  it became, and leave the draft below it as written. A draft you set aside
  for later work stays in the plan directory, marked parked, and takes no row.
  Leave decision records as written.

A session reference is the opaque identifier your harness gives a session,
recorded as given.

## `index.md`

A `Repositories` list names each repository the workbench tracks. One line per
active plan, including proposals awaiting approval: its directory, its goal in
a few words, and the reference of the session that owns it. When a plan
closes, move its line under a `Closed` heading, dated. A `Launch caps` list
names a host by its hostname and the most agent launches you may run at once
on it.

## `now.md`

Rewrite current state on every pass, using UTC times from the clock. These
three tables are required, even when empty; keep counts and notifications.

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
```

- **Identity:** Item is a linked row code, such as `[R](plan.md#r)`. The link
  target joins tables; display words and opaque Session references identify no
  watch. Each table has at most one row per identity; joined watches form a union.
- **Waiting on you:** retain counts, notifications and chores until acknowledged.
  Record owner waits as dated rows with a linked decision/action, including
  outstanding/deferred steps under [inbox](#inboxmd)'s do/defer/drop rules.
  Since records the owner wait's beginning; never derive it from report prose.
- **In flight:** retain activity, Since, Next check and Evidence for each wait.
  Watches is an inline-code JSON array. A non-owner row names its actual wake
  mechanism; an owner-only row uses `[{"owner":true}]` and a matching owner row.
  Evidence supplies no implicit watch. Examples:
  `[{"item":"file:plan.md"},{"event":"worker completion event"}]` or
  `[{"item":"org/repo#7","expected":{"labels":["state:ready"]}}]`.
  Tracker expectations contain observed labels and/or head/checks; their exact
  shape is in [the wait script](launches.md#the-wait-script).
- **Running launches:** record Host, Kind, Session (initially `pending`), Started,
  linked Item, current-turn Report path and Next check **before** launch. Reports
  supply launch watches. Before resuming a session, choose a fresh report or clear
  the old terminal marker so preceding completion cannot end the current turn.
  Consume a report by removing its launch row and reconciling In flight and owner
  rows. Owner outcomes stay tracked through explicit owner rows; finished work
  disappears when its work rows are removed. A marker means read, never success.
- **Paths:** Report and file/directory watches resolve beside the selected
  `now.md`; absolute paths stay absolute. Incoming coverage is its `incoming/`.
  Keep emitted record links relative to this same directory. Table cells cannot
  contain literal pipes; JSON uses `\u007c`. Report paths may be inline code.
- **Projection:** `wait.mjs --status --from <now.md>` reads these records and
  report final lines only, without platform access or wait durations. It emits
  `Item | Running | Waiting on owner | Since (UTC) | Next check`. Running uses
  In flight's activity, else launch Kind; owner rows have Running `—`. Launches
  use Started and Next check; other rows use Since and Next check. A final
  `status: done` overrides stale rows with `turn ended; read report`, owner `—`,
  Started and `read [<report>](<report>)` until consumption. No prose classifies
  owner work and no elapsed time invents deadlines. Empty tables show headers.
- **Special rows:** an [expedited change](launches.md#expedited-change)'s Item
  starts with `expedited`; Evidence links its Answered entry and PR, and activity
  states its pause. A time-bounded grant lists its workers under Waiting on and
  a harness event at its bound under Watches/Next check. Remove reporting workers;
  when the last reports or the bound ends, end/log the grant, tell the maintainer
  and remove its row. Preserve linked plan/decision/chore tracking.

For example, a launch row can join `[R](plan.md#r)` above with Report
"reports/r.md"; its launch watch and tracker watch both apply. An owner row
`[O](plan.md#o) | [approve access](inbox.md#o) | 2026-11-08T18:10Z | owner reply`
records an owner step independently of any report marker. Missing tables, fields,
invalid Watches and conflicting expectations are actionable errors; repair the
named input rather than keeping stale coverage. A missing report is incomplete,
not invalid. Empty work tables retain incoming-only coverage.

## `inbox.md`

The decision inbox the contribution guide names: one entry per decision open
for the owner, across plans. Each entry is a decision, and holds the question,
its plan, a link to its source, the date it opened, and your recommendation.
Notifications and chores go in `now.md`. Grills and triage runs add entries
too. Keep open decisions separate from the inbox's `Answered` history.

After an inbox rule update, reconcile every currently open entry against the
active rules on the next pass, including takeover. Repair missing context
(question, plan, source and opening date) and recommendations from the records;
when a fact is unavailable, state the gap rather than invent it. An entry's age
never exempts it. A repair leaves it open and leaves previously answered
history unchanged.

For each owner-only step holding a plan row open, link a decision offering
**do, defer and drop**, with a recommendation and explicit status: whether
the step is optional and whether a third party blocks it, with the blocker
when present. Link the decision, executable chore in `now.md` and affected
plan row to each other. Keep the row tracked pending the owner's decision;
deferral keeps it tracked too. Record an owner drop and its source before
marking the row `dropped (owner)`. Invent no deadline and silently drop no row.

When an owner message contains a decision, complete this sequence before
acting on anything else in that message. For a bulk reply, identify exactly
which entries it answers; apply the sequence only to those entries. Preserve
every unanswered entry with its context and recommendation, including entries
to which the reply does not apply:

1. Post a comment on each affected issue, recording the decision, its date
   and quoted words, with a repository citation when available. Copy private
   decisions without referencing the private record, as
   [Workbench](../SKILL.md#workbench) requires, and post as the repository's
   `.repo-standards/rules/comments.md#disclaimers` says.
2. Append the decision, date, source and issue links to the plan's `log.md`.
3. Move the answered entry under `Answered` in `inbox.md`, keeping its
   question, answer, date and source.
4. Commit the workbench writes and push when it has a remote, as
   [Workbench](../SKILL.md#workbench) says.

Only then act on the rest of the message.

An [expedited change](launches.md#expedited-change)'s request has no open
entry: step 3 enters it under `Answered` directly, marked expedited, with the
owner's quoted words, date and source, and step 2 applies only when it falls
inside a plan's goal. The entry later gains its outcome.

## `wishes.md`

One line per wish: the date, the owner's quoted words or idea, a link
to its source, and the repository it concerns.

A wish may link a filed finding for future planning. A wish never replaces
the finding's tracker record or reporting links.

## `incoming/`

Any session, such as a launch or one of the owner's own, can leave you a
message. Each message is one Markdown file directly in `incoming/`, named
`<UTC>-<sender>.md`: the time it was written, from
`date -u +%Y%m%dT%H%M%SZ`, and a short name for the sending session in
lowercase letters, digits and hyphens. Its body is the message, citing its
sources by link.

- A sender on the same host as your session writes the file into your
  workbench checkout, at the path the owner's global agent instructions name,
  and commits nothing.
- A sender elsewhere commits the file in its own clone of the workbench,
  straight to the default branch, and pushes it.

When the [wait step](../SKILL.md#the-wait-step) reports an upstream commit
not yet pulled, pull the workbench first. Take in each
message: move it into the `log.md` of the plan it concerns, dated and citing
its file name, or into `inbox.md` when it holds a decision for the owner,
since the inbox holds only decisions. Then delete the file and commit, as
[Workbench](../SKILL.md#workbench) says, before you act on the message.

## `plan.md` and `log.md`

The proposal names its Close reviews: the retro, and
`improve-codebase-architecture` for each repository whose code the plan
changes. The owner keeps or removes each architecture review; the retro stays.
Record the proposal in the plan directory and `index.md` before filing work;
record the open-issue counts at start. On approval, write the approval line
with its source and what it preapproves, and the Close reviews line the owner
approved. When an amendment changes which repositories' code the plan changes,
propose their Close reviews with it.

`plan.md` holds the plan's current state, rewritten in place, and takes this
shape:

```markdown
# <Plan title>

**Goal:** <the outcome the plan delivers>
**Done means:** <the observable state that ends it>
**Approval:** <date>, <link to the owner's approval>. Preapproves: <what the plan names that the approval covers>
**Close reviews:** retro; <`improve-codebase-architecture` in each repository the owner kept it for>

## Tickets

| Item | Repository | Issue | State |
| ---- | ---------- | ----- | ----- |

## Open issues

| Repository | At start | At close |
| ---------- | -------- | -------- |

## Current state

<what the plan is doing now and what it waits on>
```

`log.md` takes this shape:

```markdown
# <Plan title> log

- <timestamp> <entry>
```

- **Tickets.** Every row ends with a closed issue in its Issue column,
  `dropped (owner)` in its State or, for an expedited row without an issue,
  its merged pull request in its State; the plan closes only then. A row stays
  for the life of the plan: a split adds rows, a merge points several rows at
  one issue, and only the owner drops one. State holds the row's latest step,
  such as `grill <session reference>`, `grilled <file>`, `triaged <file>`,
  `filed`, `ready`, or a pull request link. `grilled <file>` and
  `triaged <file>` are the done marks a grill and a triage run set. An
  [expedited change](launches.md#expedited-change)'s row starts its State with
  `expedited`.
- **Close reviews.** The reviews Close runs, set when the owner approves the
  plan. The retro is always one. Each other review names its skill and
  repository. A review's session sets its done mark by adding `done <file>`
  after the review on this line, such as `retro done retro.md`.
- **Open issues.** Count each repository's open issues when the plan starts and
  again at close. Report the counts; they set no limit.
- **Current state.** A few lines on what the plan is doing now and what it
  waits on. Rewrite them as the plan moves; the log keeps the history.
- **`log.md`.** Append entries; never rewrite one. The wiki rules apply.
  Record every issue the plan files with its repository, number and
  creation evidence, including findings outside the ticket table. Keep each
  factory or directly launched run's issue, run and PR references and its final
  findings-report location. Take every timestamp from the clock, in UTC, with
  `date -u +%Y-%m-%dT%H:%MZ`, never by hand.
