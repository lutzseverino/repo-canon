# Factory workflow rules

These rules apply to all work in a repository a factory serves, including
tracker work that changes no file. The contribution guide holds the general
implementation contract, readiness, owner-question, credential and pull request
requirements, and the `comments` rules hold what agents and the factory post on
issues and pull requests. The `factory` skill holds the method for handing work
to the factory, interpreting holds, delivering skipped work, and pausing or
resuming one repository.

## Run kinds

The factory runs up to three run kinds in a repository. `.factory/config.json`
turns each one on under `runKinds` and maps it to a skill and that skill's
arguments:

- **Triage** researches one issue and ends with its Agent Brief or the
  question that stops it, changing no code, as Triage run says.
- **Implement** takes a ready issue to a draft pull request.
- **Review** reviews that draft pull request as an agent that wrote none of
  it, under the `github-repository-configuration` rules' Review of an
  implemented pull request section, and delivers it to its merge.

Every kind is optional, and implement is the minimum. Without triage,
readiness comes only from a person; without review, the implement skill
delivers and merges its own pull request. Triage and review run on the
provider, model and effort the configuration names for them; implement runs on
the issue's `model:` label, as Model selection says. The review's
`differentProvider` switch asks for a provider other than the one that
implemented the change, where the host has one. No configuration changes the
rest: triage runs read-only, review is the only run kind that merges, and each
run ends with a run result that the factory posts and turns into labels.

## Handoffs

Work moves from one run kind to the next through the issue's workflow state
and its pull request:

1. **Trigger.** Triage starts when a person whose current repository role the
   host configuration authorizes opens the issue or applies `state:triage`. An
   agent working on that person's account counts as that person. The
   issue-contract workflow's own fallback application never triggers triage,
   so an outside reporter's issue waits for such a person.
2. **Triage** ends with `state:ready` and the labels readiness needs, or in a
   `state:` stop.
3. **Readiness** starts implement when a person applied it, or the factory's
   own triage run did as the GitHub rules' Readiness roles allow. Readiness any
   other bot or App applies never starts a run, even when the validator
   approves it. An orchestrating agent working through such an account applies
   no readiness there: it stops at acceptance, as the `triage` skill
   describes, and never reports that factory work started.
4. **Implement** ends at a draft pull request, which starts review on it.
5. **Review** ends in a merge, a hand-back to implement on the same pull
   request, a stop at an owner gate, or a `state:grill` stop for a wrong or
   ambiguous contract. When its rounds do not converge, the issue gets
   `factory:failed`.
6. **A `state:` stop** leaves the issue with whoever must answer until it is
   back in `state:ready`, as Questions and stops says.

## Implementation inputs

An Agent Brief's required inputs must be in the repository, the issue and its
comments, or public URLs. Before readiness, check material originating on a host
for secrets and post the non-secret material on the issue, quoted or attached.
A host-only path cannot be the sole required source. Independent acceptance
review checks input availability like the brief's other requirements; a passing
structure check alone grants no readiness. This boundary requires no change to
sandbox access.

## Parent readiness

A parent (a specification or any issue with sub-issues) never runs; its
readiness releases its tickets, which each also need their own readiness.
Parenthood grants no Agent Brief exemption: a non-specification parent with a
`type:` label needs its own complete Agent Brief and revision-bound
readiness under the contribution guide and issue-contract validator.

With complete sub-issue link actor history, later links preserve the parent's
readiness only when every addition at or after readiness was made by a person
the readiness policy authorizes. Bot, excluded, unauthorized, unknown or
unreadable actors, and unknown link times, hold the parent. A later authorized
link never cancels an earlier unauthorized one. Body edits and Agent Brief
revisions still require the applicable review and renewed readiness.

Platforms without that history use the latest-link-time fallback: apply the
parent's readiness after its tickets are published, and again when a ticket is
published later. Renewed readiness is valid only once the latest ticket link
appears in the parent's timeline. Readiness recorded in the same second as that
link holds the tickets. A platform reporting no link times skips the link
check; contract-review and authorization gates still apply.

## Model selection

The factory picks up ready issues and runs each ticket on its own. In a
repository a factory serves, whoever applies `state:ready` to a non-parent
issue must apply exactly one `model:` label they chose, before readiness or
together with it, even when it names the host's default model. A parent needs
no `model:` label of its own.

Work needing design judgment, ambiguous scope or a long cross-cutting change
uses a stronger model. The chosen model label uses
`model:<slug>` or `model:<provider>/<slug>`, optionally followed by
`@<effort>`; create the label if the repository lacks it. A `claude-*` or
`gpt-*` slug needs no provider. Create missing model labels with color
`5319e7` and description `Factory model: <model>` where `<model>` is the label
name after `model:`. Preserve an existing repository label unchanged. Triage's
readiness command provisions the chosen label before applying readiness; a
lookup or creation failure grants no readiness. The command accepts a matching
model already on the issue and refuses zero or conflicting models for
non-parent agent readiness.

For a non-parent issue in a repository a factory serves, the triage notes after
its Agent Brief suggest one `model:` label with a one-line reason, for the
reviewer to apply or replace. The suggestion is a triage note, not a field of
the brief. An orchestrating agent that accepts the brief is that reviewer: it
chooses the label itself, weighing the suggestion, and the research run that
suggested it applies no label. The factory's triage run chooses its own, as
Triage run says.

The factory runs an unlabelled ticket on the host's default model; a parent's
label chooses none of its tickets' models.

The host operator may set an optional `models.allowed` list in the host
configuration. It is a nonempty list of unique, resolvable provider/model names without
`@<effort>` and must include the default and retry models when set; membership
compares provider and model, ignoring effort. An absent list adds no membership
restriction. A `model:` label outside the list holds the issue with a visible
model-label reason, never falling back to another model. The same hold applies
to a relaunch whose recorded model is no longer listed. The host operator
maintains the list; default and retry models alone do not define a catalog.

## Triage run

The factory's triage run triages one issue with the `triage` skill, with no
orchestrating agent, workbench or decision inbox. It reads and never writes:
it posts nothing, applies no label, pushes nothing and attempts no fix. Its run
result asks the factory to post its brief or question and to apply the labels
it chose, never a `gate:` label.

It applies the contribution guide's inference test with sources recorded only
in the repository: its ADRs, its glossary, and linked issues and their
decisions, each cited with its date. The brief's triage notes list every
inferred answer for the owner to veto, in place of the orchestrating agent's
report. Every other intent question, and any it is unsure of, moves the issue
to `state:grill` with the facts gathered and the open questions. A fact only
an outside reporter holds moves it to `state:reporter`, and one only the owner
holds to `state:owner`, each with its question; whether to close a request
already implemented or rejected before is the owner's. Every outcome carries
the issue's one `type:` label.

A brief it writes with no open question it accepts, as the GitHub rules'
Readiness roles allow, asking for `state:ready` with the labels readiness
needs: one `model:` label it chooses from the models the host allows, any
`factory:skip` that Skipped work requires, and a `priority:` label as the
GitHub rules' Labels section says.

## Gates

An owner gate holds work only for what the owner alone can do: a credential or
grant only the owner holds, a blocker the owner tracks, or a `gate:` label. The
owner, or a grill at the owner's request, sets a `gate:` label before the work;
triage never sets one. A contract that designates owner review under the
`github-repository-configuration` rules' Designated owner review section gets
`gate:owner-review` with its readiness. A taste call in copy, UI or look is
the owner's intent, which a grill settles before the work under the
contribution guide's Triage section, never a gate.

A `gate:` label on a pull request or its issue stops its review at
ready-to-merge: the pull request is ready for review with its current head
reviewed and its checks passed, its issue waits in `state:owner`, and nothing
merges it until the owner removes the gate. Clearing a gate resumes
automation: a later review merges the pull request without reviewing an
unchanged head again. No merge is manual; an agent always merges.

Skipped work whose live steps need host access stays gated on the
maintainer's grant, as Skipped work says.

## State labels

The factory profile's label setup also provisions and verifies these labels,
with these colors and descriptions:

| Label                  | Color    | Description                                                |
| ---------------------- | -------- | ---------------------------------------------------------- |
| `gate:owner-review`    | `e99695` | Waits on the owner's review before its pull request merges |
| `gate:major-release`   | `e99695` | Waits on the owner's go-ahead for a major release          |
| `factory:running`      | `0052cc` | Waits on the factory run that holds it                     |
| `factory:paused`       | `c5def5` | Waits on the factory to resume the run it paused           |
| `factory:failed`       | `b60205` | Waits on a person to deal with the failed run              |
| `factory:skip`         | `c5def5` | Ready agent work the factory must not pick up              |
| `factory:release-hold` | `c5def5` | Hold other merges while a release PR is open               |
| `factory:hold`         | `c5def5` | Pause factory pickups and other merges in this repository  |

Standard-profile setup provisions none of them. `.factory/config.json` names,
by role, every label the factory reads or writes. Only the factory sets
`factory:running`, `factory:paused` and `factory:failed`, and it creates any of
them that is missing itself. `factory:running` marks an issue a run holds.
`factory:paused` means the factory paused the run and resumes it by itself, so
nobody removes it by hand. Remove `factory:failed` to run the issue again once
the cause of the failure is dealt with, subject to the pickup gates; removing
it requests a retry, never a resumption. The skip and hold labels follow
Skipped work and Repository and release holds.

`state:owner` is for an answer, an account, a credential or a grant only the
owner has, and for work an owner gate stopped.

## Skipped work

Agent work the factory must not pick up gets `state:ready`, one `model:` label
and `factory:skip`, applied together: work that edits `.github/workflows/`, or
work whose live steps need host access the maintainer grants. A directly
launched worker performs the agent work, including the source changes; host
access gates only the live host steps and does not designate owner review of
the source PR. A live-acceptance ticket, blocked by its source ticket, takes
this route and closes only on its recorded live acceptance; a merge never
closes it. The orchestrating agent that asked the maintainer for a
time-bounded host access grant owns it and records the workers using it.
Workers never end a grant: it ends when the last of them reports back, or at
its own time bound. Whoever applies `factory:skip` creates it if the
repository lacks it, as for `model:` labels; the factory never creates or
removes it.

For every skip-labelled PR and every PR opened by a directly launched worker,
including a PR without a skip label, the implementing worker delivers an open PR
and hands it to the orchestrating agent without merging. Worker completion is
the recorded PR handoff, a delivery record under the `comments` rules; the issue
stays open until delivery finishes. The orchestrating agent continues `babysit`
and owns the merge under the contribution guide and applicable review rules.

Apply the `github-repository-configuration` rules' Designated owner review gate
for designation, provenance and current-head approval. The skip marker alone
requires no owner review. While a designated PR waits for that approval, its
issue keeps `factory:skip` in `state:owner` and the PR stays open; once the
approval of its current head is verified and recorded, the issue returns to
`state:ready` and the orchestrating agent resumes `babysit` on the same PR.
Any head change returns it to `state:owner` until renewed approval.

An owner question on skipped work keeps `factory:skip` and the question's
workflow state while unanswered, and the worker or merging agent stops under
the contribution guide's owner-question handoff. Once the issue is back in
`state:ready`, as Questions and stops says, the orchestrating agent resumes or
relaunches the worker, or continues the same open PR from its handoff. This is
not a factory retry and needs no factory pickup.

## Repository and release holds

The configured `labels.hold` label pauses new pickups and merges in one
repository while any open issue or PR carries it. Runs already started finish
without merging.

An expedited change carries the repository hold on its own PR, so merging or
closing that PR ends its hold. A pause begun on an issue transfers to that PR
before merge, with the PR labelled before the issue label is removed. Only the
PR being merged is exempt from its own hold; every other labelled open issue
or PR still holds it. A held repository claims and launches nothing, so new
expedited work runs outside factory pickup through a directly launched worker
or the orchestrating agent. An already-open factory PR can carry the hold and
finish through its exempt merge relaunch.

Babysit's merge check enforces the repository hold as well as the release hold
immediately before merging, including when a hold appears mid-run. For the
repository hold it counts open issues and PRs; the release hold counts open
PRs only. Its hold exit leaves the PR open; a hold is not an owner handoff.

### Release holds

In a factory repository, a release PR carries the configured
`labels.releaseHold` label from opening until it merges or closes. While another
open PR carries it, the factory holds merges in that repository. Babysit also
checks immediately before its merge write, covering a release PR opened
mid-run and every babysit merge, including orchestrator recovery and
handed-off worker PRs. The labelled PR is exempt from its own hold. Merges
outside babysit are unaffected by its check.

Babysit reads the hold configuration from the destination default branch at
the same pinned revision as trusted review configuration; proposed PR changes
cannot remove their own hold. Missing configuration or an absent label key
adds no corresponding hold; unreadable or invalid configuration permits no
merge. The check accepts configuration versions 1, 2 and 3.

## External review of factory pull requests

Before requesting or waiting for external review, apply the optional
repository-owned `.github/factory-review-policy.json` under the
`github-repository-configuration` rules' trusted review configuration,
selected from the destination default branch at a pinned commit, including
after fixes, rebases, retries and resumed runs. The installed `babysit` request and wait commands
implement that policy. Without a declaration, keep configured reviewer
behavior; absence needs no owner question. The host does not choose a
repository's reviewer policy.

A policy skip preserves required checks and their waits, internal Standards and
Spec reviews defined by the `github-repository-configuration` rules' Internal
Standards and Spec reviews section, merge authorization, and handling of
findings that arrive. Those rules hold the skip outcome, and the `comments`
rules' Reviews section holds the internal review; the contribution guide's
supplied-credential restrictions still apply.

## Questions and stops

When an agent needs an answer only the owner can give, it follows the
contribution guide's owner-question handoff and moves the issue's workflow
state to whoever must answer: `state:owner` for the owner's answer,
`state:grill` for the owner's intent, or `state:reporter` for a fact only its
outside reporter holds. A factory run asks for that state in its run result.
Work without an issue uses no state label. The question reaches the
orchestrating agent first, as the contribution guide says.

An answered question returns the issue to `state:ready`, which resumes the
same work and pull request on a current base, whether the pull request is open
or closed unmerged; the factory never opens a replacement. An answer that
changes the implementation contract first needs the edited revision's
validator notice, independent review and renewed readiness under the
contribution guide; an unchanged contract needs none. Skipped work resumes as
Skipped work says.

An agent that stops without a pull request and without a `state:` stop posts a
stop note on the issue under the `comments` rules.

## Issue closure

When a merged PR's body has an actual closing reference to its still-open
issue, the factory closes the issue and clears its factory state instead of
failing the run. A branch-name match alone grants no authority to close it:
a merged PR without that closing reference that leaves the issue open still
fails the run for good, without a retry. The contribution guide holds the
issue-closing obligations.
