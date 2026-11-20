# Close

Close a plan once every Done-means clause is met, its line ending with its
evidence (an issue, pull request, release or recorded owner confirmation); rows
still open then end as `moved`, their issues set to `priority:low`, or
`dropped (owner)`. Take these steps in order.

## Reconcile the plan's issues

Check the current state of the issues the plan's rows link and of the issues
the plan's `log.md` records as filed.

After reconciliation, record the open-issue counts at close.

## Run the Close reviews

Then launch each of the plan's Close reviews in its own session with
`workbench brief Close <review> --row "Close reviews"`, naming the review as
the plan's Close reviews line lists it: `retro`, or an architecture review's
repository (`<owner>/<name>`). The `retro` skill owns the retro record and
[lesson routes](../../retro/SKILL.md#route-each-lesson); route an architecture
review's report through [intake](intake.md#filed-requests-and-reports).
Consuming the retro's report logs each issue it lists as filed or reopened in
the plan's `log.md`, with its creation evidence, and adds each owner chore it
lists as an Open `inbox.md` entry. Link each consumed report after its review
on the Close reviews line.

## Announce the close

Once every Close review's report is consumed and linked on the plan's Close
reviews line, move the plan under `Closed` in `index.md`, and announce, as the
last plan update:

- what shipped and what was dropped;
- the inferred-intent items and the wishes the plan added;
- every issue the plan filed that is still open, each with its reason and
  evidence link;
- the retro's lessons and the other Close reviews' findings, each with its
  route and link;
- one suggested next direction, taken from the parked items.
