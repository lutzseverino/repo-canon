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
and test runner; a Project uses at most one. [Stacks](docs/usage/stacks.md)
describes their scope and membership.
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
The first pipeline stage, in which an owner's idea or a filed request becomes
work. Its entry paths are defined by [Triage](CONTRIBUTING.md#triage).
_Avoid_: Idea capture, backlog grooming

**Front door**:
Any agent session a person opens in an adopted repository, with or without a
factory, which routes what they ask for: to its stage's hand skill in the
[Canonical stages](rules/factory-workflow.md#canonical-stages), or by
[Triage](CONTRIBUTING.md#triage) where that table is not installed; to the
running orchestrating agent if there is one; or to a parked idea when they ask
for one. It answers a status question read-only and starts a full workflow
only on the person's yes.
_Avoid_: Start section, entry skill

**Code-bound request**:
An intake request whose expected result is clear and whose remaining questions
the code, logs, or a reproduction can answer, so research writes its Agent
Brief.
_Avoid_: Bug, when meaning the triage path

**Intent-bound request**:
An intake request whose missing answer concerns intent, policy or a trade-off,
whatever its category label, so its Agent Brief relies on recorded decisions
and qualifying inferred intent. Reserved decisions require the maintainer;
other downstream choices belong to their delegated agent.
_Avoid_: Feature request, when meaning the triage path

**Orchestrating agent**:
The maintainer's delegated agent that takes approved goals through strategic
implementation and an evidenced close, deciding downstream with independent
review by a different provider and listing decisions for veto in its next
update. Reserved decisions go to the maintainer; silence on listed decisions
stands.
_Avoid_: Factory, factory session, research run

**Reserved decision**:
One of five cases requiring a grill with the maintainer: they ask; the
choice changes their goal, Done means or something they wanted; it is hard to
reverse and reaches outside their own repositories (including external names
or formats, a breaking release for outside users, repository or data deletion,
money or new accounts, or an adopter security trade-off); it needs their taste,
credential, device or presence; or recorded maintainer decisions conflict and
neither code nor records settle which wins.
_Avoid_: Every grill question; every persistent implementation choice

**Owner values**:
A historical term for the validated settings store in the dropped bundled
operating model. The surviving design uses recorded maintainer decisions,
without that engine.
_Avoid_: Current configuration contract, standing rules

**Inferred intent**:
An answer a triager settles under the planning inference test, stated as
behavior in the Agent Brief and cited with a date in triage notes. The test
limits the triager, while remaining questions follow the decision-rights rule.
_Avoid_: Assumption, every delegated agent decision

**Decision inbox**:
The single list of decisions open for the owner, kept by the orchestrating
agent.
_Avoid_: Owner questions comment, needs-input queue

**Plan**:
An owner-approved goal, with what Done means, that the orchestrating agent
runs across tickets, kept in the workbench. Its
[plan record](.agents/skills/orchestrate/references/templates.md#planmd-and-logmd)
defines how its rows end and when it closes.
_Avoid_: Roadmap, specification

**Specification**:
The issue a grill's decisions become, in the repository most of its work
touches, parent of the tickets that deliver it; a plan groups specifications.
A specification spanning repositories holds only what crosses them: the
interfaces between its tickets, their order and the shared decisions; each
repository's internals live in its own ticket.
_Avoid_: Spec file, draft brief, plan

**Amendment grill**:
A grill, as small as one round, for a proposed change to a plan's goal, its
Done means or a ticket's scope. See [Triage](CONTRIBUTING.md#triage) for
amendment requirements.
_Avoid_: Conversational amendment

**Factory gap**:
A pipeline stage the factory cannot perform for a repository, which the
maintainer or their delegated agent arranges through that stage's hand skill
to the same contract. It does not require a separate factory session.
_Avoid_: Manual override, workaround

**Factory session**:
The historical bridge that performed factory gaps from tracker state and
factory status; it was dropped with the watch-only operating model.
_Avoid_: Current executor, orchestrating agent

**Launch report**:
The workbench record of a launched stage whose output is a workbench record,
such as a grill's decision record; tracker-producing stages report through the
tracker instead. Its completion marker is its final line `status: done`, which
the generated brief requires; see the
[launch method](.agents/skills/orchestrate/references/launches.md).
_Avoid_: Hand-back message, nudge, worker report

**Generated brief**:
A launch brief whose mechanical fields a command derives from the
[Canonical stages](rules/factory-workflow.md#canonical-stages) table and the
orchestrating agent's arguments; only its Context section is written by hand.
_Avoid_: Launch template, hand-written brief

**Stage input**:
The identifiers a hand launch passes to its stage's hand skill: an issue, a
pull request, a plan row or a launch report.
[`workbench brief`](.agents/skills/orchestrate/references/launches.md#the-workbench-script)
takes it as the generated brief's target.
_Avoid_: Brief, task context, launch notes

**Close review**:
A review of a finished plan, named at plan approval and performed before its
closing announcement. The plan's retro, a review of its outcome, time and
lessons by a separate session, is always one; see the
[Close procedure](.agents/skills/orchestrate/references/close.md).
_Avoid_: Post-mortem, plan audit

**Done check**:
The read-only owner-facing work that holds each of the plan's Done-means
clauses against primary sources and records its evidence or the lack of it.
Close starts only when every clause has evidence;
the Done check is a gate before Close, never a Close review.
_Avoid_: Done gate, completion audit, closing check

**Owner-facing work**:
Work grounded in the maintainer's ideas or private plans, such as a grill,
retro, Done check or architecture review. A reserved decision determines when
the maintainer must answer; downstream grills can be answered by their agent.
_Avoid_: Every grill, factory gap

**Fate**:
The recorded outcome, posted on an open issue, of a newer decision that
supersedes what the issue was written against: closed as superseded,
rescoped, or kept with a one-line reason.
_Avoid_: Outcome note, reconciliation

**Footprint**:
What a contract declares it supersedes, by ADR and issue, and what it adds and
deletes, as durable surfaces (skills and their references, labels,
configuration keys, record kinds) rather than file paths.
_Avoid_: Touches, file list

**Read set**:
What an agent must read before acting from an entry-point skill, computed
through each skill's own Reads over the skills and rules it names, and
measured in bytes.
_Avoid_: Context, line count

**Workbench**:
The private git repository of plain Markdown outside project checkouts in
which the orchestrating agent keeps plans, the decision inbox and wishes.
Repository ideas live in their trackers under
[Findings](CONTRIBUTING.md#findings), not in the workbench.
[Orchestrate](.agents/skills/orchestrate/SKILL.md#workbench) owns its setup and layout.
_Avoid_: Notes, memory

**Wish**:
An idea about the orchestrating agent's own procedure, recorded in the
workbench with its date and source. A repository idea is no wish:
[Findings](CONTRIBUTING.md#findings) owns when it is parked as an issue.
_Avoid_: Backlog item, suggestion

**Research run**:
The sub-agent that gathers the facts for one request and writes its Agent
Brief from settled intent unless a grilling session drafts it. Acceptance
policy lives in [Triage](CONTRIBUTING.md#triage) and the
[factory triage rules](rules/factory-workflow.md#triage-run).
_Avoid_: Orchestrating agent, reviewer

**Readiness**:
The reviewed state of an implementation contract considered sufficiently
specified for work. See [Readiness](CONTRIBUTING.md#readiness), the
[GitHub authorization rules](rules/github-repository-configuration.md#readiness-roles)
and the [factory readiness rules](rules/factory-workflow.md#parent-readiness).
_Avoid_: Passing structural validation

**Factory**:
The unattended service, installed once on a host, that takes issues from its
configured repositories through run kinds to merged pull requests. It is a
product of its own, separate from Repo Canon and Repository Standards. See
[factory workflow rules](rules/factory-workflow.md) for eligibility and delivery.
_Avoid_: Pipeline, orchestrator

**Run kind**:
One of the factory's three kinds of run, triage, implement and review, each
turned on per repository and running the skill its factory configuration maps
to it.
_Avoid_: Stage, phase, mode

**Workflow state**:
The one `state:` label an open issue carries, naming whom it waits on: triage,
an outside reporter, a grill, the owner, another record that carries it, or
the factory once ready. A stop is answered by applying the issue's next state.
_Avoid_: Status label, needs-input

**Carried request**:
An open request whose fate another record or ticket already settles, such as
the change that implemented it, the issue it duplicates, the rejection it
repeats, or the ticket whose pull request closes it, and which waits on that
carrier rather than on the owner.
_Avoid_: Covered request, held request

**Overlapping advance**:
A move of the default branch, after a pull request's branch update, that
changes a path the pull request changes or does not merge cleanly with its
head.
_Avoid_: Conflict, when the merge is clean

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
The set of open issues eligible for factory pickup, including those held by
an owner gate. See the
[factory rules](rules/factory-workflow.md) for pickup and question routing.
_Avoid_: Backlog, queue

**Host configuration**:
The factory operator's settings for one host: the repositories it serves, its
providers and their caps, its models with their model guidance and which of
them are narrower than others, one host-wide effort level with optional
per-model overrides, and the repository roles whose readiness it accepts.
_Avoid_: Factory settings, environment

**Model guidance**:
The host owner's short statement of which work a model in the host's catalog
suits, from which every launcher chooses a model by fit: where several fit,
the narrower model when the host declares one, otherwise the cheaper one.
_Avoid_: Model profile, model card

**Narrower model**:
A model the host configuration declares suits a subset of the work another
model in its catalog suits, so a launch chosen for it may run that broader
model instead. Each such pair is declared on its own; the standard and the
host declare no ranking of models.
_Avoid_: Weaker model, cheaper model, lower-ranked model

**Stand-in**:
A broader model the factory runs in place of the narrower model chosen for
a launch, decided at launch from its providers' usage.
_Avoid_: Upgrade, fallback, substitution

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
latest head the merge waits for. Its [reviewer file](rules/github-repository-configuration.md#pull-request-reviewer-file)
and [merge wait](rules/github-repository-configuration.md#merging-with-a-configured-reviewer)
live in the GitHub rules.
_Avoid_: Codex, when meaning the role; review bot

**One-way change**:
A pull request's change that cannot be walked back once it merges, such as a
destructive action or a hard-to-reverse decision. Its Merge Danger names the
door one-way.
_Avoid_: Breaking change, when meaning this; risky change

**Animatic**:
A narrated video of still frames that gives a person reading a pull request a
map of its change: why, its shape, where to start reading, and its proof. A
one-way change carries one in its pull request's body.
_Avoid_: PR video, demo video, screencast

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
The profile of Repo Canon for a workbench: workflow skills and their runtime
and license files, without repository rules or CI. See the
[source profile](docs/development/source-profile.md) for its contents and the
[adoption guide](docs/usage/adopt-repo-canon.md#orchestrate-plans) for updates.
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

**Review rerun**:
The review run's repetition of the one check command on a self-reported pull
request's exact head, posted as the commit status merge requires there.
_Avoid_: Second run, re-check, reviewer's tests

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
