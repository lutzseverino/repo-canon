---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

A prompt or brief naming this skill is its invocation.

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Reuse recorded answers with their dated sources. An inferred intent answer
must cite the owner’s approved goal, a recorded decision or wish, or the
owner’s quoted words, each with its date. Apply the contribution guide's
inference test before adding a question to the frontier: ask only about a
one-way door or a value no recorded decision chose. List other answers under
**Inferred, listed for the owner**, citing dated evidence and allowing owner
veto. An inference must stay reversible within the approved goal and scope,
add no public name or breaking policy, and choose no persistent default,
limit, timeout or fallback. A choice that fails this test takes the owner-question
route; missing facts call for investigation. Without a contribution guide,
use that same boundary and ask the user directly for the remaining choices.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the frontier in rounds: number each question and give your recommended answer. Keep each round short: when the frontier holds more questions than the user can weigh at once, ask the ones that unblock the most and leave the rest for the next round. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. Put the decisions the inference test leaves open to the user and wait for their answers.

The interview is done when the frontier is empty: each decision is recorded or
listed as a qualifying inference, with no required owner answer missing. Retain
the owner's grill answers and plan approval as gates; reuse recorded approval
rather than adding a quiz. A composite skill can then continue to publication
awaiting independent review.

## Reads

- `CONTRIBUTING.md`, relative to the repository root: the Triage inference test
  and owner-question route. If missing, use the boundary above and ask the user
  directly.
