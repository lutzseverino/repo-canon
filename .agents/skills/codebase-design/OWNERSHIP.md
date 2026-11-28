# Ownership check

For a proposed fix, apply these steps before choosing an ownership route,
even when no trigger applies:

1. **Checkable fixes first.** For a workflow or factory problem, lead with an
   option code or CI can check. An explicit signal is acceptable even when it
   adds a manual step; a prompt or skill-instruction change, or a time-based
   settle delay, is never the primary fix.
2. **Long-term design over patches.** If a proposal could patch over a design
   problem, name the refactor and prefer it, or explain why not.

Then apply the triggers and routes below within the recorded contract and
authorized scope.

Use the project's **Value owner**, **Ownership check** and **Deferred seam**
vocabulary from `GLOSSARY.md`, when present. Check for these triggers:

- **Trigger 1:** modifying or forking vendored or third-party code.
- **Trigger 2:** adding a configuration kind or a new place a value lives.
- **Trigger 3:** adding a second or third variant.
- **Trigger 4:** crossing a repository, product or host boundary, or making them
  release in lockstep.
- **Trigger 5:** placing a file where the standard layout would not lead an agent.

Without a trigger, the whole check is one line: `No trigger`.
When triggered, record the triggers and, for each value:

- its **Value owner**: standard, repository, host or issue, holding the value
  in its own file (a per-issue choice is an issue label);
- current and likely consumers;
- reversibility;
- cost now and carrying cost, each **S/M/L**.

Apply these defaults to the read:

- **Reversible, one consumer:** choose the cheapest path; record the seam as
  deferred.
- **Hard to reverse or a second consumer:** wrap.
- **Third consumer or a seam crossing repositories:** propose extraction in
  its own ticket for the owner to decide. Extraction covers code and
  configuration; copied decision text is exempt.

The author may choose the nicer design immediately when they argue cost now
**S** and lower carrying cost, and the brief or code reviewer accepts that
argument. This is a design judgment, not another review gate.

## Deferred seams and touched code

Record a **Deferred seam** in one line at its code location, for example:

```text
Seam (deferred): <what varies>; consumers: <n>; extract at 3.
```

Update the note when a consumer is added. Use an ADR only when the deferral
itself is a one-way door. **Considered options:** an ordinary note belongs at
its code so the next change finds and updates it; an ADR would turn a
reversible implementation choice into a durable decision, and a separate
seam register would drift away from the code. A friction log holds evidence,
never the seam register.

For existing ownership problems in touched code, take the first applicable
route:

1. Fix in place only when cost is **S**, in files already edited,
   behavior preserving, and listed on its own line in the PR body.
2. Otherwise, note a seam the change does not need yet, or update its consumer
   count when adding a consumer; the third prompts the extraction proposal.
3. Otherwise, use the planning rules' **Findings** route.

This permission covers that cleanup, not separate unticketed work or an
expansion of factory-run authority. Reviewers check whether touched problems
were fixed, noted or filed, and judge the implementation against its contract.

## Disagreeing with a recorded contract

For a **one-way door** the agent judges wrong, stop through the
planning rules' owner-question route (`state:grill`), with the trigger and
cost read. For a **two-way door**, implement the contract and record the
deferred seam or finding. Never silently deviate, or silently comply with a
one-way door judged wrong. Follow the planning rules' Owner questions and Findings routes;
when both rules and guide are absent, report the question and stop for a one-way door,
or report the finding with the handoff for a two-way door.

## Worked examples

**Capability and policy.** In the
[Scriptorium model-choice split](https://github.com/lutzseverino/scriptorium/issues/115#issuecomment-6693419305),
a repository preference had migrated between host configuration and an exact
standard file. Trigger 2 and Trigger 4 prompt a read: the host owns reachable models,
credentials and per-kind defaults in host configuration; the repository owns
its optional model preferences and unavailable-model fallback in its policy
file; the factory that reads that file owns its schema and check, and the
standard owns neither, nor those policy values; the issue owns its model-label
choice. Current consumers are the factory's triage, implement/retry and review
runs; other repositories are likely consumers. Relocating repository values after adoption is hard to reverse:
this example rates cost now **M**, carrying cost **L** if values stay misplaced,
and **S** after the split. Wrap the resolution behind an interface that reads
issue choice, then repository policy, then host default, within host
capabilities. Without the optional policy file, use host defaults. A seam
shared across repositories prompts a separate extraction proposal for the
owner; it does not authorize implementing that extraction here.

**Vendored UI.** A product needs one variation of a third-party button. Trigger 1
prompts the read: upstream owns the copied implementation, the repository owns
its presentation choice in its wrapper file, and the standard owns no product
styling value. There is one current screen consumer and a second likely one;
a local wrapper is reversible. This example rates a source edit cost now
**S**, carrying cost **M** across upstream updates; a small wrapper costs **S**
now and **S** to carry. Choose the wrapper immediately when the brief or
reviewer accepts that lower carrying cost, rather than editing vendored
source. Defer a shared wrapper package at the wrapper's code location with
one consumer; update the count for a second, and propose extraction in its
own ticket for a third or a cross-repository consumer.
