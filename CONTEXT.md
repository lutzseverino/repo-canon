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
inside another. Its documentation index must map its documentation categories.
_Avoid_: Docs folder, documentation directory when referring to the root

**Documentation category**:
One of the fixed top-level groupings under a documentation root: `usage`,
`development`, `adr`, or `agents`. Each is created as a directory when it has
content.
_Avoid_: Section, documentation type

**Documentation index**:
The README of a documentation root or of a directory under it, which must state
the directory's purpose and list its entries. The installed
`docs/agents/README.md` cites the optional `docs/agents/project.md` in context
rather than listing it.
_Avoid_: Table of contents, listing page

**Implementation contract**:
The agreed scope and acceptance criteria for a change, recorded in an approved
agent-brief comment for a triaged request or in a directly authored
specification or implementation ticket.
_Avoid_: Intake report, any comment, inferred scope

**Readiness**:
The reviewed state of an implementation contract that a maintainer or an
explicitly authorized triaging agent considers sufficiently specified for work.
It does not itself dispatch implementation, and revisions to an agent brief
invalidate its readiness.
_Avoid_: Passing structural validation, automatic dispatch

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
