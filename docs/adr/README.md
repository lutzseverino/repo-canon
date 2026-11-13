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
  file rules out of the contribution guide, and ADR 0028 makes them owned files.
- [Enforce documentation rules as checks](0009-enforce-documentation-rules-as-checks.md):
  the documentation check enforces the index entry form, one index per
  document, the development guide's order, and scope coverage; ADR 0016 moves
  the rules' one statement to installed rules, and ADR 0022 proves scope
  coverage only in runs.
- [Carry delivery rules in the environment and keep skills short](0010-carry-delivery-rules-in-the-environment.md):
  the contribution guide and one `AGENTS.md` line carry delivery, the delivery
  skill is deleted, and the short `babysit` skill takes a pull request to its
  merge; ADR 0042 amends its `AGENTS.md` line and ADR 0043 moves the delivery
  procedure to the delivery rules.
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
  defaults, and the factory checks readiness against roles the host names;
  ADR 0033 supersedes repository ownership of the exact configuration's values.
- [Configure the pull request reviewer as repository data](0015-configure-the-pull-request-reviewer-as-repository-data.md):
  an optional data file names the reviewer `babysit` waits for, and its absence
  means no reviewer.
- [Keep requirements in installed rules, and use skills as methods](0016-keep-requirements-in-installed-rules.md):
  requirements live in installed rules that checks and assessments cite, and
  installed skills, pinned upstream ones included, never define them; ADR 0028
  supersedes its override and fork consequences, and ADR 0043 amends it.
- [Make the factory an optional profile](0017-make-the-factory-an-optional-profile.md):
  a standard profile for every adopting repository and a factory profile that
  adds the factory's repository files; ADR 0027 adds a workbench profile.
- [Install only workflow skills](0018-install-only-workflow-skills.md): the
  standard installs skills that the workflow relies on, and people install
  personal skills for themselves.
- [Fork a pinned skill when its overrides outgrow it](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md):
  pinned skills stay verbatim until their overrides would restate most of the
  procedure or exceed two, and then Repo Canon owns the skill with credit;
  superseded by ADR 0028.
- [Release the factory from its own repository](0020-release-the-factory-from-its-own-repository.md):
  Scriptorium moved with its history to `lutzseverino/scriptorium`, while Repo
  Canon keeps the factory profile, the boundary terms, and the published
  `scriptorium-v1.0.0` to `scriptorium-v1.0.5` releases.
- [Route triage by where its uncertainty lies](0021-route-triage-by-where-its-uncertainty-lies.md):
  research and independent acceptance for code-bound requests, a grilling
  session with the owner before the brief for intent-bound ones, and a Repo
  Canon fork of `triage` to carry the method; ADR 0025 amends its
  intent-bound path.
- [Prove documentation scope coverage only in runs](0022-prove-documentation-scope-coverage-only-in-runs.md):
  between runs the confirmed scope is frozen, so the documentation check
  reports no scope-membership correction when invoked as `check`, and the next
  update brings new documents into scope.
- [Reach the hosting platform through Postern](0023-reach-the-hosting-platform-through-postern.md):
  an independent package supplies four ports and platform facts, while consumer
  policy, platform choice, distribution and timing guarantees stay explicit.
- [Scope each stack to the Projects that use it](0024-scope-each-stack-to-the-projects-that-use-it.md):
  opt-in stacks are discovered declarations scoped per Project, starting with
  the recommended `typescript-node` tools while installation waits for optional discovery;
  ADR 0026 amends its decisions 4 and 11, which waited for the web stack.
- [Infer cited intent and route owner questions through one inbox](0025-infer-cited-intent-and-route-owner-questions-through-one-inbox.md):
  the orchestrating agent answers intent it can cite and that does not outlive
  the work, a grill with the owner drafts the other briefs it accepts, and
  owner-only questions reach the owner only through its decision inbox. Its
  writer rule is superseded for the factory's triage run by ADR 0030, and
  `factory:needs-input` by ADR 0031. ADR 0041 supersedes its decision boundary
  and veto reporting; ADR 0043 supersedes its grill-publication assignment.
- [Add the typescript-astro and typescript-vite stacks](0026-add-the-typescript-astro-and-typescript-vite-stacks.md):
  Sites use Astro and Apps use Vite with React, as two stacks over shared web
  rules with oxlint, Prettier, pnpm and shadcn, amending ADR 0024.
- [Give the workbench its own profile](0027-give-the-workbench-its-own-profile.md):
  the orchestrating agent's workbench adopts only the workflow skills and the
  files they need to run, with no rules, CI or branch requirements, and
  commits its updates directly.
- [Own every workflow skill, reconciled with its upstream base](0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md):
  every workflow skill and skill setup file is Repo Canon's own, and each one
  taken from upstream records its upstream base and takes upstream updates by a
  three-way merge, superseding ADR 0019 and ADR 0008's verbatim rule.
- [Make the validator's posted result the only contract decision](0029-make-the-validators-posted-result-the-only-contract-decision.md):
  the issue-contract validator alone decides contracts and readiness and posts
  a versioned result, which the factory checks against platform facts without
  interpreting the contract itself.
- [Let the factory's triage run accept its own brief](0030-let-factory-triage-accept-its-own-brief.md):
  the factory's triage run writes and accepts the brief for an issue it did
  not write, and the review run's Spec review is the independent check.
- [Name labels by family](0031-name-labels-by-family.md): `state:`, `gate:`,
  `factory:`, `type:`, `priority:` and `model:` families, with one workflow
  state naming whom an issue waits on.
- [Test behaviour and structure, not wording](0032-test-behaviour-and-structure-not-wording.md):
  tests check code behaviour and file structure, never the wording of rules,
  skills or documents; license notices are compared byte for byte.
- [Give every value one value owner](0033-give-every-value-one-value-owner.md):
  each value lives only in its value owner's file: exact files hold the
  standard's values, repository-owned files the repository's, host
  configuration the host's, and labels the issue's.
- [Choose where checks run at adoption](0034-choose-where-checks-run-at-adoption.md):
  `github`, `runner` or `self-reported`, chosen in the selection, one check
  command, and the merge gate enforced by Repo Canon's tooling.
- [Keep the implementation contract in the issue body](0035-keep-the-implementation-contract-in-the-issue-body.md):
  triage writes the Agent Brief over the body and keeps the original request.
- [Launch hand stages with identifiers only](0036-launch-hand-stages-with-identifiers-only.md):
  a hand launch is its stage's hand skill and stage input, with the model from
  the anchor's label and no free text; ADR 0040 supersedes its assignment of
  launches and intake model labels to the orchestrating agent.
- [Act in repositories only through launches](0037-act-in-repositories-only-through-launches.md):
  the orchestrating agent applies no label and runs no repository's scripts;
  it launches into the repository and reads coverage from the factory's status.
  Superseded by ADR 0040.
- [Exempt genuine Dependabot pull requests from the body sections](0038-exempt-genuine-dependabot-pull-requests-from-body-sections.md):
  the metadata validator skips the four body sections only for a trusted
  `dependabot[bot]` author; title, breaking-change and attribution checks stay.
- [Own pull-request text checks and retire others before adoption](0039-own-pull-request-text-checks-and-retire-others-before-adoption.md):
  Canon's metadata contract is the only pull-request text policy; adoption stops
  until a prerequisite pull request removes every other such check.
- [Watch instead of launching; a factory session performs the factory gaps](0040-watch-instead-of-launching.md):
  the orchestrating agent launches only the factory session, which works from
  the tracker and the factory's status alone; supersedes ADR 0037; amended by
  ADR 0046.
- [Answer in the owner's place except reserved decisions, by one bundled operating model](0041-answer-in-the-owners-place-except-reserved-decisions.md):
  the skill holds decision rights, principles and format; the workbench holds
  only owner values and decision records.
- [Keep agent guidance a stable map](0042-keep-agent-guidance-a-stable-map.md):
  `AGENTS.md` links where each rule lives, including the installed rules at
  the start of work, and holds no rule text.
- [Keep the contribution guide for contributors, and process in planning and delivery rules](0043-keep-the-contribution-guide-for-contributors.md):
  the guide is role-worded contribution help; planning and delivery rules hold
  the process; amends ADR 0016.
- [Lead every message with its outcome](0044-lead-every-message-with-its-outcome.md):
  a lead line first, the AI disclosure in a footer, notes collapsed behind a
  summary line, links instead of copies, and reviews as a verdict line and one
  findings table.
- [Check supersession and footprint at readiness, not by hand](0045-check-supersession-and-footprint-at-readiness.md):
  contracts name what they supersede, add and delete; readiness waits for
  every superseded issue's fate, and the pull request checks declared
  deletions.
- [Start owner-facing work; the factory session is a bridge with removal conditions](0046-start-owner-facing-work-and-bridge-factory-gaps.md):
  the grill, retro, Done check and architecture review stay with the
  orchestrating agent; each factory-session stage names what removes it;
  amends ADR 0040.
- [Read nothing another project owns](0047-read-nothing-another-project-owns.md):
  Repo Canon's scripts use its own labels and contract sections, and
  Scriptorium owns its configuration, model policy and footer.
- [Budget the computed read set, not files' lines](0048-budget-the-computed-read-set.md):
  bytes over what each entry-point skill makes an agent read, against the
  base branch.
