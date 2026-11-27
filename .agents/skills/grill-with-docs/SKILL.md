---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

Read the target repository's planning rules, or its contribution guide when
those rules are absent, for Decision rights, Publication and amendments and
Readiness. Invoke `grilling` and `domain-modeling` with the request, recorded
decisions and dated sources. Make domain edits on a branch and checkout you
own; deliver one draft PR per
repository through separate `review`, arranged by the caller unless factory
review is configured. Gather missing facts yourself and apply
`codebase-design`'s [Ownership check](../codebase-design/SKILL.md#ownership-check).

Follow the planning rules' publication route when the interview's gates are
complete. Pass dated decisions and quoted words to the publication skills.
Return published links, revisions, native-link responses, inferences and open
factual verification to the caller for the rules' split and acceptance route.
For an amendment, pass the revised specification and delta as that section
requires.

## Reads

Paths are relative to each responsible repository root.

- `.repo-standards/rules/planning.md` in the target repository: planning policy
  named by this skill. If absent, use that repository's `CONTRIBUTING.md`;
  if both are absent, report the missing policy and stop the dependent step.

- `CONTRIBUTING.md`: implementation contracts. If missing, use the published
  issue bodies as contracts.
- The `grilling`, `domain-modeling`, `to-spec` and `to-tickets` skills:
  interview, domain documents and publication methods.
  If one is missing, report it and stop that step rather than inventing a substitute.
- The `codebase-design` skill: the design check applied during the interview.
  If missing, report the missing definition and stop that step.
