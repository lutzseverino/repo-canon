# Repo Canon

Language for the documentation and contribution conventions selected by this
standards source.

## Language

**Repository README**:
The repository's top-level introduction and starting point for its readers.
_Avoid_: Project README when referring to the repository-wide document

**Project**:
A maintained application of any kind, service, library, or tool with its own
responsibility and development commands, including an internal workspace
package or a maintained workspace root package alongside its members. A Site
or an App is a web Project.
_Avoid_: Any directory, fixture, generated output, shared-only workspace configuration

**Stack**:
The named set of development tools, each at an exact major version, that a
Project uses, such as its package manager, runtime, compiler, linter, formatter
and test runner. Repo Canon declares each stack as a discovered declaration
whose scope is the Projects that use it, and a Project uses at most one.
_Avoid_: Stack profile, stack choice, framework

**Site**:
A web Project whose pages are built ahead of time from content or build-time
data, with interactive islands at most.

**App**:
A web Project whose interface is rendered in the browser by client-side code
that owns its routing and state, together with the web packages in its
workspace that only Apps use.

**Project README**:
The developer-facing introduction to one project within a monorepo.
_Avoid_: Repository README when referring to a component document

**Documentation root**:
A directory designated to hold categorized documentation: the repository's
`docs`, or another directory, such as a project's own, that the confirmed
documentation scope identifies as a root. A documentation root never lies
inside another.
_Avoid_: Docs folder, documentation directory when referring to the root

**Documentation category**:
One of the fixed top-level groupings under a documentation root: `usage`,
`development`, `adr`, or `agents`.
_Avoid_: Section, documentation type

**Documentation index**:
The README of a documentation root or of a directory under it, which states the
directory's purpose and lists its entries.
_Avoid_: Table of contents, listing page

**Skill setup file**:
A file the installed skills read as their per-repository configuration, owned
by Repo Canon and reconciled with an upstream setup seed as its upstream base.
_Avoid_: Agent docs, tracker guidance

**Implementation contract**:
The agreed scope and acceptance criteria for a change, recorded in its issue's
body: a directly authored specification or implementation ticket, or the Agent
Brief that triage writes over a request, keeping the reporter's text as the
original request.
_Avoid_: Intake report, any comment, inferred scope

**Live acceptance**:
The recorded evidence that a deployed change behaves on the live system as its
implementation contract says. A merge never establishes it.
_Avoid_: Deployed, merged, done

**Intake**:
The first pipeline stage, by which an owner's idea or a filed request becomes
work: an idea through a conversation with the orchestrating agent and then a
grill, unless the owner approves a shorter path for it; a filed request
through triage.
_Avoid_: Idea capture, backlog grooming

**Code-bound request**:
An intake request whose expected result is clear and whose remaining questions
the code, logs, or a reproduction can answer, so research writes its Agent
Brief.
_Avoid_: Bug, when meaning the triage path

**Intent-bound request**:
An intake request whose missing answer is the owner's intent, a policy, or a
trade-off they choose, whatever its category label, so its Agent Brief is
written from the owner's recorded decisions and any inferred intent.
_Avoid_: Feature request, when meaning the triage path

**Orchestrating agent**:
The agent a maintainer runs to talk with them: it takes their ideas through
intake, schedules grilling sessions, answers questions in their place except
reserved decisions, and watches the work through the tracker and the factory's
status. It starts only the factory session and owner-facing work, changes no
label and runs no repository's scripts; on an issue it posts only the record
of an owner decision or a superseded issue's fate.
_Avoid_: Factory, factory session, research run

**Reserved decision**:
A decision the orchestrating agent never takes in the owner's place: intent a
grill settles, unless the owner hands that grill over; a grant, credential,
billing step or one needing the owner's device or presence; a change to the
orchestrating agent's own powers or operating model, which always goes to a
grill with the owner even when other grill questions are delegated; a major
release or a second deferral of release scope; and anything that would carry the owner's
private setup into a repository.
_Avoid_: Owner question, when meaning the class; veto item

**Owner values**:
The owner's settings for the orchestrating agent, such as their timezone,
quiet hours and additions to or narrowings of the reserved decisions, kept in
the workbench in the format the orchestrating agent's skill defines and its
scripts validate. They hold values, never rules.
_Avoid_: Standing rules, preferences

**Inferred intent**:
An answer to an intent question settled under the contribution guide's
inference test, which the Agent Brief states as behavior and its triage notes
cite with a date.
_Avoid_: Assumption, agent's choice

**Decision inbox**:
The single list of decisions open for the owner, kept by the orchestrating
agent.
_Avoid_: Owner questions comment, needs-input queue

**Plan**:
An owner-approved goal, with what Done means, that the orchestrating agent
runs across tickets, kept in the workbench; it closes once each of its tickets
ends with a closed issue or the owner's drop; an expedited change's ticket
without an issue ends with its merged pull request.
_Avoid_: Roadmap, specification

**Specification**:
The issue a grill's decisions become, in the repository most of its work
touches, parent of the tickets that deliver it; a plan groups specifications.
A specification spanning repositories holds only what crosses them: the
interfaces between its tickets, their order and the shared decisions; each
repository's internals live in its own ticket.
_Avoid_: Spec file, draft brief, plan

**Amendment grill**:
A grill, as small as one round, that any change to a plan's goal, its Done
means or a ticket's scope requires before the specification and tickets change.
_Avoid_: Conversational amendment

**Factory gap**:
A pipeline stage the factory cannot yet perform for a repository, which the
factory session performs by hand in that repository with the stage's hand
skill, to the same contract, and logs. Intake and the grill, which need the
owner, are never factory gaps.
_Avoid_: Manual override, workaround

**Factory session**:
An agent session that performs the factory gaps, reading only the tracker and
the factory's status and writing only to the tracker; the orchestrating agent
starts it and revives it when it stops. It is a bridge: each stage it performs
names the factory ticket that removes it, or a recorded decision that keeps
the stage outside the factory. On a host without a factory, every stage is its
gap.
_Avoid_: Gap session, back session, orchestrator

**Launch report**:
The workbench record a launched stage writes when its output is a workbench
record, such as a grill's decision record; the orchestrating agent writes its
header before the launch, and its closing done line marks that the session's
turn has ended. A stage whose output is a tracker record reports through that
record instead.
_Avoid_: Hand-back message, nudge, worker report

**Stage input**:
The identifiers a hand launch passes to its stage's hand skill, and its whole
prompt: an issue, a pull request or a launch report. The skill reads
everything else from those records.
_Avoid_: Brief, task context, launch notes

**Close review**:
A review of a finished plan, run before its closing announcement and named
when the owner approves the plan. The plan's retro, a review of its outcome,
time and lessons by a separate session, is always one.
_Avoid_: Post-mortem, plan audit

**Done check**:
The read-only owner-facing work, run once every row of a plan has ended, that holds each
of the plan's Done-means clauses against primary sources and records its
evidence or the lack of it. Close starts only when every clause has evidence;
the Done check is a gate before Close, never a Close review.
_Avoid_: Done gate, completion audit, closing check

**Owner-facing work**:
Work the orchestrating agent starts because it reads the owner or the private
plans: the grill, the retro, the Done check and the architecture review, a
closed list. It is never a pipeline stage or a factory gap.
_Avoid_: Workbench stage, hand launch

**Fate**:
The recorded outcome, posted on an open issue, of a newer decision that
supersedes what the issue was written against: closed as superseded,
rescoped, or kept with a one-line reason.
_Avoid_: Outcome note, reconciliation

**Footprint**:
What a contract declares it supersedes, adds and deletes, naming durable
surfaces (skills and their references, labels, configuration keys, record
kinds) rather than file paths.
_Avoid_: Touches, file list

**Read set**:
What an agent must read before acting from an entry-point skill, computed
through each skill's own Reads over the skills and rules it names, and
measured in bytes.
_Avoid_: Context, line count

**Workbench**:
The git repository of plain Markdown in which the orchestrating agent keeps
its plans, decision inbox and wishes, named by path in the owner's global
agent instructions, or created by the orchestrating agent when none is named;
private, and outside every project checkout.
_Avoid_: Notes, memory

**Wish**:
A non-finding idea outside its plan's goal, recorded in the workbench with its
date, source and repository. A wish may link a reported finding for future
planning; the finding retains its required issue and reporting links.
_Avoid_: Backlog item, suggestion

**Research run**:
The sub-agent that gathers the facts for one request and, once nothing of the
owner's intent is open, writes its Agent Brief unless a grilling session
drafts it. Started by the orchestrating agent, it never accepts its own brief;
run as the factory's triage, it accepts the brief it wrote for an issue it did
not write.
_Avoid_: Orchestrating agent, reviewer

**Readiness**:
The reviewed state of an implementation contract that an authorized reviewer
considers sufficiently specified for work, granting it to an agent; the
factory accepts it from a person whose current repository role the host
configuration authorizes, or from its own triage run. A parent's readiness
releases its tickets.
_Avoid_: Passing structural validation

**Factory**:
The unattended service, installed once on a host, that takes the issues of
every repository its host configuration lists through its run kinds, from
triage to a merged pull request of their own. It never runs a parent. It is a
product of its own, separate from Repo Canon and Repository Standards.
_Avoid_: Pipeline, orchestrator

**Run kind**:
One of the factory's three kinds of run, triage, implement and review, each
turned on per repository and running the skill its factory configuration maps
to it.
_Avoid_: Stage, phase, mode

**Workflow state**:
The one `state:` label an open issue carries, naming whom it waits on: triage,
an outside reporter, a grill, the owner, or the factory once ready.
_Avoid_: Status label, needs-input

**Owner gate**:
A `gate:` label the owner, or a grill at the owner's request, sets before the
work, which stops the factory at ready-to-merge until the owner clears it; it
never asks for a manual merge.
_Avoid_: Owner review, ready-for-human, approval pause

**Outside reporter**:
The author of an issue who is neither the owner nor an agent working in the
owner's environment, and so may hold a fact no agent can reach.
_Avoid_: Reporter, when meaning the owner or the factory

**Frontier**:
The open issues the factory may pick up: those carrying readiness it accepts,
with no open native blocker, and neither claimed, marked failed or skipped.
An issue a gate holds stays on the frontier; one waiting for an answer in
another workflow state returns when its question is answered and it is back
in `state:ready`.
_Avoid_: Backlog, queue

**Host configuration**:
The factory operator's settings for one host: the repositories it serves, its
providers and their caps, its models with their model guidance, one host-wide
effort level with optional per-model overrides, and the repository roles whose
readiness it accepts.
_Avoid_: Factory settings, environment

**Model guidance**:
The host owner's short statement of which work a model in the host's catalog
suits, from which every launcher chooses a model by fit, the cheaper one where
several fit.
_Avoid_: Model profile, model card

**Factory configuration**:
The standard's statement of the factory's mechanics in a repository it
serves: the run kinds, the skill each runs, and the labels and model label
prefix they use, the same in every such repository.
_Avoid_: Factory settings, host configuration, model policy

**Value owner**:
The one party that chooses a value, whether the standard, the repository, the
host or the issue, and whose own file is the only place the value lives.
_Avoid_: Owner, when meaning the party rather than the person; authority

**Ownership check**:
The question asked of a change that adds or moves a value, configuration kind,
variant, or file, or that edits vendored code or crosses a repository or host:
who the value owner is, how many consumers there are, whether it can be
reversed, and what it costs now and to carry.
_Avoid_: Owner-and-seam check, owner check

**Deferred seam**:
A seam judged possible but not yet built, recorded where the code would hold
it together with its count of consumers.
_Avoid_: Door, TODO

**Hosting platform**:
The service that hosts a repository and its collaboration features, including
issues, pull requests and releases; platform is the short form.
_Avoid_: Forge

**Platform adapter**:
The implementation of the hosting platform package's ports for one platform,
reporting that platform's facts and available capabilities.
_Avoid_: Platform policy, general API client

**Pull request**:
A proposed branch change submitted for review and merge into a repository;
GitLab calls it a merge request.
_Avoid_: Change request

**Pull request reviewer**:
An external account, named by the repository, whose review of a pull request's
latest head the merge waits for. A repository that names none merges without
waiting.
_Avoid_: Codex, when meaning the role; review bot

**Lead line**:
The first visible line of a message an agent or the factory posts: its state or
verdict behind a status marker, and who must act when a person must. A message
whose lead line names nobody needs nobody.
_Avoid_: Headline, TL;DR, disclaimer line

**Direct change**:
A change made without a ticket, at the maintainer's request in a thread or as
a minor correction.
_Avoid_: Untracked work, issue exemption

**Source acceptance**:
The reviewed conclusion that a specific version of the standards source meets
its agreed requirements and has the required supporting evidence.
_Avoid_: Publication, successful adoption in every repository

**Source publication**:
Making an accepted standards source available as a permanent version that
adopting maintainers can select.
_Avoid_: Source acceptance, adoption

**Rules**:
The installed, human-readable statement of what a standard requires of a file,
a repository area, or work in the whole repository, such as tracker work that
changes no file, which its checks and assessments cite. Rules outlast the
adoption run that installs them.
_Avoid_: Guidance, when meaning lasting requirements; skill instructions

**Planning rules**:
The installed rules for taking a request to accepted contracts, worded by
role: triage and its inference test, grills and their publication, readiness,
owner questions and findings routing.
_Avoid_: Triage section, orchestrator procedure

**Delivery rules**:
The installed rules for taking a ready contract to a merged change, worded by
role: implementation contracts, worker handoff, adoption pull requests,
merging, agents on the maintainer's account and credentials.
_Avoid_: Pull request section, delivery skill

**Contribution guide**:
`CONTRIBUTING.md`: how to contribute to the repository, in role words, for a
person or an agent alike: issues, setup, validation, commits, opening a pull
request and what review and merge need. It points each role to its planning
or delivery rules and holds no agent mechanics.
_Avoid_: Process manual, agent instructions

**Agent guidance**:
The always-loaded `AGENTS.md`: a short, stable map whose lines each name a
moment of work and the authoritative file to read then. It holds no rule text
and changes only when a path moves.
_Avoid_: Agent rules, standing rules

**Adoption guidance**:
A standard's one-time instructions for an adoption or update run, such as a
migration, a question for the maintainer, or how to assess a declaration. It
is kept with the run's inputs and never installed as rules.
_Avoid_: Guidance, when meaning rules

**Workflow skill**:
A skill the standard installs because the shared workflow keeps its output,
as committed artifacts or issue tracker items that others rely on, or because
rules, a check, or another workflow skill rely on it. It is a method an agent
follows and never defines a requirement.
_Avoid_: Installed skill, rule, policy

**Owned skill**:
A workflow skill Repo Canon publishes as its own, either written for it or
taken from an upstream skill and reconciled with that skill's upstream base.
Every workflow skill is an owned skill.
_Avoid_: Fork, patched skill, pinned skill

**Upstream base**:
The upstream snapshot an owned skill was last reconciled with, kept unedited
as the reference for the next upstream update.
_Avoid_: Pin, vendored copy

**Personal skill**:
A skill whose output serves only the person using it, such as a lesson or a
questionnaire, even when that file is written inside a repository. A person
installs it for themselves; the standard does not.
_Avoid_: Optional skill

**Remote setup**:
The part of adoption that changes the hosting platform's settings for the
repository, such as its labels and merge rules. It can be deferred, so that
adoption completes locally without it.
_Avoid_: GitHub setup, fixes, when meaning only the remote part

**Entry document**:
A first document a newcomer reads: the Repository README and the root usage
index.
_Avoid_: Landing page, front page

**Standard profile**:
The profile of Repo Canon that every adopting repository can select, carrying
everything except the factory's repository files and workflow rules.
_Avoid_: Complete profile, base profile

**Factory profile**:
The profile that adds the factory's repository files and workflow rules to the standard profile,
for a repository that a factory serves.
_Avoid_: Factory add-on, factory overlay

**Workbench profile**:
The profile of Repo Canon that a workbench adopts: only the workflow skills,
with no rules, CI or branch requirements; its updates land as direct commits.
_Avoid_: Orchestrator profile

**Adoption**:
Applying a selected standards source to a repository within its confirmed
scope and satisfying the source's requirements there.
_Avoid_: Publication, copying shared files

**Check location**:
Where a repository's required checks run, chosen at adoption: GitHub's hosted
runners, a runner the repository names, or self-reported.
_Avoid_: Runner variable, CI mode

**Independent check**:
A required check run on the pushed head by a process the authoring agent does
not control.
_Avoid_: Local run, worker's check

**Self-reported check**:
A required check the authoring agent ran on its own and reported in the pull
request, which the review run repeats before merging.
_Avoid_: Unchecked, skipped checks

**Plan-gated requirement**:
A source requirement that a hosting platform offers only for some repository
plans or visibilities. Adoption satisfies it wherever the platform offers it;
where it does not, the requirement is unavailable rather than optional.
_Avoid_: Optional requirement, exception, waiver

**Adopting repository**:
A repository that applies a selected Repo Canon release through adoption.
_Avoid_: Adopting project

**Point-in-time record**:
An account of one release, adoption, validation run, or exercise as it stood
when that event happened, which is not kept current afterward.
_Avoid_: Evidence directory, documentation evidence, acceptance results

**Breaking standards change**:
A change that makes a previously conforming repository require new mandatory
migration work or an incompatible workflow change to remain conforming.
_Avoid_: Only changes that break the adopting application's runtime

**Self-adoption**:
Adoption of a published Repo Canon release by the Repo Canon repository itself,
through the same public CLI and profile every adopter uses, including every
later update to a newer release.
_Avoid_: Re-adoption, adopting the working tree, dogfooding, source validation
