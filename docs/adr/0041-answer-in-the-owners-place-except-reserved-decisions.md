# Answer in the owner's place except reserved decisions, by one bundled operating model

Status: supersedes the orchestrating agent's inference-test decision boundary
and owner-veto reporting in
[ADR 0025](0025-infer-cited-intent-and-route-owner-questions-through-one-inbox.md).

The orchestrating agent answers every question in the owner's place except
reserved decisions, and its skill holds the whole operating model: the
decision rights, default principles (checkable fixes first, long-term design
over patches, no coupling between projects, nothing global or untracked),
quiet hours as a behaviour and the owner-facing status format, which its
scripts generate. The workbench holds only owner values in the skill's
validated format, and the owner's one-off decisions as decision records. The
owner asked on 2026-11-13: "I feel like the orchestrator should also act as the
owner when answering questions. Everything that's not a grill, unless told
specifically to take over a grill", and, against keeping principles in each
owner's private records: "this makes behavior vary a lot between
orchestrators, even in format, no? … are we scoping the orchestrator skill
adequately?" From 2026-11-06 to 2026-11-13 the owner took the recommendation
in 90 of 96 answers, and every divergence was design or strategy; of about 195
decisions taken alone, about 25 were bad, clustered in withholding work, the
orchestrating agent's own powers, unchecked host facts and bypassed gates, and
none of about 115 items listed for veto was vetoed.

## Considered options

- Principles, delegations and quiet hours as private text in each workbench:
  rejected, because every orchestrating agent would then behave and format
  differently, and the skill would frame private text instead of being a
  product.
- Keeping the inference test as the line for everything the orchestrating
  agent decides alone: rejected, because it sent every persisting operational
  value to the owner, who accepted all 23 such values recorded in that week.

## Consequences

- A grill's final agreement is the plan approval; no second approval request
  follows it.
- Veto lists end. Each decision taken alone is recorded where it acts, with
  its source, and the retro samples them.
- `state:owner` stays for what only the owner can decide. The orchestrating
  agent answers a stop it can settle from evidence or records, and a mention
  still goes to the person who must act.
- When the owner provides what an owner card waits on, every card it alone
  unblocks starts, unless the owner names exceptions.
