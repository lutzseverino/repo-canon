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

**Implementation contract**:
The agreed scope and acceptance criteria for a change, recorded in an approved
agent-brief comment for a triaged request or in a directly authored specification
or implementation ticket.
_Avoid_: Intake report, any comment, inferred scope

**Readiness**:
The reviewed state of an implementation contract that a maintainer or an
explicitly authorized triaging agent considers sufficiently specified for work.
It does not itself dispatch implementation, and revisions to an agent brief
invalidate its readiness.
_Avoid_: Passing structural validation, automatic dispatch
