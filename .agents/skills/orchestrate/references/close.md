# Close

Close a plan once every row of its ticket table has ended, as
[Lifecycle](../SKILL.md#lifecycle) says. Take these steps in order.

## Reconcile the plan's issues

Collect the plan's issue-creation records. Reconcile those records with every
run's findings: PR findings comments and, for runs without PRs, the reporting
locations the contribution guide prescribes. Include factory and directly
launched workers, even when their findings are absent from the ticket table.
Follow creation evidence from those reports to recover issues missing from the
plan's `log.md`. Consolidate references by repository and issue number, then
check current issue state. Distinguish newly plan-filed issues from
pre-existing linked findings and unrelated concurrent work; retain the
provenance links. Closed issues stay out of the still-open list. Outside
findings need not be resolved for the plan to close.

After reconciliation, record the open-issue counts at close.

## Run the Close reviews

Then run each of the plan's Close reviews in its own session, as a launch:
**The retro**, as [Retro](launches.md#retro) says, and each other Close
review, as [Architecture review](launches.md#architecture-review) says.

## Route each lesson

For every retro, including session retros outside a plan close:

- **Rule or skill lesson:** file an issue for triage in its value owner's
  repository under the contribution guide's Findings and installed comment rules.
  For a Repo Canon rule/skill, use the source repository named by the adoption
  record's Selection (e.g. `lutzseverino/repo-canon`), never edit an adopter's copy.
  Compare previous retros and open issues first; a recurring lesson links its
  existing issue or reopens it when closed. Intent-bound lessons reach grills
  through triage, as [intake](intake.md#filed-requests-and-reports) says.
- **Owner setup outside repositories:** an owner chore in `now.md`'s Waiting on you.
- **One-off:** retain its evidence in the retro record.

The [retro launch](launches.md#retro) also counts factory gaps and files the top
recurring gap; intake of ideas is excluded.

## Announce the close

Once every Close review is marked done, move the plan under `Closed` in
`index.md`, and announce, as the last plan update:

- what shipped and what was dropped;
- the inferred-intent items and the wishes the plan added;
- every issue the plan filed that is still open, each with its reason and
  evidence link;
- the retro's lessons and the other Close reviews' findings, each with its
  route and link;
- one suggested next direction, taken from the wishes and the parked items.
