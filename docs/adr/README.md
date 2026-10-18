# Architecture decisions

This directory records, in numbered brief entries, the decisions whose reversal
has meaningful cost, whose rationale would otherwise be surprising, and which
involve real alternatives.

- [Manage shared skills through standards releases](0001-manage-shared-skills-through-standards-releases.md):
  the source owns pinned snapshots of the upstream skills and distributes their
  updates through its releases; ADR 0018 narrows them to workflow skills.
- [Squash reviewed changes into the default branch](0002-squash-reviewed-changes.md):
  Conventional Commit titles and squash merges that keep the reviewed title and
  description as the final message.
- [Follow the product's release versioning convention](0003-follow-product-release-versioning.md):
  Semantic Versioning, with compatibility judged by the adopting repository's
  conformance and workflow.
- [Adopt published releases of this source](0004-adopt-published-releases-of-this-source.md):
  Repo Canon adopts its own standards from a published release through the
  public CLI, never from its working tree; ADR 0017 replaces its `complete`
  profile.
- [Require an open-ended minimum CLI version](0005-require-an-open-ended-minimum-cli-version.md):
  the required CLI names the oldest validated version with no upper bound.
- [Keep point-in-time records with the event they record](0006-keep-point-in-time-records-with-their-event.md):
  documentation holds maintained material only, and records stay with their
  pull request, release, or CI run.
- [Keep superseded ADRs](0007-keep-superseded-adrs.md): a superseded ADR stays,
  marked with the ADR that supersedes it, while other superseded documents are
  deleted.
- [Install skill setup files verbatim from upstream seeds](0008-install-skill-setup-files-verbatim-from-upstream-seeds.md):
  the issue tracker, triage label, and domain configurations are the vendored
  upstream setup seeds, installed byte for byte; ADR 0016 moves Repo Canon's
  file rules out of the contribution guide.
- [Enforce documentation rules as checks](0009-enforce-documentation-rules-as-checks.md):
  the documentation check enforces the index entry form, one index per
  document, the development guide's order, and scope coverage; ADR 0016 moves
  the rules' one statement to installed rules.
- [Carry delivery rules in the environment and keep skills short](0010-carry-delivery-rules-in-the-environment.md):
  the contribution guide and one `AGENTS.md` line carry delivery, the delivery
  skill is deleted, and the short `babysit` skill takes a pull request to its
  merge.
- [Ship the factory with the standard](0011-ship-the-factory-with-the-standard.md):
  every adopting repository carries `.sandcastle/`, which replaces orchestrator
  prompts, and labels choose each run's mode and model; its run-mode selection
  is superseded by ADR 0012, its every-adopter install by ADR 0017, and the
  rest by ADRs 0013 and 0014.
- [Run each ticket of a specification as its own factory run](0012-run-each-ticket-as-its-own-factory-run.md):
  every factory run is a direct run, a parent never runs, and its readiness
  releases its tickets, each on its own model label; its fixed prompt and
  `model:` prefix are superseded by ADR 0014.
- [Install the factory on the host from its own releases](0013-install-the-factory-on-the-host-from-its-own-releases.md):
  the factory is released from `factory/` under its own versions, one process
  on a host runs an auto-updating major for all its repositories, and a
  repository carries only `.factory/`; ADR 0020 moves it to its own
  repository.
- [Name every factory convention in configuration](0014-name-every-factory-convention-in-configuration.md):
  the repository's factory configuration names its labels and prompt with no
  defaults, and the factory checks readiness against roles the host names.
- [Configure the pull request reviewer as repository data](0015-configure-the-pull-request-reviewer-as-repository-data.md):
  an optional data file names the reviewer `babysit` waits for, and its absence
  means no reviewer.
- [Keep requirements in installed rules, and use skills as methods](0016-keep-requirements-in-installed-rules.md):
  requirements live in installed rules that checks and assessments cite, and
  installed skills, pinned upstream ones included, never define them.
- [Make the factory an optional profile](0017-make-the-factory-an-optional-profile.md):
  a standard profile for every adopting repository and a factory profile that
  adds the factory's repository files.
- [Install only workflow skills](0018-install-only-workflow-skills.md): the
  standard installs skills that the workflow relies on, and people install
  personal skills for themselves.
- [Fork a pinned skill when its overrides outgrow it](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md):
  pinned skills stay verbatim until their overrides would restate most of the
  procedure or exceed two, and then Repo Canon owns the skill with credit.
- [Release the factory from its own repository](0020-release-the-factory-from-its-own-repository.md):
  Scriptorium moved with its history to `lutzseverino/scriptorium`, while Repo
  Canon keeps the factory profile, the boundary terms, and the published
  `scriptorium-v1.0.0` to `scriptorium-v1.0.5` releases.
- [Route triage by where its uncertainty lies](0021-route-triage-by-where-its-uncertainty-lies.md):
  research and independent acceptance for code-bound requests, a grilling
  session with the owner before the brief for intent-bound ones, and a Repo
  Canon fork of `triage` to carry the method.
