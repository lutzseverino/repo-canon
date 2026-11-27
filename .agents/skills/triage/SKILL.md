---
name: triage
description: Bring issues and external PRs to accepted implementation contracts through research and independent review, or a grill; also supports unattended factory triage.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Triage

Resolve bare issue/PR numbers and external-PR scope from
`docs/agents/issue-tracker.md`; a PR is an issue with attached code.
The target's installed planning rules own routing, inference, acceptance,
readiness and owner questions; use its contribution guide when absent.
Before posting, read the installed comment rules' Lead line and Disclaimers
sections. Use [AGENT-BRIEF.md](AGENT-BRIEF.md) when writing a brief or notes.

## Modes and roles

Take only your entry branch and the references it names:

- **Orchestrating agent**, the default maintainer invocation: read
  [ORCHESTRATING.md](ORCHESTRATING.md) to discover requests, launch fresh-context
  research, route every question through your decision inbox and independently
  review contracts.
- **Research run**: gather facts, verify claims and write briefs after intent
  settles, unless a grill publishes direct contracts. Apply no labels; never
  judge your own brief. Follow [Gather context](#gather-context) and your handoff.
- **Accept mode**, `triage accept <issue>`: read
  [ACCEPT.md](ACCEPT.md#accept-mode) to review and accept an exact revision.
- **Factory triage run**, one issue and a result path: read
  [FACTORY.md](FACTORY.md); return only its run result.
- **Grill**: a separate session with the decision maker the planning rules'
  Decision rights select, for intent the triager cannot infer.

Retain relied-on decisions with dates and quoted words in repository-facing
records; cite those records, never private workbench URLs or host paths.
Before delegating, follow `.agents/skills/implement/DELEGATION.md`.
Without subagents, research and publish yourself, then stop and link the owner
to the contract for accept mode in another session.

## Publication mode

Before publishing or accepting, read the validator's current mode and selected
source. Read `.repo-standards/rules/github-repository-configuration.md#agent-brief`
and, for factory publication,
`.repo-standards/rules/factory-workflow.md#contract-publication-mode`.
Those sections own the body-contract, legacy-cutoff and exact-revision policy;
use the selected route in every writer handoff. An unknown mode or missing or
ambiguous original input holds publication and readiness. Research notes and
questions remain comments.

## Gather context

Read the entire issue/PR: body, comments, labels, author, dates and PR diff.
Reuse recorded decisions and prior notes; on resumption, check answers to
outstanding questions and present the updated picture. Read
`.out-of-scope/*.md`, surfacing similar prior rejections by concept, and enough
code, glossary and ADRs to sort the request. Pass any owner-review reservation
and its dated source to the writer.

Every research run performs both checks first, on either path:

- **Redundancy:** search for existing implementation by domain concept; report
  where you looked.
- **Verify the claim:** reproduce bugs from the reporter's steps; check out PRs
  and run relevant tests/commands. Report confirmed (with code path), failed,
  or insufficient detail.

## Sort by uncertainty

Sort by the planning rules' Triage section before research: **code-bound** when
facts can settle the remaining questions, **intent-bound** when intent remains
open. Category does not decide the path. Research can expose intent; recorded
answers or qualifying inferences can settle it.

## Review

When reviewing a published brief or direct contract, read
[REVIEW.md](REVIEW.md); review against the issue and evidence yourself.
When it holds, use [Accept a brief that holds](ACCEPT.md#accept-a-brief-that-holds).

## Other outcomes

A claim that fails verification or lacks detail waits on whoever holds the
missing fact. For missing facts or decisions, use the planning rules' Owner questions and
[question routing](ORCHESTRATING.md#route-questions); factory runs use their
own outcome table instead.
For `wontfix`, close with the reason: already implemented names its existing
code without a rejection record; rejected bugs get a polite explanation;
rejected enhancements use [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md), link their record,
then close. Apply `state:triage` for continuing evaluation; comment only when
there is partial progress.

## Reporter template

Post `## Triage Notes` with **What we've established so far:** listing resolved
points, then **What we still need from you (@reporter):** with actionable questions.

## Reads

Paths are relative to the repository root. Installed rule paths follow
Repository Standards' [rules reference](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/usage/rules.md).

- `.repo-standards/rules/planning.md`: policy named above; if absent use
  `CONTRIBUTING.md`; without both, report the gap and stop the dependent step.
- `.repo-standards/rules/comments.md`: posting sections named above; if absent,
  follow the step's shape and the installed issue-contract check's preambles.
- `.repo-standards/rules/github-repository-configuration.md` and installed
  `factory-workflow` rules,
  found with `repository-standards`: publication, labels, readiness and factory
  limits. If absent, use [AGENT-BRIEF.md](AGENT-BRIEF.md) for shape/categories
  and this skill for roles/outcomes; use no `model:` or `factory:` labels.
- The `codebase-design` skill: Ownership check for Seams and independent
  assessment; if missing, stop brief writing/acceptance and report the gap.
- `.agents/skills/implement/DELEGATION.md`: if missing, obtain before any research handoff.
- `docs/agents/issue-tracker.md`: tracker/scope; if absent, triage issues only
  and ask which tracker. `docs/agents/triage-labels.md`: label strings; if
  absent, use canonical roles.
- `.out-of-scope/`, with `.out-of-scope/<concept>.md`: if absent, none recorded;
  create on first rejection under [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md).
- `vendor/repo-canon/validate-issue-contract.mjs`, `operations/lib/factory-labels.mjs`
  and the `babysit` skill's GitHub connection: `ready.mjs` runtime; if missing,
  report the startup failure and stop at acceptance as [ACCEPT.md](ACCEPT.md#accept-a-brief-that-holds)
  says for credentials that cannot apply readiness; rerun once repaired.
- `.repo-standards/rules/factory-workflow.md` and `.scriptorium/config.json`
  at the destination default branch: `ready.mjs` model applicability/prefix;
  missing rules require no model label.
