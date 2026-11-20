# Close

Close a plan once every Done-means clause has evidence (an issue, pull
request, release or recorded owner confirmation); rows still open then end as
`moved`, their issues set to `priority:low`, or `dropped (owner)`. Take these
steps in order.

## Reconcile the plan's issues

Check the current state of the issues the plan's rows link and of the issues
the plan's `log.md` records as filed.

After reconciliation, record the open-issue counts at close.

## Run the Close reviews

Then run each of the plan's Close reviews in its own session, as a launch:
**The retro**, as [Retro](launches.md#retro) says, and each other Close
review, as [Architecture review](launches.md#architecture-review) says.

The `retro` skill owns the retro record and [lesson routes](../../retro/SKILL.md#route-each-lesson).

## Announce the close

Once every Close review is marked done, move the plan under `Closed` in
`index.md`, and announce, as the last plan update:

- what shipped and what was dropped;
- the inferred-intent items and the wishes the plan added;
- every issue the plan filed that is still open, each with its reason and
  evidence link;
- the retro's lessons and the other Close reviews' findings, each with its
  route and link;
- one suggested next direction, taken from the parked items.
