# Workbench templates

The shapes of the workbench files that [Workbench](../SKILL.md#workbench)
names, how to create the workbench, and the rules for writing in it.

## Creating the workbench

When your global agent instructions name no workbench, create one before you
propose a plan: a local git repository outside every project checkout, seeded
with `index.md`, `inbox.md`, `wishes.md` and `now.md`. Tell the owner its path
and the line to add to their global agent instructions, such as
`The orchestrating agent's workbench is <path>.`

When you create it, also offer to adopt Repo Canon's `workbench` profile into
it. The profile installs this skill and the other workflow skills, pinned to a
release, with no rules, CI or branch requirements, so a later orchestrating
session started in the workbench invokes them from there. With the owner's
yes, commit the seeded files, then run Repository Standards' `adopt` in the
workbench with the Repo Canon source that a tracked repository's adoption
record names, such as `https://github.com/lutzseverino/repo-canon`, and the
`workbench` profile. Update it later by running `adopt` there without the
source.

A completed adoption or update of the `workbench` profile is one workbench
change: commit it once `status` reports it ready to commit.

## Layout

```text
index.md     the tracked repositories, the active plans, each with its owning session reference, and launch caps
inbox.md     the decision inbox
wishes.md    one line per wish
now.md       the current state: what waits on the owner, what is in flight, and running launches
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
  link or reference, and leave its content where it is.
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

The current state across plans. Rewrite it on every pass; never append to it.
Take its times from the clock, in UTC, as `log.md` does.

```markdown
# Now

## Waiting on you

<count> open decisions in `inbox.md`.

- <chore or notification for the owner>

## In flight

| Item | Waiting on | Since (UTC) | Next check | Evidence |
| ---- | ---------- | ----------- | ---------- | -------- |

## Running launches

| Host | Kind | Session | Started (UTC) |
| ---- | ---- | ------- | ------------- |
```

- **Waiting on you** holds the count of open entries in `inbox.md`, plus the
  chores and notifications for the owner. Carry each one into every rewrite
  until the owner has done or acknowledged it.
- **In flight** holds one row per item that waits on someone or something,
  such as a run, a review, a blocker, plan approval or a launch's report-back,
  with the link that shows it. Its *Next check* names the wake-up armed for
  it, as the [wait step](../SKILL.md#the-wait-step) says.
- **Running launches** holds one row per agent launch you started: its host's
  hostname, its kind (grill, triage run, research run, worker or Close
  review), its session reference once the harness gives one, and its start
  time. Add a launch's row
  before you start it, and remove the row when you take in its report-back.

## `inbox.md`

The decision inbox the contribution guide names: one entry per decision open
for the owner, across plans. Each entry is a decision, and holds the question,
its plan, a link to its source, the date it opened, and your recommendation.
Notifications and chores go in `now.md`. Grills and triage runs add entries
too. Keep open decisions separate from the inbox's `Answered` history.

When an owner message contains a decision, complete this sequence before
acting on anything else in that message:

1. Post a comment on each affected issue, recording the decision, its date
   and where the owner gave it, under the contribution guide's comment rules.
2. Append the decision, date, source and issue links to the plan's `log.md`.
3. Move the answered entry under `Answered` in `inbox.md`, keeping its
   question, answer, date and source.
4. Commit the workbench writes and push when it has a remote, as
   [Workbench](../SKILL.md#workbench) says.

Only then act on the rest of the message.

## `wishes.md`

One line per wish: the date, the owner's quoted words or idea, a link
to its source, and the repository it concerns.

A wish may link a filed finding for future planning. A wish never replaces
the finding's tracker record or reporting links.

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

- **Tickets.** Every row ends with a closed issue in its Issue column or
  `dropped (owner)` in its State; the plan closes only then. A row stays for
  the life of the plan: a split adds rows, a merge points several rows at one
  issue, and only the owner drops one. State holds the row's latest step, such
  as `grill <session reference>`, `grilled <file>`, `triaged <file>`, `filed`,
  `ready`, or a pull request link. `grilled <file>` and `triaged <file>` are
  the done marks a grill and a triage run set.
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
