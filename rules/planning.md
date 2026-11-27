# Planning rules

These rules govern intake, decision rights, contract publication and acceptance,
findings and questions throughout the repository. The contribution guide holds
implementation and delivery requirements; the installed `comments` rules hold
what is posted on issues and pull requests. Label meanings and authorization
live in the `github-repository-configuration` rules' Labels and Readiness roles
sections; factory-specific limits live in the `factory-workflow` rules.

## Decision rights

The maintainer originates ideas and approves each plan's goal and Done means.
The maintainer's delegated agent decides downstream technical design,
mechanisms, sequencing, scope cuts inside the approved goal, factory and
orchestrator rules and the grills they raise. It answers its own rounds with
independent review by a different provider, lists each decision for veto in its
next update, and silence stands. Without a delegated agent, the maintainer
decides.

A grill opens with the maintainer only when:

1. The maintainer asks.
2. A decision changes what the maintainer asked for: the goal, a Done-means
   clause, or dropping something wanted.
3. It is hard to reverse and reaches outside the maintainer's own repositories:
   names or formats others' code depends on, a breaking release for outside
   users, deleting repositories or data, money or new accounts, or a security
   trade-off adopters live with.
4. It needs the maintainer's taste, credential, device or presence.
5. Two recorded maintainer decisions conflict and neither code nor records
   settle which wins.

## Triage

The triager routes an intake request by where its uncertainty lies, not by its
category label. A request is code-bound when its expected result is clear and
code, logs or a reproduction can answer the rest. It is intent-bound when an
open question needs intent, a policy, a trade-off or taste in copy, UI or look,
as when its brief would otherwise leave an open question or offer options,
including a bug whose fix would choose a value nobody chose. Missing evidence or access never
licenses inventing policy. The triager verifies claims and gathers code facts
before seeking an intent decision.

### Inference test

A triager may infer an answer only when all three hold:

- It cites a dated approved goal, recorded maintainer decision or wish, or the
  maintainer's quoted words as its source.
- It is reversible within that work: no value or policy outlives it, and it adds
  no public name or breaking change.
- It changes neither the goal nor the scope.

A triager never infers a persistent default, limit, timeout or fallback. The
brief states each inferred answer as behavior; its triage notes list each with
its dated citation under **Inferred intent**, for veto. A veto is a maintainer
decision and the writer revises the brief from it.

What the test leaves open goes to the delegated agent's own grill, unless one
of Decision rights' five cases requires the maintainer. Without a delegated
agent, the maintainer decides. This test constrains the triager, not the
delegated agent's reviewed grill.

The maintainer's ideas take conversation and a grill unless the maintainer
approves a shorter path for that idea; filed requests take triage. Grill
sessions reuse recorded answers, gather missing facts and apply Decision
rights to choose who answers their rounds. Grill answers and plan approval
remain gates.

## Publication and amendments

The grill's brief writer publishes through `to-spec`, then `to-tickets`, for
independent review. The maintainer or their delegated agent decides the final
split: merging, splitting, dropping or setting aside drafts. A reviewer who
wrote none of a contract accepts it. Substantial split changes return to the
writer; missing code facts go to independent research.

Each direct body contract states `Supersedes:` (ADRs, issues), `Adds:` and
`Deletes:` (durable surfaces, never paths). Readiness waits for a fate on each
open issue a specification supersedes, directly or by ADR. One specification
lives in the repository containing most work; tickets in their responsible
repositories are its native sub-issues with blockers. Writers copy relied-on
decisions, dates and quotes into every contract. A failed native edge stops
progression: report the exact missing relationship and platform failure.

Review checks evidence, scope, granularity, dependencies, acceptance criteria,
test seams and open questions without an intent quiz or settled-seam
confirmation. Reviewers reject unresolved or disguised intent and return
settled questions for correction. Structure and publication grant no readiness.
Apply Readiness to each exact contract, parent readiness after tickets under
the installed factory rules' Parent readiness section, and closed blockers
before implementation.

Changes to a plan's goal, Done means or row scope require an amendment grill,
possibly one round. The writer revises the specification, then invokes
`to-tickets` on the delta, updating affected contracts and native links. Edited
accepted contracts need independent review again. Findings, follow-ups passing
the triager's inference test and reorderings already permitted by blockers
need no amendment. Decision rights determines who answers an amendment grill.

## Readiness

Applying `state:ready` is the review action, and the
`github-repository-configuration` rules name the roles it needs, the factory
triage run's exception to them for its own brief and for a direct contract it
reviewed, and the labels. After revising a contract or
posting an Agent Brief, wait for the issue-contract workflow's revision notice
before applying readiness. Editing a contract removes its readiness. The workflow keeps one workflow state label on
an issue, a `state:` label or the closing `wontfix` in its place: authorized
readiness or a newly applied state replaces the previous one, and an issue left with none gets
`state:triage` on every run, even if it has never carried a state. This applies
to open intake requests, specifications, tickets, and unrecognized issues;
Wayfinder maps and children stay outside workflow states. The validator's own
`state:triage` is a fallback and never supersedes authorized readiness bound to
the current revision, even when applied after its review. A person's later
workflow state still supersedes readiness. A closed issue loses every
`state:`, `gate:` and `factory:` label, preserving `wontfix`, `type:`,
`priority:`, `model:`, unrelated labels and feedback. Reopening restores no
removed labels; normal validation applies.
Reviewers apply readiness through `triage`'s bundled `ready.mjs`; success
confirms the validator approved the reviewed revision for the acting account.
Without the matching notice or authority, leave readiness to the maintainer
and report the missing requirement under the comment rules. A specification
or ticket can be ready while its blockers are open.

## Findings

Contributors note out-of-scope observations in the pull request body or the
run's result, not as issues. They open an issue only for one that blocks an active goal or causes
harm (security, data loss, a broken default branch), after checking for an
existing one, in the responsible repository with `state:triage`.

Park a person's idea as an issue only when they ask. Search the responsible
repository's tracker first and reuse an existing issue. File it with
`state:grill` only when they want it decided; otherwise file an ordinary issue
at `priority:low`.

A factory run cites its filing run in each issue it files, and never opens a
separate unticketed pull request for out-of-scope work, however small.

## Owner questions

The triager routes a fact only an outside reporter holds to that reporter with
`state:reporter`. Remaining intent takes the grill route in Decision rights;
the triager records `state:grill` with the gathered facts and open questions.
A question only the maintainer can answer, or work requiring their credential,
device or presence, goes to the maintainer with a recommendation and
`state:owner`. A disposition settled by another record or ticket is cited with
`state:carried` under the GitHub rules' Labels section and, in a factory run,
the factory rules' Triage run limits. The triager never invents a disposition
when no record settles it.

A contributor needing a maintainer answer posts the question under the
installed `comments` rules' Owner questions section and stops, without a pull
request if none is open, or leaving the existing pull request unmerged and
linked from the question. This handoff ends the contributor's babysitting;
they neither close the pull request nor wait for an answer. Continuation
follows applicable installed rules.

If an answer changes the implementation contract, a separate writer edits it;
continuation waits for its validator notice, independent review and renewed
readiness. An unchanged contract needs no new contract review.
