---
name: to-tickets
description: Break a specification into independently mergeable tickets, publish them in their responsible repositories with native parent and blocking links, and return the split for independent review.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# To Tickets

## 1. Gather context

Read the supplied plan, specification or conversation; fetch any supplied
reference and read its full body and comments. For a grill, consume the specification
through the planning rules' Publication and amendments route; invoke `to-spec`
if absent. For an amendment, consume the revised specification and work only
the delta under that route.

Explore unfamiliar code; use the project's glossary and applicable ADRs.
Look for prefactoring that makes implementation easier.

## 2. Draft vertical slices

Draft **tracer bullets**: each cuts a narrow, complete path through schema,
API, UI and tests, is independently demoable or verifiable, and fits one fresh
context window. Sequence prefactoring first.

Give each ticket its **blocking edges**: the other tickets that must complete
before it can start. A real dependency, expand–contract order, a live-acceptance
ticket after its source ticket, and a ticket whose `Deletes:` line names a
surface ahead of every ticket that edits that surface each take an edge.
**Overlapping writes** take an edge only when both tickets will rewrite the
same authored passage or the same shared inventory: a list, table or registry
both edit. A shared file prompts that check and never serializes the tickets
on its own; tickets writing different passages of one file take no overlap
edge. The blocked ticket's **Blocked by** names the passage or inventory
behind an overlap edge. Keep dependencies cycle-free. A ticket with no
blockers uses the planning rules' Readiness and installed
parent-readiness rules.

For **wide refactors**, **deepening tickets** or **cross-repository switches**,
read the applicable [exceptional-slice judgement](special-slices.md) before
splitting; retain independently green merges and activation-step ordering.

For **live evidence**, apply the contribution guide's Implementation contracts
rule to choose source-ticket criteria or a separate live-acceptance ticket.
In the split case, block live acceptance on the source, make recorded live
evidence its criteria, link it from the source PR without closing it, and use
the installed host-access route.

For **UI, visual and icon tickets**, include the
[design acceptance criteria](../triage/AGENT-BRIEF.md#design-acceptance-criteria)
in each contract.

## 3. Prepare independent review

Present a numbered breakdown with each ticket's short descriptive **Title**, **Blocked by**
(including overlap reasons), and **What it delivers**: end-to-end behaviour or
a deepening ticket's structural outcome and behaviour changes.

Attach evidence for granularity, real dependencies, independently mergeable
slices, test seams and any cross-repository switch's intervening deployed
states. Identify factual verification the reviewer must finish. Reuse recorded
answers and plan approval; apply the planning rules' Decision rights and Owner
questions to unanswered choices. Return the split and evidence through those
rules' split and acceptance route.

## 4. Publish

Read [publication](publication.md) for the configured tracker branch: local
files or a hosted tracker. Publish one contract per ticket, blockers first,
awaiting independent review. Return exact contracts and native-link responses
through the planning rules' Publication and amendments and Readiness route.

Work the **frontier**: ready tickets whose blockers are done. Follow the
contribution guide's Implementation contracts rule for progress and closure;
keep the parent open, changing its contract only for an authorized amendment.
Record publication progress in comments and native sub-issue states.

## Reads

Paths are relative to the repository root.

- `.repo-standards/rules/planning.md` in the target repository: planning
  policy. If absent, use that repository's `CONTRIBUTING.md`; if both are
  absent, report missing policy and stop the dependent step. The guide also
  owns live evidence, progress and closure.
- `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`: tracker and
  labels. If tracker configuration is missing and no tracker was supplied, ask
  whether to use local files or a real tracker; if labels are missing, use
  canonical role names.
- `.repo-standards/rules/comments.md`: posting rules. If absent, post bodies
  and comments as the publication reference describes.
- `GLOSSARY.md` and `docs/adr/`: vocabulary and decisions. If missing, use the
  codebase's words.
- The installed rules looked up by `repository-standards`, including
  `github-repository-configuration`: readiness companion labels and host-access
  route. If missing, readiness carries no companion labels and live acceptance
  takes no special route.
- `.scratch/`: local tickets. If missing, create it on the local-files
  publication branch.
- The `codebase-design` skill: deepening vocabulary and replace-don't-layer
  testing. If missing, describe the module in the codebase's words.
- The `triage` skill's `AGENT-BRIEF.md`: design criteria. If missing, report
  the gap and stop publication of UI, visual and icon tickets.
- The `to-spec` skill: a grill's single specification. If missing, report it
  and stop publication until a specification exists.
