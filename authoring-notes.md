# Repo Canon authoring notes

These notes are the one home for Repo Canon's confirmed authoring decisions and
their rationale. They stay beside `standards.yaml`, the source they explain.

## Ownership

Repo Canon owns a file only when every adopting repository should hold the
same bytes. Exact content includes `AGENTS.md`, `CONTRIBUTING.md`, the issue
and pull request templates, the skill setup files under `docs/agents`, the
trusted validation workflows with their scripts, the vendored rendered-Markdown
runtime and parsers with their notices, the pinned skills with their upstream
license notice, the HumanLayer license notice for material reproduced in the
`pr` skill's Summary, Repo Canon's own `babysit` and `triage` skills, and, in the factory
profile, the factory configuration and the sandbox image workflow. It is installed
identically in every adopting repository that selects its profile and changes
only through a Repo Canon release.

`rules/` holds each declaration's lasting rules, which adoption installs in
the adopting repository and an agent changing a covered file later reads, as
[ADR 0016](docs/adr/0016-keep-requirements-in-installed-rules.md) decides.
Rules hold no one-time step and cite no retained source path; where one
declaration's rules depend on another's, they name that declaration's rules.
`guidance/` and `discovery/` are source-side instructions for the one-time
adoption, written for a person as well as an agent, and `discovery/` also holds
the documentation and all three TypeScript stack scope drafters, which inspection
runs as those declarations' discovery scripts. They are not installed in the adopting
repository; the CLI retains them with the other source inputs.

The repository license, READMEs, development documentation, glossaries, and
project-specific agent guidance belong to the adopting repository, because
they describe it and its projects. Repo Canon shapes them through rules,
adoption guidance, and checks. The Repository license has the fixed target `LICENSE`,
and the Repository README has the fixed target `README.md`. Project-specific
agent guidance has the fixed target `docs/agents/project.md`. The root
`.gitattributes` also belongs to the adopting repository; the contextual
`git-attributes` declaration shapes Repo Canon's language-statistics entries
through its [rules](rules/git-attributes.md) and
[adoption guidance](guidance/git-attributes.md), preserving project content.
In the factory
profile, the toolchain image has the fixed target `.factory/Dockerfile`, which
holds only the repository's toolchain, because each repository's toolchain
differs and the factory adds its own agent layer. Discovery proposes the
concrete paths of Project READMEs at arbitrary locations and of documentation
files, glossaries, and indexes, including documentation moves and link
repairs.
The complete inspection reports when adoption would discard edits. The
maintainer confirms those changes before adoption writes them; routine updates
proceed without additional confirmation. A fix that overwrites an existing
setting likewise waits for confirmation.

## Confirmed preferences

Preferences that a shipped file states are cited here by their home rather than
repeated.

- Name: repo-canon (Repo Canon), distinct from the repo-standards product.
  The GitHub identity is lutzseverino/repo-canon.
- Scope: express the author's preferred standards for any repository whose
  maintainers choose to adopt them, including collaborative repositories and
  repositories maintained by others. The `standard` profile serves every
  adopting repository, and the `factory` profile adds the factory's repository
  files for a repository that a factory serves, as
  [ADR 0017](docs/adr/0017-make-the-factory-an-optional-profile.md) decides.
  The `workbench` profile installs only the workflow skills, with the files
  they import and their license notices, into the orchestrating agent's
  workbench, as [ADR 0027](docs/adr/0027-give-the-workbench-its-own-profile.md)
  decides. The standard and factory profiles carry opt-in stacks scoped per
  Project, as
  [ADR 0024](docs/adr/0024-scope-each-stack-to-the-projects-that-use-it.md)
  decides; no ownership-based differences have been requested.
- The Repository README's title, description, badges, section order, length,
  examples, Features items, and pointer sections are stated in the
  [Repository README rules](rules/repository-readme.md).
- The newcomer rules for entry documents are stated in the
  [Repository README rules](rules/repository-readme.md) and the
  [documentation rules](rules/documentation.md). Their glossary-term
  check accepts that ordinary-English uses of glossary terms fail, and reports
  such false positives as findings rather than widening the check. These newly
  failing checks ship with #368 and #346 in their shared breaking release.
- Project membership and Project README content are stated in the
  [Project README rules](rules/project-readmes.md).
- The `typescript-node` stack is the optional discovered
  `typescript-node-stack` declaration, whose scope is one `package.json` per
  Project that uses it. Its tools and their majors, the workspace-root facts,
  the pull request check, Setup and validation, one-stack and breaking-bump
  requirements are stated in the
  [typescript-node stack rules](rules/typescript-node-stack.md), and the
  membership and assessment steps in its
  [adoption guidance](guidance/typescript-node-stack.md) and
  [discovery guidance](discovery/typescript-node-stack.md). A repository
  without such a Project confirms no scope, which installs no rules and runs no
  check, so the profiles stay stack-free. It installs no configuration or
  workflow file, as
  [ADR 0024](docs/adr/0024-scope-each-stack-to-the-projects-that-use-it.md)
  decides; its read-only check reads only manifest facts, and the assessment
  covers the rest.
- The optional `typescript-astro-stack` and `typescript-vite-stack` declarations
  ship in the standard and factory profiles under [ADR 0026](docs/adr/0026-add-the-typescript-astro-and-typescript-vite-stacks.md).
  Both name the one [shared web rules file](rules/typescript-web-stacks.md).
  Each discovers disjoint manifest scope or no scope, with Node excluding web
  membership. The read-only checks extend Node's manifest boundary only with
  Astro formatter availability and the holder's shadcn configuration, exact
  CLI pin and scripts. Framework, React, Tailwind, TypeScript and runner majors,
  CI, validation execution and UI behavior remain assessed. Discovery evidence
  must distinguish Sites and Apps; tool configuration alone is not a general
  classifier. Shared package membership follows in-stack web consumers, with
  Astro winning; mixed non-web consumers preserve Node eligibility. Differing
  existing Projects need separate migrations, so these optional additions are
  a feature, not a forced migration.
- The documentation requirements are stated in
  [documentation rules](rules/documentation.md), with the adoption steps in
  the [documentation guidance](guidance/documentation.md) and the scope in the
  [documentation discovery guidance](discovery/documentation.md).
  [ADR 0006](docs/adr/0006-keep-point-in-time-records-with-their-event.md) and
  [ADR 0007](docs/adr/0007-keep-superseded-adrs.md) record the decisions on
  point-in-time records and superseded ADRs.
  [ADR 0009](docs/adr/0009-enforce-documentation-rules-as-checks.md) makes the
  documentation check enforce the index entry form, one index per document,
  the development guide's order, and scope coverage, with each check defined
  once in the shared documentation model.
- Include only workflow skills, as
  [ADR 0018](docs/adr/0018-install-only-workflow-skills.md) decides. Upstream's
  promoted set at tag `v1.3.1`, commit
  `24fe0ef7737efae15c87225755e9f6f5965e4888` consists of 20 engineering and seven
  productivity skills, matching its plugin manifest; upstream removed
  `resolving-merge-conflicts`. Experimental skills are excluded; the upstream
  in-progress, misc, and deprecated categories are outside the regular set.
  Repo Canon installs 17 of them: `code-review`, `codebase-design`,
  `diagnosing-bugs`, `domain-modeling`, `grill-with-docs`, `grilling`,
  `implement`, `improve-codebase-architecture`, `pr`, `prototype`, `research`,
  `tdd`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, and
  `writing-for-agents`, 16 from the pin and `triage` as Repo Canon's own fork.
  `prototype` stays because `wayfinder` calls it. The
  vendored tree holds only those skills and the setup seeds that the skill setup
  files are installed from; `implement-spec` is not vendored, because every
  factory run is a direct run, as
  [ADR 0012](docs/adr/0012-run-each-ticket-as-its-own-factory-run.md) decides.
  Routes to `setup-matt-pocock-skills` stay dormant while the skill setup files
  are installed; the route test lists them with that reason.
- The standards source manages reviewed, pinned upstream skill snapshots and
  distributes changes through standards releases. Keep pinned upstream skill
  content intact; Repo Canon's own conventions live in `CONTRIBUTING.md` and the
  rules files, not in the skills or their setup files. The snapshot follows
  the [upstream-compatibility procedure](docs/development/upstream-compatibility.md)
  and is not updated independently by adopting contributors.
- Triage routes each request by where its uncertainty lies, as
  [ADR 0021](docs/adr/0021-route-triage-by-where-its-uncertainty-lies.md)
  decides: research and independent acceptance by the orchestrating agent for
  a code-bound request, and fact-finding and a grilling session with the owner
  before the brief for an intent-bound one. The orchestrating agent infers only
  intent it can cite that does not outlive the work, the grill drafts the
  briefs it accepts, and owner-only questions reach the owner only through its
  decision inbox, as
  [ADR 0025](docs/adr/0025-infer-cited-intent-and-route-owner-questions-through-one-inbox.md)
  decides. The routing and acceptance rules
  live in [`CONTRIBUTING.md`](CONTRIBUTING.md#triage), the readiness
  credentials in the
  [GitHub repository configuration rules](rules/github-repository-configuration.md),
  and the model choice and person-only factory readiness in the
  [factory workflow rules](rules/factory-workflow.md). The method restates
  most of the pinned `triage` procedure, so `triage` is forked under
  [ADR 0019](docs/adr/0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md):
  its source is its installed path, `.agents/skills/triage`, its `CREDITS.md`
  names the upstream commit and what changed, and the forked material keeps
  the upstream notice. The owner first approved a rule that the owner finish
  every brief, then replaced it the same day; no rule restores it.
- Repo Canon writes and installs `orchestrate`, the method by which the
  orchestrating agent the contribution guide names runs a plan across
  tickets. It is a workflow skill under
  [ADR 0018](docs/adr/0018-install-only-workflow-skills.md): the issues it
  files and the briefs it accepts are tracker items the shared workflow relies
  on. Like `triage`, it is user-invoked only, and it is a method under
  [ADR 0016](docs/adr/0016-keep-requirements-in-installed-rules.md): it cites
  the guide for triage, readiness, question routing and delivery. Plan state
  lives in the owner's workbench, a git repository of plain Markdown whose
  path the owner's global agent instructions name, so the skill hard-codes no
  host path. The owner decided on 2026-10-29 that when none is named, the
  skill creates one: a local git repository outside every project checkout,
  private, with a private remote or none, whose `index.md` lists the
  repositories it tracks. The same decision keeps current state in `now.md`,
  rewritten on every pass, with a register of running launches that the launch
  cap counts; the inbox holds only decisions. Two further rules are inferred
  intent from the approved cleanup ticket list of 2026-10-30, open to the
  owner's veto rather than decided by the owner, as
  [#731](https://github.com/lutzseverino/repo-canon/issues/731#issuecomment-6532507498)
  records with both: each plan's `plan.md` holds
  its current state and an append-only `log.md` its history, so a fresh
  session reads current state, not the log; and a filed draft gets a dated
  line at its top linking the issues it became, while decision records stay as
  written. Wishes hold non-finding ideas outside the plan's goal; they may
  link reported findings for future planning. The guide's Findings rule still
  governs every finding, including those outside the goal: a workbench wish
  never replaces filing or linking it and reporting it where the guide requires.
  Shared workflow methods stay application-independent: applications may
  enhance them, but are never dependencies. Application-specific tool mappings
  belong in the owner's own setup outside Repo Canon. The skill and its
  workbench layout use opaque session references and name no private
  application, tool mapping or host details; conformance coverage enforces
  that boundary throughout the installed skill. Its `CREDITS.md` credits Matt
  Pocock's in-progress `chief-of-staff` at the commit it was compared at, whose
  wiki rules the workbench borrows. The owner decided on 2026-10-29 that one
  orchestrating session at a time owns the plans, handing over through
  `index.md` and `now.md` at each plan's close and after any compaction since
  it took over. On 2026-10-30 they decided that it wakes on events: it ends a
  turn only when every in-flight item waits on the owner or has a wake-up
  armed through the harness's own event mechanisms, which `now.md` names, and
  a recurring check is optional. The skill ships a babysit-like wait script
  for that, whose poll interval and maximum duration each invocation supplies,
  with no default; [#732](https://github.com/lutzseverino/repo-canon/issues/732)
  records these decisions. For sessions outside every project checkout, the
  workbench adopts the `workbench` profile, which the skill offers when it
  creates a workbench and the
  [adoption guide](docs/usage/adopt-repo-canon.md#orchestrate-plans)
  describes, replacing the earlier link from a checkout into the user's own
  skills, which followed that checkout's unreleased working tree; the owner
  decided this on 2026-10-30, as
  [ADR 0027](docs/adr/0027-give-the-workbench-its-own-profile.md) records.
- On 2026-10-29 the owner decided that `orchestrate` closes every plan with a
  retro in a separate session reading primary sources, and that each lesson
  goes to whoever owns its rule: the adopter's own repository or setup, a wish,
  nowhere for a one-off, or an issue filed against Repo Canon for a Repo Canon
  skill or rule, because an adopter who does not develop Repo Canon cannot
  change its skills. On 2026-10-30 they decided that a plan names its Close
  reviews at approval: the retro always, and `improve-codebase-architecture`
  proposed for each repository whose code the plan changes, which the owner
  keeps or removes; [#733](https://github.com/lutzseverino/repo-canon/issues/733)
  records these decisions.
- Personal skills, such as `teach` and HumanLayer's `show-me`, are left to each
  maintainer to install from upstream at user scope; the
  [adoption guide](docs/usage/adopt-repo-canon.md#recommended-personal-skills)
  names the recommended ones.
- Delivery belongs to this source, because Repository Standards leaves it to
  standards sources
  ([repo-standards ADR 0015](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/adr/0015-leave-delivery-to-standards-sources.md)).
  The environment carries delivery, as
  [ADR 0010](docs/adr/0010-carry-delivery-rules-in-the-environment.md)
  decides: [`CONTRIBUTING.md`](CONTRIBUTING.md#pull-requests) says how to open
  a pull request, an adoption pull request included, and when it may merge,
  and the installed `AGENTS.md` points every change through `pr` and
  `babysit`. The model-invocable `babysit` skill watches the pull request,
  settles its findings, and merges it, stating no rule the guide or installed
  rules hold. Review follows the guide's
  [review finding rules](CONTRIBUTING.md#merging) and the
  request rule in the
  [GitHub repository configuration rules](rules/github-repository-configuration.md),
  with an optional total request bound in the repository's reviewer data.
  It waits through one bundled script that polls silently for checks and the
  reviewer named by the optional repository-owned
  `.github/pull-request-reviewer.json`, run in the foreground on every host.
  Those rules
  also state when a head with no check counts as passed, and that file's
  schema, which the reviewer check and the wait validate with
  byte-identical copies of one parser. Without that file there is no reviewer wait. Repo Canon ships no reviewer
  file or preset; this repository carries its own configuration, outside the
  declarations. The factory never reads it. Its
  source is its installed path, `.agents/skills/babysit`, as for Repo Canon's
  other original exact files; only vendored material has a separate source
  path.
- The factory is a product of its own, installed on a host from its own
  releases, as
  [ADR 0013](docs/adr/0013-install-the-factory-on-the-host-from-its-own-releases.md)
  decides, and released from its own repository, as
  [ADR 0020](docs/adr/0020-release-the-factory-from-its-own-repository.md)
  decides; every run is a direct run of one ticket, as
  [ADR 0012](docs/adr/0012-run-each-ticket-as-its-own-factory-run.md)
  decides. Repo Canon ships none of its code. A repository the factory serves
  selects the `factory` profile, which installs `.factory/config.json` as an
  exact file: factory configuration version 1, naming Repo Canon's labels, the
  `model:` label prefix, and the `implement` prompt, since the factory has no
  default for any of them, as
  [ADR 0014](docs/adr/0014-name-every-factory-convention-in-configuration.md)
  decides. The profile installs the repository-wide
  [factory workflow rules](rules/factory-workflow.md), with intentionally empty
  confirmed content scope, so tracker work reads them even when it changes no
  file. The profile also installs the contextual `.factory/Dockerfile`,
  toolchain only and Debian-based, as the
  [toolchain image rules](rules/factory-sandbox-image.md) state, and the
  pull request workflow that builds it. The factory workflow rules govern
  ownership of the labels named by the configuration; the canonical labels
  carry no `factory:` label and no `model:` label. The
  [factory's usage documentation](https://github.com/lutzseverino/scriptorium/blob/main/docs/usage/README.md) describes its
  behavior.
- Omit contributor-facing instructions for updating the managed skill
  collection. Contributors to an adopting repository do not maintain the
  standards source.
- Automate objective issue/PR requirements. Incomplete issues should receive
  actionable feedback and remain unready. Agents assess content meaning.
  Automation identifies missing information rather than inventing it.
- When an issue is required is stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#issues). The Direct change route is
  stated in its [pull request rules](CONTRIBUTING.md#pull-requests), and
  [pull request metadata validation](docs/development/pr-metadata-validation.md)
  states what the check accepts. Larger work can use a parent specification and
  implementation tickets; straightforward bugs do not require that hierarchy.
- Implementation contracts, and what an agent reads before implementing one,
  are stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#implementation-contracts).
- Monorepo documentation policy remains independent of directory names. Use
  the delivered v2 discovery interface for arbitrary Project README targets;
  demonstrate complete coverage before claiming monorepo adoption support.
- CONTRIBUTING.md is the one home of Repo Canon's contribution rules: issues
  and implementation contracts, triage, readiness, development setup, validation, pull
  requests, and titles and commits. GitHub specifics and factory-only workflow
  live instead in the installed rules of the declarations they belong to,
  which apply to the whole repository. Every other file cites it
  rather than repeating one of them. Agent implementation procedures belong in
  skills. Files Repo Canon authors do not restate them, and cite them only for
  delivery or to override routes to uninstalled skills: `AGENTS.md` names `pr`
  and `babysit`, and `CONTRIBUTING.md` names
  `pr` for a pull request's body and `repo-standards adopt` for finishing or
  recovering an adoption run, using the pinned runtime once a run has started.
  The skill setup files may cite them.
  CONTRIBUTING.md should be repository-agnostic exact content, copied
  identically between adopting repositories. Its fixed link to
  docs/development/README.md delegates project-specific setup and required
  checks to a project-owned development entry point, required in every
  adopting repository.
- The issue templates under [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE)
  provide the Bug report, Feature request, Implementation ticket, and
  Specification fields. Intake reporters do not need to provide implementation
  plans.
- Pull request descriptions follow the
  [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and the pull request
  rules in [`CONTRIBUTING.md`](CONTRIBUTING.md#pull-requests), including the
  Direct change route and the adoption record accepted as an update pull
  request's description.
  [Pull request metadata validation](docs/development/pr-metadata-validation.md)
  states what the check enforces.
- The readiness rules are stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#readiness), with factory-only parent and
  model gates in the [factory workflow rules](rules/factory-workflow.md), the
  GitHub roles, native blocker mechanics, and the Agent Brief and Wayfinder
  shapes the validator enforces in the
  [GitHub repository configuration rules](rules/github-repository-configuration.md),
  and the mechanism that
  enforces them in
  [issue contract validation](docs/development/issue-contract-validation.md).
- `ready-for-human` marks only work that needs the owner's own accounts or
  credentials, or a taste call the owner reserved. The owner decided this on
  2026-10-25, after the label had also marked agent work the factory could not
  run and confused them. Agent work the factory must not pick up carries
  `ready-for-agent`, a `model:` label and `factory:skip`. The
  [factory workflow rules](rules/factory-workflow.md) own that routing; canonical
  label setup provisions skip only for the factory profile. On 2026-10-29, the
  owner extended skip routing to work whose live steps need host access the
  maintainer grants, and worker handoff to every PR from a directly launched
  worker, including PRs without a skip label; see
  [#739](https://github.com/lutzseverino/repo-canon/issues/739). Host access gates
  only live host steps and does not designate owner review of the source PR.
- Designated owner review has one current-head approval gate in the standard
  and factory profiles,
  stated in the [GitHub repository configuration rules](rules/github-repository-configuration.md#designated-owner-review).
  The owner chose this shared gate on 2026-10-29 in
  [#665](https://github.com/lutzseverino/repo-canon/issues/665#issuecomment-6498159486),
  retaining the otherwise authorized merge actor in the standard profile and
  the orchestrating agent for factory-skip work. The
  [factory workflow rules](rules/factory-workflow.md) retain that profile's
  merge ownership and approval-pause continuation.
  On 2026-10-29, the owner chose the authoritative Implementation contract as
  a designation source alongside the worker handoff, including directly
  authored body contracts, as recorded in
  [#716](https://github.com/lutzseverino/repo-canon/issues/716#issuecomment-6532708764).
  The owner also chose PR comments for designation/provenance and
  approval/source/head-SHA records, preserving adoption PR bodies, on 2026-10-29
  in [#717](https://github.com/lutzseverino/repo-canon/issues/717#issuecomment-6532709093).
- The skill setup files under docs/agents are installed verbatim from the
  vendored upstream setup seeds, and Repo Canon writes nothing into them, as
  [ADR 0008](docs/adr/0008-install-skill-setup-files-verbatim-from-upstream-seeds.md)
  decides. Project-specific guidance remains separate. AGENTS.md is an
  identical standards-owned pointer file. Repository Standards owns the update
  notice through its `repository-standards` system skill
  ([repo-standards ADR 0014](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/adr/0014-leave-available-updates-to-the-maintainer.md)).
  Create the optional project guidance document, docs/agents/project.md, only
  when it has useful content.
- GitHub automation rechecks affected issue, brief, and PR metadata on relevant
  changes. The
  [GitHub repository configuration rules](rules/github-repository-configuration.md)
  make PR validation a required merge check wherever GitHub offers branch
  protection or rulesets for the repository. It is a plan-gated requirement:
  on a private repository whose plan offers neither, it is unavailable rather
  than optional, and adoption completes without it. GitHub runs the PR
  metadata workflow only from the default branch, so the requirement is
  deferred until the workflow is there, and the next adoption or update after
  it merges requires the check.
  [Pull request metadata validation](docs/development/pr-metadata-validation.md)
  and [issue contract validation](docs/development/issue-contract-validation.md)
  state what each check requires and how a contract loses readiness.
- Required checks include the current default branch through GitHub's strict
  up-to-date-branch enforcement for every adopter. Setup reconciles classic
  protection and managed rulesets with confirmation and readback, preserving
  unrelated policy. Babysit returns a stale PR to a bounded branch update,
  validation and review cycle; GitHub guards the race at merge time. Unavailable,
  unreadable or unconfirmed enforcement stops unattended merging even when
  adoption deferred setup. The owner accepted extra CI runs for concurrent PRs
  in [#656](https://github.com/lutzseverino/repo-canon/issues/656#issuecomment-6451776114).
  On 2026-10-29, approved for filing on 2026-10-30, the owner chose one
  orchestrator recovery for a stopped ordinary factory run with an open PR,
  recorded in [#740](https://github.com/lutzseverino/repo-canon/issues/740#issuecomment-6532707688).
  The factory workflow rules authorize that handoff, and babysit reuses its
  local branch-update recovery. The waiting marker prevents concurrent factory
  resumption; the merge record stays in a PR comment. Each waiting PR refreshes
  its own base, with no shared queue.
- Accepted automation prerequisites are GitHub Actions, permission to update
  issue labels/comments, and repository-setup permission for labels and branch
  rules. Metadata validation runs trusted code without executing PR-supplied
  code. Remote settings need actual provisioning; copied configuration is not
  evidence that those settings exist.
- The Repository README, Project README, and documentation guidance each state
  what their read-only check covers, and the findings identify specific
  corrections. Agents assess factual descriptions, technology badges,
  commands, and meaningful placement. Confirmed scope and repository evidence
  establish monorepo coverage; standalone documentation checks do not establish
  complete adoption.
- Issue titles, pull request titles, commits, and squash merges follow
  [`CONTRIBUTING.md`](CONTRIBUTING.md#titles-and-commits) and its issue and pull
  request rules, and [ADR 0002](docs/adr/0002-squash-reviewed-changes.md)
  records the squash decision. This does not prohibit local merge/rebase
  operations or govern integration between working branches. GitHub squash
  defaults remain editable at merge time; configuration and title checks are not
  an immutable final-message guarantee.
- The attribution rule lives in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#agents-on-the-maintainers-account). Its guard is that
  rule, the tool-agnostic PR metadata check, and an explicit squash subject and
  body supplied by `babysit`. The standard declares no per-tool attribution
  settings. Published history stays unchanged because tags and adopters' locks
  pin existing commits.
- The contextual `project-agent-guidance` declaration preserves useful
  repository-specific AGENTS.md instructions during adoption, under its
  [adoption guidance](guidance/project-agent-guidance.md) and
  [rules](rules/project-agent-guidance.md). It owns docs/agents/project.md
  separately from documentation scope; an update drafts that scope without it.
- Adoption uses repeat-safe authored operations to configure GitHub labels,
  required checks, and squash defaults, as the
  [GitHub repository configuration guidance](guidance/github-repository-configuration.md)
  describes. These operations do not create a built-in GitHub governance
  subsystem.

## Verified upstream facts

- The 17 installed workflow skills are self-contained with respect to concrete internal
  skill invocations and referenced resources; none requires an experimental,
  miscellaneous, or deprecated skill. Full directories must be retained.
  Harness facilities such as subagents and context controls remain runtime
  capabilities, not additional skills.
- Upstream's GitHub tracker, domain, and triage-label setup seeds can be shared
  without repository-name substitution. Git remotes supply repository identity.
  The seeds do not provision remote labels or repository branch rules.
- Upstream recognizes an Agent Brief heading but provides no approval marker,
  approved-revision selector, or revision invalidation mechanism. Repo Canon's
  readiness rules are its own convention and live in `CONTRIBUTING.md`, the
  GitHub repository configuration rules, and its automation, preserving
  pinned upstream skill content.

## Source profile

The complete `repo-standards/v2` source is `standards.yaml`, with the
`standard` and `factory` profiles and the open-ended CLI compatibility minimum
`>=10.0.0`. The
concise policy-to-declaration, material, operation, ownership, and prerequisite
mapping is maintained in [the source profile](docs/development/source-profile.md).
Contextual Project README and documentation scope uses separate assessment and
discovery guidance and resolves to individual adopter-reviewed paths.

[Adoption compatibility](docs/development/adoption-compatibility.md) maps the
accepted requirements to the delivered product interface. Use installed public
CLI 10.0.0 as the current validation baseline; claim only compatibility
demonstrated against the released source bytes.

## License

The author selected the MIT License for Repo Canon's original material, with
the notice `Copyright (c) 2026 Jasper Lutz Severino`. Preserve required
upstream notices; this choice does not replace third-party licenses or choose
an adopting repository's license. The root license covers original Repo Canon
material; third-party material retains its accompanying licenses and notices.

## Delivery boundary

Author a separate local standards source. Repository provisioning, publication,
and adoption are separate workflows. Do not change the Repository Standards
product contracts to implement these personal preferences.

## Release versioning

- Use SemVer for Repo Canon releases, following the observed release practice
  of `repo-standards`. The owner chose the adoption product as the deciding
  precedent. The [versioning decision](docs/adr/0003-follow-product-release-versioning.md)
  records that rationale and its evidence.
- Consider a stable `1.0.0` baseline after gaining experience from real
  adoptions.
- Judge compatibility from the adopter's perspective. New mandatory migration
  work and incompatible workflow requirements are breaking standards changes;
  a newly required README section that makes a previously conforming repository
  fail is one example.
- During `0.x`, features and breaking changes advance the middle number;
  compatible fixes advance the last number. Release notes explicitly identify
  breaking changes because a middle-number bump can also contain compatible
  features. The [versioning guide](docs/usage/versioning.md) records these rules.
