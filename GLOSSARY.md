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
A file the installed skills read as their per-repository configuration,
installed unchanged from the upstream setup seeds.
_Avoid_: Agent docs, tracker guidance

**Implementation contract**:
The agreed scope and acceptance criteria for a change, recorded in the latest
agent-brief comment for a triaged request or in a directly authored
specification or implementation ticket.
_Avoid_: Intake report, any comment, inferred scope

**Live acceptance**:
The recorded evidence that a deployed change behaves on the live system as its
implementation contract says. A merge never establishes it.
_Avoid_: Deployed, merged, done

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
The agent a maintainer runs to triage requests, which starts their research
runs and grilling sessions, receives every question first, records inferred
intent, keeps the decision inbox, reviews each brief independently, and
accepts a brief that holds by applying readiness. An owner who triages
themselves is the orchestrating agent.
_Avoid_: Factory, research run

**Inferred intent**:
An answer to an intent question that the orchestrating agent settled under the
contribution guide's inference test, with its citation to the owner's approved
goal, a recorded owner decision or wish, or the owner's quoted words.
_Avoid_: Assumption, agent's choice

**Decision inbox**:
The single list of decisions open for the owner, kept by the orchestrating
agent.
_Avoid_: Owner questions comment, needs-input queue

**Plan**:
An owner-approved goal, with what Done means, that the orchestrating agent
runs across tickets, kept in the workbench; it closes once each of its tickets
ends with a closed issue or the owner's drop.
_Avoid_: Roadmap, specification

**Close review**:
A review of a finished plan, run before its closing announcement and named
when the owner approves the plan. The plan's retro, a review of its outcome,
time and lessons by a separate session, is always one.
_Avoid_: Post-mortem, plan audit

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
drafts it. It never accepts its own brief.
_Avoid_: Orchestrating agent, reviewer

**Readiness**:
The reviewed state of an implementation contract that an authorized reviewer
considers sufficiently specified for work, granting it to an agent; the
factory accepts it only from a person whose current repository role the host
configuration authorizes, after the implementation contract's last edit. A
parent never runs, but its readiness releases its tickets and survives later
links only when complete history shows every addition at or after readiness
was made by an authorized person; without complete history, the platform's
available link timing governs renewed readiness.
_Avoid_: Passing structural validation

**Factory**:
The unattended service, installed once on a host, that takes each ready issue
on the frontier of every repository its host configuration lists to a merged
pull request of its own, with the model its label names. It never runs a
parent; a parent's readiness releases its tickets, each as its own run. It is
a product of its own, separate from Repo Canon and Repository Standards.
_Avoid_: Pipeline, orchestrator

**Frontier**:
The open issues the factory may pick up: those carrying readiness it accepts,
with no open native blocker, and neither claimed, marked failed or skipped,
nor waiting for an answer under `factory:needs-input`. An issue a gate holds
stays on the frontier; one waiting for an answer returns when its question is
answered and the label removed.
_Avoid_: Backlog, queue

**Host configuration**:
The factory operator's settings for one host: the repositories it serves, its
providers and their caps, its models, and the repository roles whose readiness
it accepts.
_Avoid_: Factory settings, environment

**Factory configuration**:
A repository's own statement of the labels, model label prefix and prompt the
factory uses there.
_Avoid_: Factory settings, host configuration

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
