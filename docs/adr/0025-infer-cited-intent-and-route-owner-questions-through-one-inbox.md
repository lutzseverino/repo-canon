# Infer cited intent and route owner questions through one inbox

The orchestrating agent answers an intent question itself only when it can cite
the answer's source, the owner's approved goal for the work, a recorded owner
decision or wish, or the owner's quoted words, each with its date; when the
choice is reversible within that work, so no value or policy outlives it, and
it adds no public name and no breaking change; and when it changes neither the
goal nor the scope. Every other intent question goes to a grilling session with
the owner, in its own session, which records the owner's decisions and drafts
the Agent Briefs in a proposed ticket split, filing nothing and applying no
readiness. The orchestrating agent decides the split, files the issues with the
grill's briefs and each brief's owner decisions, and accepts the briefs that
hold after reviewing each as a reviewer who did not write it; it never writes a
brief it accepts. Every question, including one under `needs-info` or
`factory:needs-input`, reaches the orchestrating agent first, and a question
only the owner can answer reaches them only through its decision inbox.

[ADR 0021](0021-route-triage-by-where-its-uncertainty-lies.md) sent every
intent question to the owner, including those their approved goal already
answered, and gave no single channel: the orchestrating agent asked rounds of
questions itself, `needs-info` waited on the reporter, and any agent needing
the owner posted an issue comment. The owner, deciding in the grilling session
of [#595](https://github.com/lutzseverino/repo-canon/issues/595) on
2026-10-25, found it unclear when they had to be contacted and through which
channel, and judged that agents could decide many of the questions waiting on
them. The lesson of [#496](https://github.com/lutzseverino/repo-canon/issues/496)
still holds: its brief chose fallback values the owner never saw, and values
that outlive the work are never inferred, so a default, limit, timeout or
fallback that persists in the product always goes to the owner. Two
alternatives were rejected: keeping every intent question with the owner,
because it spends their attention on answers they already gave; and letting
the orchestrating agent write the briefs it accepts, because acceptance then
loses its independent reviewer.

## Consequences

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md#triage) states the inference test,
  the grill flow and the question routing, and its comment rules have the
  orchestrating agent read every owner question first. The factory workflow
  rules let the orchestrating agent that answers a `factory:needs-input`
  question remove the label when no pull request is open.
- Each inferred answer is stated as behavior in its brief and listed with its
  citation under Inferred intent in the triage notes, and the orchestrating
  agent lists it in its next report to the owner, whose veto is an owner
  decision.
- `needs-info` means missing information that the orchestrating agent answers
  or routes; a question for an outside reporter still goes to the reporter.
- The `triage` fork carries the method, and the glossary defines Decision inbox
  and Inferred intent without granting a permission.
- Adopters must change how they triage and answer owner questions, so the
  change is a breaking standards change under
  [ADR 0003](0003-follow-product-release-versioning.md).
