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

Reuse recorded test-seam decisions and plan approval with their dates and
quoted words. Gather missing code facts and record seam evidence for review.
Before proposing an unanswered decision, apply the target planning rules'
Decision rights and Owner questions sections.

3. Write the spec using the template below, following the target repository's
planning rules' Publication and amendments section. Read
`.repo-standards/rules/comments.md#disclaimers` before publishing on a hosted
tracker. Return the published link, exact revision and factual/test-seam
evidence to the caller for the rules' split and acceptance route. For an
amendment, consume its decisions and return the revised specification for the
delta-ticket step.

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

- `.repo-standards/rules/planning.md` in the target repository: planning policy
  named by this skill. If absent, use that repository's `CONTRIBUTING.md`;
  if both are absent, report the missing policy and stop the dependent step.

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
