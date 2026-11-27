---
name: factory
description: Hand ready tickets to the factory, resolve holds, resume stopped work, deliver skipped work, or pause and resume one repository.
---

A prompt or brief naming this skill is its invocation.

In the served repository, read its planning rules (contribution guide if absent),
`CONTRIBUTING.md`, installed `factory-workflow`, `github-repository-configuration`
and `comments` rules, and `.scriptorium/config.json` before acting.
Use configured label roles. Read the issue's authoritative contract, comments,
blockers, and PR and handoff before choosing a path.

## Hand a ready ticket to the factory

1. Check the contract's accepted revision and its validator notice, parent
   readiness and open blockers under the guide and installed rules. Resolve
   missing required inputs before seeking readiness.
2. Follow the installed `factory-workflow` rules' **Model selection**, weighing
   triage's suggestion and recording the guidance-based reason. Ask the host
   operator to resolve an unavailable or disallowed model.
3. Apply the readiness policy through `triage`'s readiness command. With an App
   or bot credential in a factory repository, hand the reviewed revision,
   suggested readiness, model and route labels, and blockers to an authorized
   person. Report pickup only when the factory actually records it.
4. For a held parent, follow the installed rules' **Parent readiness**:
   under the latest-link-time fallback, wait for the latest timeline link,
   then remove and re-add readiness after its timestamp.

## Read a hold

Read the factory's run comment and current labels first. Match the reason
rather than clearing a state label to see what happens:

| Observation | Next action |
| --- | --- |
| Refused readiness or parent not ready | Verify the exact revision and the authorized person's readiness, then the parent's contract and link history. |
| Model-label error | Reconcile the ticket's single model label with the chosen model; ask the host operator about resolvability or the allowlist. |
| Repository configuration refused | Ask the host operator to verify the serving release and configuration acceptance. Keep the issue's evidence available. |
| Open blockers, capacity or usage drain | Resolve blockers or wait for the host's gate to clear; no label reset bypasses it. |
| Repository or release hold | Find the labelled open items and use Pause and resume below. |
| Running or paused | Read the run comment; the factory owns the run and its automatic resumption. |
| A `state:` stop | Use Resume stopped work below. |
| Failed | Address the failure the run comment names first, then remove the failed label to request a retry subject to pickup gates. |
| Skip | Use the directly launched path below; clearing a waiting marker does not request a factory retry. |

If no comment explains a held issue, ask the host operator for its reason; a
host with no cached valid configuration cannot comment on the issue. Keep
credentials and secret host material out of tracker records.

## Take the skip route

Follow the installed `factory-workflow` rules' **Skipped work** for eligibility,
grant ownership, live acceptance and merge ownership. Arrange ready, model and
skip labels through `triage`'s readiness command; rerun it for missing skip/model
labels on approved readiness. Launch `implement` directly with the contract,
evidence, decisions, issue link and delivery role. Continue as the orchestrating
agent through `babysit` from the worker's
Delivery handoff (`.repo-standards/rules/comments.md#delivery-records`);
apply its current-head owner-approval gate when designated.

For an unanswered owner question, retain the skip marker and the question's
workflow state.
After resolution and required renewed readiness, resume the worker if no PR
exists, or continue the existing PR and handoff.

In the contribution guide's split case, launch the live-acceptance worker through
this route to record acceptance on its ticket under
`.repo-standards/rules/comments.md#disclaimers` and report back, without a PR.

## Resume stopped work

Answer the question through the planning rules' owner-question route, posting as
`.repo-standards/rules/comments.md#disclaimers` says, and meet the installed
Questions and stops rule's conditions for a changed contract. Then apply the
exact next state the stop names, or close the issue, as that rule says: never
clear another label for it, and never merge the stopped PR by hand. For skipped work,
continue as Take the skip route says instead.

## Pause and resume one repository

Follow the installed `factory-workflow` rules' **Repository and release holds**
for pickup, merge and exemption semantics.

1. Read configured `labels.hold` and locate every labelled open issue/PR.
   If absent, arrange compatible configuration with the owner before pausing.
   Distinguish repository, release and per-run holds.
2. Put the hold on the expedited PR, or its issue until opened. Record why
   and which change carries it under
   `.repo-standards/rules/comments.md#disclaimers`.
3. Launch a worker directly or implement as the orchestrating agent outside
   pickup; an already-open factory PR uses its exempt merge relaunch.
4. Transfer an issue hold to the PR by adding before removing; verify both
   items. Inspect other open items carrying either configured hold before merge.
5. Invoke `babysit` for validation, reviews and merge authorization. To resume
   without merging, remove only the deliberate pause's hold; leave other
   owners' holds alone. Confirm no remaining open hold and report the state.

<!-- Seam (deferred): Scriptorium configuration reads; consumers: 6; extraction proposed in https://github.com/lutzseverino/repo-canon/issues/967. -->

## Reads

Paths are relative to the repository root.

- `.repo-standards/rules/planning.md` in the target repository: planning policy
  named by this skill. If absent, use that repository's `CONTRIBUTING.md`;
  if both are absent, report the missing policy and stop the dependent step.

- `CONTRIBUTING.md`: contract, delivery and credential
  requirements. When it is missing, use the installed rules and
  hand off any unresolved delivery or authorization question on the issue or PR.
- The installed `factory-workflow` and `github-repository-configuration` rules,
  located with `repository-standards`. When they are missing, use the guide
  and configured roles; ask the owner before a route or merge-ownership decision
  that those sources do not settle.
- `.repo-standards/rules/comments.md`: the installed comment rules, whose
  sections the posting steps name. When it is missing, post each record the
  steps name as one comment.
- `.scriptorium/config.json`: configured label roles. When it is missing or
  unreadable, perform read-only diagnosis and ask the owner to establish the
  factory configuration before changing factory labels.
