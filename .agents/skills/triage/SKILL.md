---
name: triage
description: Move issues and external PRs through a state machine of triage roles, sort each request by where its uncertainty lies, and bring its agent brief to acceptance through research and independent review, or through a grilling session with the owner. Also runs unattended as the factory's triage run, which writes nothing and ends with a run result.
disable-model-invocation: true
---

A prompt or brief naming this skill is its invocation.

# Triage

Move issues on the project issue tracker through a small state machine of triage roles, and bring each request you triage to an agent brief that holds.

If this repo treats external pull requests as a request surface (see the issue-tracker config), triage covers them too: **a PR is an issue with attached code**, using the same roles, same states, and same machine, with a few deltas marked "for a PR" below. Resolve a bare `#42` to an issue or PR per the tracker config.

Before every comment or issue body you post to the issue tracker during triage, read `.repo-standards/rules/comments.md#disclaimers` for its triage disclaimer. Each step below that posts names the section to read.

The contribution guide's Triage and Readiness sections and the installed rules decide routing, inference, acceptance, readiness, labels, and owner questions. This skill is how to carry them out: where a step names one of those decisions, apply it from there.

Follow `AGENTS.md`'s Agent skills requirements for delegation and session naming. Use the available naming capability separately from the command and task context. For each research run below, apply that rule to its research task and use the listed issue references and deliverables as task context. The issue comments below are its assigned research artifacts and destinations.

## Modes

- **Orchestrating agent**, the default: the maintainer invokes you, and you start research runs and grills. Every section below applies except [Factory triage run](#factory-triage-run).
- **Factory triage run**: the factory starts you as its triage run kind for one issue and gives you a path for its run result. Follow [Factory triage run](#factory-triage-run), with the sections it names, and nothing else.

## Reference docs

- [AGENT-BRIEF.md](AGENT-BRIEF.md): how to write durable agent briefs and the triage notes after them
- [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md): how the `.out-of-scope/` knowledge base works

## Roles

Two **category** roles:

- `type:bug`: something is broken
- `type:enhancement`: new feature or improvement

Five **state** roles, each naming whom the issue waits on, and one closing outcome:

- `state:triage`: triage needs to evaluate it
- `state:reporter`: its outside reporter, for a missing fact
- `state:grill`: a grilling session, for the owner's intent
- `state:owner`: the owner
- `state:ready`: an AFK agent
- `wontfix`: will not be actioned

For a PR, the same states read against the attached code: `state:ready` means a brief is attached and an agent should take the next step on the diff.

Every triaged issue should carry exactly one category role and one state role. If state roles conflict, flag it and ask the maintainer before doing anything else.

Set one `priority:` label as the installed rules' Labels section says.

These are canonical role names. The actual label strings are in the triage label configuration, `docs/agents/triage-labels.md`, and the installed `github-repository-configuration` rules hold their meanings.

State transitions: an unlabeled issue normally goes to `state:triage` first; from there it moves to `state:reporter`, `state:grill`, `state:owner`, `state:ready`, or `wontfix`. An issue waiting on someone returns to `state:triage` once the missing information arrives, or to the state the contribution guide's Readiness section names for answered ready work. The maintainer can override at any time; flag transitions that look unusual and ask before proceeding.

## Who does what

- **You, the orchestrating agent**: the session the maintainer invoked, in the role the contribution guide's Triage section gives it. You sort each request, start its research run, receive every question first, keep the decision inbox, and review and accept briefs.
- **The research run**: a sub-agent you start for one request, with a fresh context. It gathers facts and verifies the claim, then writes the brief once no intent question is open, unless a grill drafts it. Leave labels and the judgment of its brief to yourself.
- **The grill**: a grilling session with the owner, in its own session, for intent questions you cannot infer.
- **The owner**: holds the project's intent. Never ask them to finish a brief.

If you cannot start a sub-agent, do the research yourself, post the brief, and stop: tell the owner, with a link, that the brief still needs a reviewer who did not write it.

## Invocation

The maintainer invokes `/triage` and describes what they want in natural language. Interpret the request and act. Examples:

- "Show me anything that needs my attention"
- "Let's look at #42" (issue or PR)
- "Move #42 to state:ready"
- "What's ready for agents to pick up?"

## Show what needs attention

Query the issue tracker and present three buckets, oldest first:

1. **Unlabeled**: never triaged.
2. **`state:triage`**: evaluation in progress.
3. **`state:reporter`, `state:grill` or `state:owner` with reporter activity or an owner decision since the last triage notes**: needs re-evaluation.

When PRs are in scope, include external PRs in these buckets and tag each line `[PR]` or `[issue]`. Discovery surfaces only *external* PRs (the tracker config defines who counts as external), so a collaborator's in-flight PR is not triage work. This filter is discovery-only; an explicitly named PR is always triaged regardless of author.

Show counts and a one-line summary per item. Let the maintainer pick.

## Sort by uncertainty

Before any research, sort the request as code-bound or intent-bound by the contribution guide's Triage section. Its category label does not decide it. A bug whose report or documentation states what should happen is usually code-bound; a new capability, a "should" question, a limit, a default, a timeout, or a naming or scope call usually is not.

A request can move from code-bound to intent-bound when research turns up an intent question. It moves back only when the owner's answers, or answers inferred under the inference test, settle every such question.

## Triage a specific issue or PR

1. **Gather context.** Read the full issue or PR (body, comments, labels, author, dates; for a PR, the diff too). Parse prior triage notes and recorded owner decisions so you don't re-ask resolved questions. Read `.out-of-scope/*.md` and surface any that resembles this request (prior rejection). Read enough of the codebase, using the project's domain glossary and its ADRs, to sort the request. Pass any recorded owner-review reservation and its dated source to the brief's writer on either path.

Every research run, on either path, does two checks first:

- **Redundancy**: search for an existing implementation of the requested behavior by domain concept (not just the request's wording), and report where it looked.
- **Verify the claim.** For a bug, reproduce it from the reporter's steps. For a PR, confirm the diff does what it claims: check it out, run the relevant tests or commands. Report what happened: confirmed (with code path), failed, or insufficient detail.

2. **Recommend.** Tell the maintainer your category, path (code-bound or intent-bound), priority, and state recommendation with a one-line reason each. Continue unless they redirect you.

3. **Take the request's path**, below. Either path can end early: a redundant request is an already-implemented `wontfix`, a claim that fails verification or lacks detail waits on whoever holds the missing fact, and a rejected request is `wontfix` (see [Other outcomes](#other-outcomes)).

### Code-bound path

1. **Research.** Start the research run with the issue link, its path, [AGENT-BRIEF.md](AGENT-BRIEF.md), the two checks, and this task: when the claim is confirmed, post the agent brief, followed by its triage notes, on the issue as `.repo-standards/rules/comments.md#disclaimers` says, and report any question it could not answer from code or logs instead of guessing at it.

2. **Review.** Read the published brief as a reviewer who did not write it. Check it against the issue and the code yourself, not against the research run's own summary:
   - **Evidence**: each claim the brief rests on traces to a code path, a reproduction, or the issue. Spot-check the one the change depends on. Verify every required input under [Available inputs](AGENT-BRIEF.md#available-inputs).
   - **Scope**: desired behavior is what the request asks for; nothing the request needs is dropped, nothing beyond it is added, and out of scope names the adjacent work an agent might reach for. Work that must be shown on a live system is split as [AGENT-BRIEF.md](AGENT-BRIEF.md#live-acceptance-gets-its-own-ticket) says.
   - **Acceptance criteria**: each is concrete, testable, and independently verifiable, and together they cover the edge cases the request and the code expose.
   - **Dependencies**: work that must land first is named, so it can be recorded as a blocker.
   - **Open questions**: none remain, including missing required inputs. Route unavailable material as [Route questions](#route-questions) says. An open intent question means the request is intent-bound; switch paths.

   Passing the issue-contract check proves the shape, never that the brief holds. When it does not hold, send the research run the specific corrections; it edits the brief, and you review the new revision from the top.

3. **Accept** it, as below.

### Intent-bound path

1. **Fact-finding.** Start the research run with the issue link, its path, the two checks, and this task: gather the code facts the owner's decision needs (current behavior, constraints, prior decisions in the issue, ADRs, and glossary, and the options with what each would cost), and write no brief yet. Post its findings as a triage notes comment, as `.repo-standards/rules/comments.md#disclaimers` says, when the owner will read them on the issue.

2. **Infer what you can cite.** Answer each intent question the contribution guide's inference test lets you answer, and record it as that test says. When you infer every one, have the research run write the brief from the facts and your inferred answers, then go to step 6.

3. **Grill the owner** on the questions you cannot infer, in a grilling session of its own. Open it with `/grill-with-docs` using the session's supported invocation, followed by task context: the issue links, the facts, your inferred answers, the recorded owner decisions, unresolved questions, scope and [AGENT-BRIEF.md](AGENT-BRIEF.md). Include the owned branch and checkout for domain-document edits, the per-repository pull request destinations and the workbench destination required by the contribution guide's Triage section. Its deliverables are the decision record and draft briefs in a proposed ticket split, with the report-back destination. When the owner cannot join a grill now, put the request in your decision inbox with your recommendation.

4. **Decide the split** as the contribution guide's Triage section says, and send any draft your split changes substantially back to the grill, or to a research run when it needs code facts the grill did not gather.

5. **File** the issues with the grill's briefs: post each brief on its intake issue, or file a new issue for it, as `.repo-standards/rules/comments.md#disclaimers` says, with the owner decisions it relies on pasted from the grill record into its triage notes.

6. **Review** each brief as on the code-bound path, and refuse one that leaves owner intent open as the contribution guide's Triage section says. Route each such question as [Route questions](#route-questions) says, and accept only once every one the owner must answer is answered. A question a recorded decision already settles goes back to the brief's writer as a correction instead.

7. **Accept** each brief that holds, as below.

### Accept a brief that holds

1. **Wait for the revision notice** for the brief revision you reviewed, as the contribution guide's Readiness section says. If the brief changed after your review, review the new revision. If no notice arrives, leave readiness to the owner and tell them the notice is missing.
2. **Choose the state** the installed rules give the work:
   - `state:owner` for work only the owner can do. It is not readiness: apply it with the tracker's own client and a note naming what the owner must supply, and skip the readiness command.
   - `state:ready` with `factory:skip` for agent work the installed factory rules say the factory must not pick up. Without those rules there is no skip label.
   - `state:ready` alone for any other work.

   When owner review before merge is reserved, verify that the brief explicitly designates it as contract behavior and its triage notes retain the dated decision source. Check this even when that reason first arises here, after the initial brief review. If the designation or its source is missing or unclear, return the brief to its writer with the recorded reservation and source; the writer corrects it. Independently review the corrected brief from the top, then return to step 1 for its new validator revision notice before applying readiness.

3. **Choose the model**, when the installed rules ask for a `model:` label: weigh the triage notes' suggestion against the work, and pick one label yourself. Keep a matching model already on the issue, or remove a conflicting one before applying readiness.
4. **Apply and confirm readiness** with the bundled command, using the `sha256:` revision from the notice you reviewed and the companion labels you chose:

   ```sh
   node <this skill's directory>/ready.mjs <issue> <sha256:reviewed-revision> <model-label>
   ```

   The command applies `state:ready`. Omit the model label when the installed rules ask for none. Additional companion labels, such as `factory:skip`, follow the revision; `--repo owner/name` selects another repository. Run it with Node.js 24 or 26 in the foreground, bounded by your command timeout; it uses the current `gh` credential and needs no install step. It reads the destination's factory configuration at its default branch to tell whether a model label applies, and creates a missing chosen model label. Exit zero confirms the validator approved that revision by your account; a nonzero exit explains the refusal or rejection. Review a changed revision again before retrying. For a parent it waits for the latest child link and reapplies readiness when needed.

5. **Record blockers.** Add a native blocker for each issue whose work must land first.
6. **Tell the owner** what you accepted, with links to each brief, the labels you applied, the blockers you added, and every answer you inferred, so they can veto it.

When your credentials cannot apply readiness, or the destination's factory workflow rules say its factory starts no work on your account's readiness, stop at acceptance: tell the owner or another authorized person, with links, which revision holds, the readiness, model and skip labels you chose, and the blockers to record, and report that factory work has not started.

## Factory triage run

The factory starts this run for one issue, read-only, and the installed factory workflow rules' Triage run section sets its limits. There is no orchestrating agent, research run, grill or workbench to hand anything to: you research, write and review the brief yourself, and everything you produce goes into one run result, which the factory posts and turns into labels.

1. **Gather context** as [Triage a specific issue or PR](#triage-a-specific-issue-or-pr) step 1 says, and run its two checks first, yourself. Read the repository's ADRs, its glossary, and the issues the request links, with their decisions: the records the Triage run section lets you cite.
2. **Sort** the request as [Sort by uncertainty](#sort-by-uncertainty) says. Answer each intent question the inference test lets you answer from those records, and list it with the record and its date under **Inferred intent** in the triage notes.
3. **Choose the outcome** the Triage run section names, with the labels it lists, and write its body:
   - `state:ready`: write the Agent Brief and its triage notes as [AGENT-BRIEF.md](AGENT-BRIEF.md) says, review them as the [code-bound path](#code-bound-path)'s step 2 says, and correct them until they hold. Choose the `model:` label from the models the factory's run facts list, or from any when they list none.
   - `state:reporter`: the [reporter template](#reporter-template).
   - `state:owner`: the question and what you found.
   - `state:grill`: the facts gathered (current behavior, constraints, the records you read, the options and what each would cost) and the open questions, numbered.
4. **Write the run result** to the path the factory gives, in the format its run-result interface defines: the state and labels you ask for, and the body, with no disclaimer, as `.repo-standards/rules/comments.md#disclaimers` says. When you cannot finish, write a failed result with the reason.
5. **Write nothing else**, as the Triage run section says, even where a credential would allow it: a reproduction stays in your sandbox, and `ready.mjs` never runs.

## Other outcomes

Before posting a comment for any outcome below, read `.repo-standards/rules/comments.md#disclaimers`.

- A missing fact or decision: route it as [Route questions](#route-questions) says; for a question to an outside reporter, post triage notes (template below).
- For `wontfix`, close the issue, with the comment depending on *why*:
  - **Already implemented**: the change already exists in the codebase. Point to where it lives; do **not** write to `.out-of-scope/` (that KB is for *rejected* requests, not built ones).
  - **Rejected (bug)**: give a polite explanation, then close.
  - **Rejected (enhancement)**: write to `.out-of-scope/`, link to it from a comment, then close ([OUT-OF-SCOPE.md](OUT-OF-SCOPE.md)).
- `state:triage`: apply the role. Optional comment if there's partial progress.

## Route questions

Every question reaches you first, whoever raises it: a research run, a grill, or an agent's issue comment, in any waiting state. Route it as the contribution guide's Triage section says:

- **An answer you can give**, from code, logs, or a reproduction, or under the inference test: post it on the issue as `.repo-standards/rules/comments.md#disclaimers` says.
- **A fact only an outside reporter holds**: ask them with the reporter template below, and move the issue to `state:reporter`.
- **An owner-only question**: put it in your decision inbox with your recommendation, and move the issue to the state the guide names.
- **An agent's question to the owner**, posted as `.repo-standards/rules/comments.md#owner-questions` says: read it first. When you can answer it, answer on the issue, and return the issue to the state the installed rules name for an answered question, such as `state:ready` through [Apply and confirm readiness](#accept-a-brief-that-holds). Otherwise put it in your decision inbox.

When an answer changes the implementation contract, follow the contribution guide's Owner questions section: a separate writer edits it.

## Quick state override

If the maintainer says "move #42 to state:ready", trust them: that is their review, not yours. Confirm what you're about to do (role changes, comment, close), then act, posting any comment as `.repo-standards/rules/comments.md#disclaimers` says. Skip grilling. Apply a readiness role through [Apply and confirm readiness](#accept-a-brief-that-holds), with the revision from the issue's current revision notice and the model and skip labels the installed rules ask for; when the command refuses your account, hand the maintainer those details instead. If moving to `state:ready` without a brief, ask whether they want one written.

## Reporter template

```markdown
## Triage Notes

**What we've established so far:**

- point 1
- point 2

**What we still need from you (@reporter):**

- question 1
- question 2
```

Capture everything resolved so far under "established so far" so the work isn't lost. Questions must be specific and actionable, not "please provide more info".

## Resuming a previous session

If prior triage notes exist on the issue or PR, read them and the recorded owner decisions, check whether the reporter or owner has answered any outstanding questions, and present an updated picture before continuing. Don't re-ask resolved questions.

## Reads

Paths are relative to the repository root. The installed rules' paths follow
Repository Standards'
[rules reference](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/usage/rules.md).

- `CONTRIBUTING.md`: its Triage, Readiness and Owner questions sections. When
  it is missing, carry out this skill's method as written, and ask the owner
  for any rule the method leaves to the guide.
- `.repo-standards/rules/comments.md`: the installed comment rules, whose
  sections the posting steps name. When it is missing, post as each step
  describes; the issue-contract check, where installed, names the disclaimer
  an Agent Brief needs.
- The installed rules, such as the `github-repository-configuration` and
  factory workflow rules, which the `repository-standards` skill looks up.
  When they are missing, take the brief's shape from
  [AGENT-BRIEF.md](AGENT-BRIEF.md) and the role meanings from this skill, and
  apply no `model:` or `factory:` label.
- `AGENTS.md`: its Agent skills requirements for delegation and session
  naming. When it is missing, give each research run only its task context,
  and name the session for its operation and target where naming is
  supported.
- `docs/agents/issue-tracker.md`: the issue-tracker config, including whether
  external pull requests are a request surface. When it is missing, triage
  issues only, and ask the user which tracker to use.
- `docs/agents/triage-labels.md`: the label string for each role. When it is
  missing, use the canonical role names as the label strings.
- `.out-of-scope/`, holding `.out-of-scope/<concept>.md` files: requests
  rejected before. When it is missing, none were; create it with the first
  rejection, as [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md) says.
- `scripts/validate-issue-contract.mjs`, Repo Canon's issue-contract
  validator, and the `babysit` skill's GitHub connection: `ready.mjs` imports
  both. When either is missing, `ready.mjs` cannot start: stop at acceptance,
  as when your credentials cannot apply readiness.
- `.repo-standards/rules/factory-workflow.md` and `.factory/config.json` at
  the destination's default branch: `ready.mjs` reads both to tell whether a
  model label applies and its prefix. When the rules are missing there, it
  requires no model label.
