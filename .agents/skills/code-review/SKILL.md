---
name: code-review
description: 'Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo''s documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".'
---

A prompt or brief naming this skill is its invocation.

Review a pinned diff on two independent axes, using parallel sub-agents:
**Standards** checks documented standards; **Spec** checks the originating
implementation contract. Report them separately so neither masks the other.

## Process

### 1. Pin the fixed point

Ask for a fixed point if none was supplied. Resolve it and `HEAD` to full
commit SHAs with `git rev-parse --verify <ref>^{commit}`; pin
`<comparison-base-sha>` with `git merge-base <fixed-point-sha> <head-sha>`.
Capture `git diff <comparison-base-sha> <head-sha>` and
`git log <fixed-point-sha>..<head-sha> --oneline` once. Use these SHAs for
ownership facts and both axes even if refs move. Resolve bad refs or an empty
diff before starting sub-agents.

### 2. Identify the spec source

Search in order:

1. Issue references in commit messages (`#123`, `Closes #45`, GitLab `!67`),
   fetched through `docs/agents/issue-tracker.md`. Follow its
   [Read an issue](../../../docs/agents/issue-tracker.md#conventions) guidance
   for the validator-selected contract revision and prepared/body-mode rules,
   including the eligible legacy exception. Review that contract; other
   discussion is context.
2. A path the user supplied.
3. A spec under `docs/`, `specs/`, or `.scratch/` matching the branch or feature.
4. Ask where the spec is. If none exists, skip the Spec sub-agent and report
   "no spec available".

### 3. Identify the standards sources

Find repository standards such as `CODING_STANDARDS.md` and `CONTRIBUTING.md`.
Always include the following Fowler smell baseline (_Refactoring_, ch.3),
including when the repository documents nothing. Repository standards override
it; suppress conflicting smells. Smells are labelled heuristics ("possible
Feature Envy"), always judgement calls, never hard violations. Skip anything
tooling enforces.

Match each smell and remedy against the diff:

- **Mysterious Name**: a name hides its meaning. → rename; no honest name suggests unclear design.
- **Duplicated Code**: repeated logic across hunks or files. → extract and share.
- **Feature Envy**: a method uses another object's data more than its own. → move it there.
- **Data Clumps**: fields or parameters travel together. → bundle into a type.
- **Primitive Obsession**: a primitive represents a domain concept deserving a type. → introduce that type.
- **Repeated Switches**: repeated conditionals on one type. → use polymorphism or a shared map.
- **Shotgun Surgery**: one change scatters edits. → gather related behavior into one module.
- **Divergent Change**: one module changes for unrelated reasons. → split by reason.
- **Speculative Generality**: abstraction, parameters or hooks without a spec need. → delete or inline.
- **Message Chains**: navigation callers shouldn't know. → hide the walk behind a method.
- **Middle Man**: mostly delegates. → call the target directly.
- **Refused Bequest**: a subclass or implementer ignores or overrides most inherited behavior. → use composition.

### 4. Collect ownership facts

From the repository root, run:

```sh
node <this skill's directory>/ownership-facts.mjs <comparison-base-sha> <head-sha>
```

Requires Node.js and Git with `check-attr --source` support. Exit `0` returns
a JSON fact list, possibly empty; exit `1` reports an error to resolve before
review. Facts are evidence, never automatic triggers or ownership verdicts.

Read `codebase-design`'s [Ownership check](../codebase-design/OWNERSHIP.md).
Give Standards the reference and fact list; give Spec the reference for its
cleanup allowance. Report a missing skill dependency rather than inventing
ownership rules.

### 5. Spawn both sub-agents in parallel

Give both agents the pinned diff command and commit list, the PR body (proposed
body for work in progress), and `codebase-design`'s Ownership check reference.
Give Standards the fact list, standards-source paths and the full smell
baseline from step 3; its isolated context cannot otherwise access them.

**Standards prompt:** "Report per file/hunk: (a) every documented-standard
violation, citing its file and rule; (b) baseline smells, naming each and
quoting the hunk. Distinguish documented violations from smell and ownership
judgement calls. Repository standards override smells; skip tooling-enforced
checks. Apply the Ownership check using the facts as evidence. Check whether
existing ownership problems in touched code were fixed, noted or filed under
that reference. Recognize its permitted cleanup listed on its own PR-body line;
route other out-of-scope defects through the planning rules' Findings route.
Judge against the recorded contract. Under 400 words."

Give Spec the spec's path or fetched contents.

**Spec prompt:** "Report: (a) missing or partial requirements; (b) unrequested
behavior; (c) incorrectly implemented requirements. Quote the spec line for
each finding. Cleanup permitted by the Ownership check and listed on its own
PR-body line is allowed. Route other out-of-scope defects through the planning
rules' Findings route. Judge against the recorded contract. Under 400 words."

### 6. Aggregate

Present the reports under `## Standards` and `## Spec`, verbatim or lightly
cleaned. Keep their findings separate without merging or reranking. End with
one line giving each axis's finding count and worst issue, if any; pick no
winner across axes.

## Reads

Paths are relative to the repository root.

- `.repo-standards/rules/planning.md` in the target repository: planning
  policy. If absent, use that repository's `CONTRIBUTING.md`; if both are
  absent, report the missing policy and stop the dependent step.
- `docs/agents/issue-tracker.md`: issue fetching and authoritative contract
  selection. When missing and no tracker was provided, use step 2's other
  spec sources without blocking review.
- A spec under `docs/`, `specs/` or `.scratch/`. When missing, ask for it as
  step 2 directs.
- `CODING_STANDARDS.md`, `CONTRIBUTING.md` and other repository standards.
  When missing, Standards uses only the smell baseline.
- The `codebase-design` skill: Ownership check for both prompts. When missing, report
  the dependency as above.
- `vendor/` and `.gitattributes`: pinned-tree collector evidence. Missing
  paths or attributes contribute no vendored facts; ordinary diff paths still
  participate in new-file facts.
