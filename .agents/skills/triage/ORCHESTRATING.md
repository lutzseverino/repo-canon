# Orchestrating triage

Use `docs/agents/triage-labels.md` for label strings and installed GitHub rules'
Labels section for categories, states and priority. Flag conflicting states and
ask the maintainer before acting. For a PR, ready means a brief is attached and
an agent takes the next diff step.
Unlabeled issues normally enter triage, then a waiting state or `wontfix`. On new information, return waiting work to triage or the planning rules' Readiness state for answered ready work. Flag unusual transitions and ask before acting; the maintainer may override any time.

## Show what needs attention

Query the issue tracker and present three buckets, oldest first:

1. **Unlabeled**: never triaged.
2. **`state:triage`**: evaluation in progress.
3. **`state:reporter`, `state:grill` or `state:owner` with reporter activity or an owner decision since the last triage notes**: needs re-evaluation.

When PRs are in scope, include external PRs in these buckets and tag each line `[PR]` or `[issue]`. Discovery surfaces only _external_ PRs (the tracker config defines who counts as external), so a collaborator's in-flight PR is not triage work. This filter is discovery-only; an explicitly named PR is always triaged regardless of author.

Show counts and a one-line summary per item. Let the maintainer pick.

## Triage a specific issue or PR

Start with [Gather context](SKILL.md#gather-context) and
[Sort by uncertainty](SKILL.md#sort-by-uncertainty). Recommend category, path,
priority and state, each with a one-line reason; continue unless redirected.
Route redundancy, failed verification, missing facts and rejection through
[Other outcomes](SKILL.md#other-outcomes); otherwise take the request's path.

### Code-bound path

1. **Research.** Start the research run with the issue link, its path, [AGENT-BRIEF.md](AGENT-BRIEF.md), [the two checks](SKILL.md#gather-context), and this task: when the claim is confirmed, publish the agent brief through [Publication mode](SKILL.md#publication-mode), with triage notes and
   the installed comment rules' disclosure, and report any question it could not answer from code or logs instead of guessing at it.

2. Review under [REVIEW.md](REVIEW.md), then [accept](ACCEPT.md#accept-a-brief-that-holds).

### Intent-bound path

1. **Fact-finding.** Start the research run with the issue link, its path, [the two checks](SKILL.md#gather-context), and this task: gather the code facts the owner's decision needs (current behavior, constraints, prior decisions in the issue, ADRs, and glossary, and the options with what each would cost), and write no brief yet. Post its findings as a triage notes comment, as `.repo-standards/rules/comments.md#disclaimers` says, when the owner will read them on the issue.

2. **Infer what you can cite.** Answer each intent question the planning rules' inference test lets you answer, and record it as that test says. When you infer every one, have the research run write the brief from the facts and your inferred answers, then go to step 6.

3. **Route the remaining intent** under the planning rules' Decision rights and Owner questions sections. Start `/grill-with-docs` in its own session with the issue, code facts and dated decisions. Its other party is the delegated agent unless a reserved case requires the maintainer; without a delegated agent it is the maintainer. Leave unavailable decision makers their numbered questions in `state:grill`.

4. **Inspect the split evidence**: granularity, dependencies and factual/test-seam evidence. Use the planning rules' correction and fact-finding routes.

5. **Check publication** against the planning rules' Publication and amendments section. Inspect bodies, native links and copied decisions. The original intake's revised contract follows [Publication mode](SKILL.md#publication-mode); keep one authoritative contract for the work.

6. **Review and accept** each exact contract independently under [contract review](REVIEW.md) and [accept](ACCEPT.md#accept-a-brief-that-holds) it, using the direct specification/ticket shape rather than Agent Brief fields where applicable. Route open questions as [Route questions](#route-questions) says, and return settled questions to the writer for correction. Apply the planning rules' Readiness section and installed parent-readiness rules. For amendments, check the revised specification and delta contracts through this same review process under the planning rules' Publication and amendments amendment rules.

## Route questions

Every question reaches you first, whoever raises it: a research run, a grill, or an agent's issue comment, in any waiting state. Route it as the planning rules' Triage and Owner questions sections say:

- **An answer you can give**, from code, logs, or a reproduction, or under the inference test: post it on the issue as `.repo-standards/rules/comments.md#disclaimers` says.
- **A fact only an outside reporter holds**: ask them with the [reporter template](SKILL.md#reporter-template), and move the issue to `state:reporter`.
- **An owner-intent question**: move the issue to `state:grill` and route it to its grill session on the [intent-bound path](#intent-bound-path).
- **Other owner-only questions**: put operational decisions and chores in your decision inbox with your recommendation, and move the issue to `state:owner`.
- **An agent's question to the owner**, posted as `.repo-standards/rules/comments.md#owner-questions` says: read it first. When you can answer it, answer on the issue, and apply the next state the stop names, as the installed Questions and stops rule says, such as `state:ready` through [Apply and confirm readiness](ACCEPT.md#accept-a-brief-that-holds). Otherwise route it by the question types above.

When an answer changes the implementation contract, follow the planning rules' Owner questions section: a separate writer edits it.

## Quick state override

If the maintainer says "move #42 to state:ready", trust them: that is their review, not yours. Confirm what you're about to do (role changes, comment, close), then act. Skip grilling. Apply a readiness role through [Apply and confirm readiness](ACCEPT.md#accept-a-brief-that-holds), with the revision from the issue's current revision notice and the model and skip labels the installed rules ask for; when the command refuses your account, hand the maintainer those details instead. If moving to `state:ready` without a brief, ask whether they want one written.
