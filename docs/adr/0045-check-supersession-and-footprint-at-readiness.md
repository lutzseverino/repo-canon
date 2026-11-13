# Check supersession and footprint at readiness, not by hand

Status: accepted (2026-11-13).

A specification or ticket contract states what it supersedes and what it adds
and deletes, and the checks that already gate every contract enforce it. A
contract carries a `Supersedes:` line naming the ADRs and issues it replaces,
and `Adds:` and `Deletes:` lines naming durable surfaces (skills and their
references, labels, configuration keys, record kinds), never file paths, as
the Agent Brief rules require. The issue-contract validator and the readiness
command refuse readiness to a specification while an open issue it supersedes,
or one citing an ADR it supersedes, has no **fate** posted on it. At the pull
request, a surface the ticket declared deleted must be gone from the diff, and
a change that edits a surface an open ticket deletes fails. The adds and
deletes are tallied and shown, not gated.

The owner asked for this on 2026-11-13, after an audit found that newer
decisions left queued tickets written against the old ones, with fates posted
only on the issues a grill happened to know about: "So your proposed grill will
include a fix that prevents this from happening again in the future? Cause
orchestrator should work in a way that causes the shape we want, and this is
not it. I thought plans were getting amended along with issues themselves,
somehow." And: "I wanna make this easier for agents, we need to have in mind
their environment, how the pull in context, and so on. Predictability."

## Considered options

- A publication script run by every grill writer: rejected, because a writer
  who publishes another way, or a triage run that rescopes, skips it silently;
  the validator and readiness command already see every contract.
- File paths in a new structured field: rejected, because paths go stale while
  a contract waits and the Agent Brief rules omit them; the pull request's diff
  is where paths are known.
- An owner approval for every net-additive specification: rejected by the owner
  on 2026-11-13 ("So I'd manually confirm net positive changes? That sounds like
  lots of work suddenly."); most good work adds, so the tally is shown instead.
- A cadence rule holding a grill until the previous one's tickets ship:
  rejected, because superseding a recent decision already costs a fate on every
  open ticket written against it, visible in the grill itself.

## Consequences

- Deletion tickets go first by native blocking links, set by the writer from
  the `Deletes:` lines; the pull-request check catches the case a link missed.
- The comment rules allow, in a factory-served repository, one comment
  recording a superseded issue's fate and one adding new evidence to an
  existing finding, each linking its source.
