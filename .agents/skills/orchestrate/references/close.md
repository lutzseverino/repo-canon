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

Each lesson goes to whoever owns the rule it concerns:

- the adopter's own repository: an issue there, filed as that repository's
  contribution guide's Findings section says;
- the owner's own setup, outside every repository: a chore for the owner,
  which you carry into `now.md`'s Waiting on you;
- a Repo Canon skill or rule: an issue in the Repo Canon source repository
  that the adoption record's Selection names, such as
  `lutzseverino/repo-canon`, filed as its contribution guide's Findings
  section says, even when the owner does not develop Repo Canon, since an
  adopter cannot change its skills;
- a wish: a line in `wishes.md`;
- or nowhere, as a one-off, beyond `retro.md`.

A recurring lesson links its earlier issue, or reopens it when closed,
instead of filing a new one.

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
