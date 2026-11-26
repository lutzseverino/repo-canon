# Delegate downstream decisions with five maintainer escalation cases

Status: accepted (2026-11-26); supersedes the decision boundary (the
reserved-decision list), the end of veto lists and the bundled operating model
of [ADR 0041](0041-answer-in-the-owners-place-except-reserved-decisions.md),
and [#1039 GO-D3](https://github.com/lutzseverino/repo-canon/issues/1039).
ADR 0041's plan approval and approval reuse, and `state:owner` for what only
the maintainer can decide, still hold. The 2026-11-19 fates recorded here
supersede [ADR 0040](0040-watch-instead-of-launching.md) and
[ADR 0046](0046-start-owner-facing-work-and-bridge-factory-gaps.md).

The maintainer originates ideas and approves each plan's goal and Done means.
Their delegated agent decides downstream technical design, mechanisms,
sequencing, scope cuts inside the approved goal, factory and orchestrator rules,
and the grills those raise. It answers its own rounds with an independent
review by a different provider, lists each decision for veto in its next
update, and silence stands. Without a delegated agent, the maintainer decides.
This keeps strategic implementation with the agent while reserving changes to
what the maintainer wanted and decisions that need the maintainer.

A grill opens with the maintainer only when:

1. The maintainer asks.
2. A decision changes what the maintainer asked for: the goal, a Done-means
   clause, or dropping something wanted.
3. It is hard to reverse and reaches outside the maintainer's own repositories:
   names or formats others' code depends on, a breaking release for outside
   users, deleting repositories or data, money or new accounts, or a security
   trade-off adopters live with.
4. It needs the maintainer's taste, credential, device or presence.
5. Two recorded maintainer decisions conflict and neither code nor records
   settle which wins.

The owner said on 2026-11-26T19:37Z: "So, I should grill and triage the things I
want to build, the ideas I have. And then you and the factory should implement
that idea in a strategic way, with code that feels right to look at. That
means, after the first grills I decide to do myself, orchestrate should take
over the rest for me." On 2026-11-26T19:55Z, "Yes to all three" approved the
five-case list, applying it immediately, and carrying it into Repo Canon.
On 2026-11-26T20:0xZ, "Agreed to all" approved the role wording and placement;
on 2026-11-26T20:01Z, "Yes, approved" approved the final revision outline.
The owner's role requirement remains: "We should settle who owns the task too.
Orchestrator wouldn't make sense cause some users might not use it."
(2026-11-13).

## Consequences

- Planning rules hold the role rule and the rewritten inference test. The
  inference test limits a triager, including its prohibition on inferring a
  persistent default, limit, timeout or fallback. Remaining intent questions
  go to the delegated agent's own grill, or to the maintainer in the five
  cases. The test does not constrain the agent's reviewed grill.
- Grilling and grill-with-docs name their other party. Independent review
  against long-term design stays the final round either way, and recorded
  approval is reused. Orchestrate carries the agent's side: decide downstream,
  report for veto, and open maintainer-facing grills only in the five cases.
- This replaces the 2026-11-18 primarily technical delegation and its
  carve-outs, and #1217's narrower operational-authority condition. It does
  not revive the watch-only orchestrator, factory-session bridge or validated
  owner-values engine: owner, 2026-11-19, "yes to all", dropped #1040, #1045
  and #1048 ([recorded fates](https://github.com/lutzseverino/repo-canon/issues/1039#issuecomment-7015801315)).
  ADRs 0040 and 0046 remain historical records; the glossary describes the
  surviving design.
- Publication, independent contract acceptance, exact-revision readiness,
  credential grants and merge ownership keep their gates. Delegation never
  lets a writer accept their own contract or manufacture access.

## Considered options

- Keep the old reserved list, including every grill and changes to the agent's
  own rules: rejected, because it escalates strategic implementation the
  maintainer has delegated.
- Use the triager's inference test as the agent's decision limit: rejected,
  because it sends persistent implementation choices to the maintainer even
  after the goal is approved.
- Delegate without strategic review or a veto record: rejected; different-provider
  review and the next-update list make downstream choices inspectable.
