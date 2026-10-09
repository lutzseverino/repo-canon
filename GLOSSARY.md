# Repo Canon

Language for the documentation and contribution conventions selected by this
standards source.

## Language

**Repository README**:
The repository's top-level introduction and starting point for its readers.
_Avoid_: Project README when referring to the repository-wide document

**Project**:
A maintained app, service, library, or tool with its own responsibility and
development commands, including an internal workspace package.
_Avoid_: Any directory, fixture, generated output

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

**Readiness**:
The reviewed state of an implementation contract that an authorized reviewer
considers sufficiently specified for work. It grants the work to an agent; the
factory picks up ready issues on the frontier.
_Avoid_: Passing structural validation

**Factory**:
The unattended service that takes each ready issue on the frontier to a merged
pull request, in the run mode and with the model its labels name.
_Avoid_: Pipeline, orchestrator

**Frontier**:
The open issues the factory may pick up: those carrying `ready-for-agent`, with
no open native blocker, and neither claimed nor marked failed. An issue a gate
holds stays on the frontier.
_Avoid_: Backlog, queue

**Run mode**:
How the factory runs an issue: direct, one agent taking it to one pull
request, or orchestrated, an orchestrator over a ticket or a specification
whose implementer and reviewer are different agents.
_Avoid_: Run type, pipeline

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

**Adoption**:
Applying a selected standards source to a repository within its confirmed
scope and satisfying the source's requirements there.
_Avoid_: Publication, copying shared files

**Plan-gated requirement**:
A source requirement that GitHub offers only for some repository plans or
visibilities. Adoption satisfies it wherever GitHub offers it; where GitHub
does not, it is unavailable rather than optional.
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
