---
name: to-spec
description: "Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of what you've already discussed."
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user; just synthesize what you already know.

The issue tracker and triage label vocabulary should have been provided to you.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Reuse recorded test-seam decisions with their dates and quoted words. Gather
missing code facts and record seam evidence for independent review. Apply the
contribution guide's inference test: list reversible in-scope answers under
**Inferred, listed for the owner**, with dated sources and owner veto. Only a
one-way door or a value no recorded decision chose takes the owner-question
route. A new public name, breaking change, persistent default, limit, timeout
or fallback, or a goal/scope change cannot be inferred. Reuse settled answers
and plan approval; factual and seam review belongs to the independent reviewer.

3. Write the spec using the template below. Copy every relied-on owner decision
with its date and quoted words into the issue-facing contract; private records
are not required inputs. Publish one specification issue in the repository
containing most of the work, reading `.repo-standards/rules/comments.md#disclaimers`
first on a hosted tracker. Cross-repository tickets remain children of that one
specification. Its body is a direct implementation contract, needing no intake
triage, redundant Agent Brief or category label. Publication awaits review and
grants no readiness. The orchestrating agent decides the final split and never
accepts a contract it wrote; substantial split changes return to the writer,
and missing code facts go to independent fact-finding. Review checks the exact
contract, factual/test-seam evidence and unresolved intent. An independently
authorized reviewer applies readiness only after its validator revision notice,
with required companion labels. The parent's readiness follows ticket
publication and the installed later-link rules.

For a grill's publication, continue with `to-tickets` after the specification
exists. A plan goal, Done means or row-scope amendment first needs an amendment
grill under the contribution guide, then a specification revision and
`to-tickets` on the delta. Edited accepted contracts lose readiness and need
their own new notice, independent review and renewed readiness. Progress stays
outside ready contracts; findings, qualifying follow-ups and allowed
reorderings use the guide's exemption.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>

## Reads

Paths are relative to the repository root.

- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`: the
  issue tracker and its triage label vocabulary. When the tracker config is
  missing and no tracker was provided, ask the user where to publish the
  spec; when the label config is missing, use the canonical role names as
  the label strings.
- `.repo-standards/rules/comments.md`: the installed comment rules, whose
  section the posting steps name. When it is missing, post issue bodies and
  comments as the steps describe.
- `GLOSSARY.md` and the ADRs in `docs/adr/`: the domain vocabulary and
  decisions to respect. When either is missing, use the codebase's own words.
- The installed rules, such as the `github-repository-configuration` rules,
  which the `repository-standards` skill looks up: the companion labels
  readiness needs. When they are missing, readiness carries no companion
  labels.
- `CONTRIBUTING.md`: Triage inference, publication, amendments and readiness.
  If missing, use the inference boundary above, independent exact-revision
  review and the tracker rules provided; route unresolved owner choices to the
  user without repeating recorded answers.
- The `to-tickets` skill: ticket publication after a grill or amendment. If
  missing, report it and stop at the published specification awaiting review.
