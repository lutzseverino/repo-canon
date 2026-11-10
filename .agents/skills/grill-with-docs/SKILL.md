---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

Read the contribution guide's Triage rules for publication, inference and
amendments. Invoke `grilling` and `domain-modeling` through the session's
supported skill mechanism, with the request, recorded decisions and dated
sources as context. Reuse settled answers; ask only the owner questions the
guide permits, and list qualifying inferences under **Inferred, listed for the
owner**, with dated sources and owner veto. Gather missing facts yourself.

Once the owner's required answers are recorded, invoke `to-spec`, then
`to-tickets`, retaining the applicable plan-approval gate. Publish one
specification in the repository containing most of the work and its proposed
tickets in their responsible repositories, retaining relied-on dated decisions and quoted words in every
contract. Return the issue links, actual native parent/blocker relationships,
inferences and any open factual verification to the orchestrating agent for
its split decision and independent exact-revision review. Apply no readiness
to contracts you wrote. A native-link failure stops publication progression
with the exact missing edge and platform failure.

For an amendment, use the same grill boundary, record a specification revision
and invoke `to-tickets` on the delta. Update affected contracts and native
links, returning edited accepted contracts for a new notice, independent review
and readiness. Use the guide's exemption for findings, qualifying follow-ups
and reorderings already allowed by blockers.

## Reads

Paths are relative to each responsible repository root.

- `CONTRIBUTING.md`: Triage, implementation contracts and readiness. If missing,
  use this method with independent review, and ask the owner for unresolved
  intent under the same inference boundary as `grilling`.
- The `grilling`, `domain-modeling`, `to-spec` and `to-tickets` skills:
  interview, domain documents and publication methods. If one is missing,
  report it and stop that step rather than inventing a substitute.
