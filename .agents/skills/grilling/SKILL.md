---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

A prompt or brief naming this skill is its invocation.

Interview the decision maker relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Read the target repository's planning rules, or its contribution guide when
those rules are absent, before adding a question to the frontier. Use Decision
rights to identify the other party for each round: the maintainer in its five
reserved cases, otherwise their delegated agent; without one, the maintainer.
Have the delegated agent answer its own rounds under that rule's review and
next-update veto requirements. Reuse dated recorded answers
and investigate missing facts; the triager's inference test does not limit the
delegated agent's reviewed grill.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the frontier in rounds: number each question and give your recommended answer. Keep each round short: when the frontier holds more questions than the decision maker can weigh at once, ask the ones that unblock the most and leave the rest for the next round. Record their answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each answered round reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. Put each open decision to the other party selected by Decision rights and wait for their answer. When words cannot settle a look (UI, owner-facing output, layout) or how a state model feels, you may build a throwaway prototype with the `prototype` skill and cite it in the question.

When the frontier is empty, a grill that adds or changes a mechanism or policy
ends with an independent review against long-term design: a fresh session,
of another provider where the harness offers one, reads ADRs as history, not
constraints. Ask its findings as the final round, before the decision maker's final
approval and publication. A grill that only drops or moves work skips this
strategic-close step; delegated decisions still need the planning rules'
independent review.

For a publishing grill, include the last decisions and ticket check in that
same final round: specification repository, ticket split with repositories and
blockers, testing seams, and publication go-ahead. Reuse an applicable recorded
approval and cite it in the round instead of asking again. The delegated agent
answers this round with the review above when it is the other party.

Complete the interview only when every required answer is recorded or listed
for veto under the planning rules, including the final round. If a question
reopens, recompute the frontier; the next completed round becomes the final
one, with its applicable review and ticket check. Never announce settled or
publishing while a required question remains open. A composite skill can then
continue to publication.

## Reads

- `.repo-standards/rules/planning.md` in the target repository: planning policy
  named by this skill. If absent, use that repository's `CONTRIBUTING.md`;
  if both are absent, report the missing policy and stop the dependent step.

- The `prototype` skill: a throwaway prototype for a question. If missing, ask
  the question in words.
