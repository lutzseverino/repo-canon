# Repo Canon authoring notes

These notes index Repo Canon's confirmed authoring decisions and their rationale.
They link to decision records, policy homes and methods beside `standards.yaml`,
the source they explain.

## Ownership

Exact content carries the standard's values; contextual files describe the
adopting repository. [ADR 0033](docs/adr/0033-give-every-value-one-value-owner.md)
records the value-owner decision, and the
[source profile's ownership map](docs/development/source-profile.md#policy-and-ownership-map)
identifies each declaration's material and ownership.

[ADR 0016](docs/adr/0016-keep-requirements-in-installed-rules.md) separates
lasting requirements in installed rules from adoption guidance and skill
methods. The [authoring procedure](docs/development/authoring-and-publication.md)
and [adoption compatibility](docs/development/adoption-compatibility.md)
describe the source interface and confirmation of changes during adoption.

## Confirmed preferences

Preferences that a shipped file states are cited here by their home rather than
repeated.

- Name: repo-canon (Repo Canon), distinct from the repo-standards product.
  The GitHub identity is lutzseverino/repo-canon.
- Scope: the author's preferred standards for maintainers who choose them,
  including collaborative and other-maintained repositories; no
  ownership-based differences have been requested.
  [ADR 0017](docs/adr/0017-make-the-factory-an-optional-profile.md),
  [ADR 0027](docs/adr/0027-give-the-workbench-its-own-profile.md) and
  [ADR 0024](docs/adr/0024-scope-each-stack-to-the-projects-that-use-it.md)
  record profile and optional-stack decisions. The maintained inventory is
  in the [source profile](docs/development/source-profile.md).
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
- Stack ownership and optional scope are recorded in
  [ADR 0024](docs/adr/0024-scope-each-stack-to-the-projects-that-use-it.md).
  The [Node rules](rules/typescript-node-stack.md),
  [adoption guidance](guidance/typescript-node-stack.md) and
  [discovery guidance](discovery/typescript-node-stack.md) own requirements,
  assessment and scope selection respectively.
  [ADR 0026](docs/adr/0026-add-the-typescript-astro-and-typescript-vite-stacks.md)
  records the optional web-stack additions and why differing Projects need
  separate migrations rather than a forced migration. Their requirements and
  check/assessment split live in the [web rules](rules/typescript-web-stacks.md).
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
- The workflow-only selection rationale is in
  [ADR 0018](docs/adr/0018-install-only-workflow-skills.md); current selection
  and bases live in [standards.yaml](standards.yaml) and
  [upstream-bases.json](upstream-bases.json).
  `prototype` stays because `wayfinder` calls it; `implement-spec` is absent
  because factory tickets are direct runs under
  [ADR 0012](docs/adr/0012-run-each-ticket-as-its-own-factory-run.md).
- [ADR 0028](docs/adr/0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md)
  records skill and setup-file ownership. The
  [upstream compatibility record](docs/development/upstream-compatibility.md)
  owns base records, credits and reconciliation.
  The owner chose standalone skill use on 2026-10-31 in
  [#787](https://github.com/lutzseverino/repo-canon/issues/787);
  [owned-skill validation](docs/development/README.md#setup-and-validation)
  documents the declared-read and application-independence checks.
- Triage and inference decisions are recorded in
  [ADR 0021](docs/adr/0021-route-triage-by-where-its-uncertainty-lies.md),
  [ADR 0025](docs/adr/0025-infer-cited-intent-and-route-owner-questions-through-one-inbox.md)
  and the factory-triage exception in
  [ADR 0030](docs/adr/0030-let-factory-triage-accept-its-own-brief.md).
  They preserve the rationale and supersession of the owner's initial
  finish-every-brief choice. Current policy lives in
  [Triage](CONTRIBUTING.md#triage),
  [Readiness](CONTRIBUTING.md#readiness), the
  [GitHub rules](rules/github-repository-configuration.md#readiness-roles)
  and [factory rules](rules/factory-workflow.md#triage-run);
  the method lives in [triage](.agents/skills/triage/SKILL.md).
- Publication, inference and intake decisions of 2026-11-06, 2026-11-08 and
  2026-11-09 are recorded in
  [#912](https://github.com/lutzseverino/repo-canon/issues/912#issuecomment-6750712597).
  Their homes are [Triage](CONTRIBUTING.md#triage) and the factory rules'
  [Canonical stages](rules/factory-workflow.md#canonical-stages).
- Orchestration is a workflow method under ADRs 0016 and 0018, implemented by
  [orchestrate](.agents/skills/orchestrate/SKILL.md). Its decision records are:
  - [#731](https://github.com/lutzseverino/repo-canon/issues/731#issuecomment-6532507498):
    the owner's 2026-10-29 workbench and current-state decisions, and the
    2026-10-30 inferred plan/history separation and draft disposition, open
    to veto. The rationale is to let a fresh session read current state
    without replaying history; [templates](.agents/skills/orchestrate/references/templates.md)
    own the layout.
  - [#732](https://github.com/lutzseverino/repo-canon/issues/732): single-session
    ownership (2026-10-29) and event-driven progress (2026-10-30).
    [Launches](.agents/skills/orchestrate/references/launches.md) and the
    [wait step](.agents/skills/orchestrate/SKILL.md#the-wait-step) own the methods.
  - [ADR 0027](docs/adr/0027-give-the-workbench-its-own-profile.md): the
    2026-10-30 replacement of checkout-linked user skills, whose bytes
    followed unreleased work, with a released workbench profile.
  - [#733](https://github.com/lutzseverino/repo-canon/issues/733): separate
    retros and routing lessons to their rule owner (2026-10-29), and Close
    reviews named at plan approval (2026-10-30). The
    [Close procedure](.agents/skills/orchestrate/references/close.md) owns the method;
    an adopter cannot edit Canon's skills to fix a Canon-owned lesson.
  - [#790](https://github.com/lutzseverino/repo-canon/issues/790): the
    2026-10-31 short-core/reference split, keeping factory method in
    [factory](.agents/skills/factory/SKILL.md) because workbenches install none.
  - [#792](https://github.com/lutzseverino/repo-canon/issues/792): the
    2026-10-31 incoming-message decision; the
    [incoming template](.agents/skills/orchestrate/references/templates.md#incoming)
    owns the transport and consumption method.
  - [#791](https://github.com/lutzseverino/repo-canon/issues/791): the
    2026-10-31 immediate-work approval and pause-ownership decision; see
    [Expedited change](.agents/skills/orchestrate/references/launches.md#expedited-change).
    Application independence keeps shared methods usable across hosts;
    [orchestrate](.agents/skills/orchestrate/SKILL.md) owns the capability-based
    method and its credits name the compared `chief-of-staff` source.
- Personal skills, such as `teach` and HumanLayer's `show-me`, are left to each
  maintainer to install from upstream at user scope; the
  [adoption guide](docs/usage/adopt-repo-canon.md#recommended-personal-skills)
  names the recommended ones.
- Delivery belongs to standards sources under
  [Repository Standards ADR 0015](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/adr/0015-leave-delivery-to-standards-sources.md).
  [ADR 0010](docs/adr/0010-carry-delivery-rules-in-the-environment.md)
  records the environment-carried decision. Current requirements live in
  [Pull requests](CONTRIBUTING.md#pull-requests) and the
  [GitHub rules](rules/github-repository-configuration.md); methods live in
  [implement](.agents/skills/implement/SKILL.md),
  [review](.agents/skills/review/SKILL.md) and
  [babysit](.agents/skills/babysit/SKILL.md).
  The [#746 decision of 2026-10-29](https://github.com/lutzseverino/repo-canon/issues/746#issuecomment-6533150044)
  records the post-adoption app-author policy opt-in;
  [factory adoption guidance](guidance/factory-workflow.md) owns its method.
  [ADR 0015](docs/adr/0015-configure-the-pull-request-reviewer-as-repository-data.md)
  records why reviewer choice is repository data; its schema and behavior
  live in the [reviewer rules](rules/github-repository-configuration.md#pull-request-reviewer-file).
- The factory product boundary is recorded in
  [ADR 0013](docs/adr/0013-install-the-factory-on-the-host-from-its-own-releases.md),
  [ADR 0020](docs/adr/0020-release-the-factory-from-its-own-repository.md)
  and [ADR 0012](docs/adr/0012-run-each-ticket-as-its-own-factory-run.md).
  Repo Canon ships conventions, not factory code.
  [ADR 0014](docs/adr/0014-name-every-factory-convention-in-configuration.md)
  records why configuration is explicit. The owner chose optional run kinds
  and gates on 2026-11-03 and 2026-11-04 (plan 16, D1–D4, D7–D8), recorded in
  [#854](https://github.com/lutzseverino/repo-canon/issues/854) and the factory's
  [ADR 0008](https://github.com/lutzseverino/scriptorium/blob/5e7ecf2593cd534cfb9050a7385dbda71b5102f9/docs/adr/0008-split-work-into-run-kinds-handed-off-by-the-host.md).
  Current mechanics live in [Run kinds](rules/factory-workflow.md#run-kinds)
  and [.scriptorium/config.json](.scriptorium/config.json);
  toolchain ownership lives in the [image rules](rules/factory-sandbox-image.md).
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
- [ADR 0016](docs/adr/0016-keep-requirements-in-installed-rules.md) records the
  contribution guide/rules/skills split. The exact, repository-agnostic
  [contribution guide](CONTRIBUTING.md) delegates project setup and checks to
  the adopting repository's [development guide](docs/development/README.md).
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
- Readiness policy lives in [Readiness](CONTRIBUTING.md#readiness), the
  [factory rules](rules/factory-workflow.md#parent-readiness) and the
  [GitHub rules](rules/github-repository-configuration.md#readiness-roles);
  [issue contract validation](docs/development/issue-contract-validation.md)
  describes its enforcement.
- [ADR 0031](docs/adr/0031-name-labels-by-family.md) records the label-family
  decision of 2026-11-04 (plan 16, D10–D12), including reporter routing,
  question-state replacement, priority ownership and the unfamilied `wontfix`
  outcome. Current meanings and migration live in the
  [label rules](rules/github-repository-configuration.md#labels) and
  [factory state rules](rules/factory-workflow.md#state-labels).
- On 2026-10-25, the owner separated owner-only work from agent work the
  factory cannot run because the shared label had confused them.
  [#739](https://github.com/lutzseverino/repo-canon/issues/739) records the
  2026-10-29 host-access and direct-worker-handoff extension, distinguishing
  live access from source-PR owner review.
  [#793](https://github.com/lutzseverino/repo-canon/issues/793) records the
  2026-10-31 progress-recording, source/live-acceptance split and host-grant
  ownership decisions. Current homes are
  [Implementation contracts](CONTRIBUTING.md#implementation-contracts) and
  [Skipped work](rules/factory-workflow.md#skipped-work).
- Designated owner review's 2026-10-29 decisions are recorded in
  [#665](https://github.com/lutzseverino/repo-canon/issues/665#issuecomment-6498159486)
  (shared current-head approval gate and merge ownership),
  [#716](https://github.com/lutzseverino/repo-canon/issues/716#issuecomment-6532708764)
  (implementation-contract designation), and
  [#717](https://github.com/lutzseverino/repo-canon/issues/717#issuecomment-6532709093)
  (PR-comment provenance and approval records, preserving adoption bodies).
  Current policy lives in the [owner-review rules](rules/github-repository-configuration.md#designated-owner-review)
  and [factory rules](rules/factory-workflow.md#state-labels).
- [ADR 0028](docs/adr/0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md)
  supersedes ADR 0008's verbatim setup-seed rule. The
  [base records](upstream-bases.json) distinguish unchanged and owned edits;
  [project guidance rules](rules/project-agent-guidance.md) keep local constraints
  separate. Repository Standards owns update notices under its
  [ADR 0014](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/adr/0014-leave-available-updates-to-the-maintainer.md).
- GitHub automation and plan-gated enforcement live in the
  [GitHub rules](rules/github-repository-configuration.md), with mechanisms in
  [PR metadata validation](docs/development/pr-metadata-validation.md) and
  [issue contract validation](docs/development/issue-contract-validation.md).
  The owner accepted extra CI runs for concurrent PRs in
  [#656](https://github.com/lutzseverino/repo-canon/issues/656#issuecomment-6451776114).
  On 2026-11-02, the owner accepted the residual concurrent-base race only
  for proven private-plan enforcement unavailability in
  [#814](https://github.com/lutzseverino/repo-canon/issues/814#issuecomment-6578631340);
  [Required-check freshness](rules/github-repository-configuration.md#required-check-freshness)
  owns that policy.
  The single orchestrator recovery for a stopped ordinary run with an open
  PR was chosen on 2026-10-29 and approved for filing on 2026-10-30 in
  [#740](https://github.com/lutzseverino/repo-canon/issues/740#issuecomment-6532707688).
  [Factory stops](rules/factory-workflow.md#questions-and-stops)
  owns its requirements; [babysit](.agents/skills/babysit/SKILL.md) owns its method.
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
- Title and squash policy lives in
  [Titles and commits](CONTRIBUTING.md#titles-and-commits) and
  [Merging](CONTRIBUTING.md#merging), with rationale in
  [ADR 0002](docs/adr/0002-squash-reviewed-changes.md).
  Editable GitHub squash defaults cannot guarantee the final message.
- Attribution policy lives in
  [Agents on the maintainer's account](CONTRIBUTING.md#agents-on-the-maintainers-account).
  Published history remains unchanged because tags and adopter locks pin it;
  Canon declares no per-tool attribution settings.
- Comment policy lives in [comment rules](rules/comments.md).
  The owner chose the shared comment home and per-round review record on
  2026-11-03 and 2026-11-04 in the plan 16 grill, recorded in
  [#848](https://github.com/lutzseverino/repo-canon/issues/848#issuecomment-6658040589).
  The independent implemented-PR review decision from that session is recorded in
  [#851](https://github.com/lutzseverino/repo-canon/issues/851#issuecomment-6658042133);
  its policy lives in the [review rules](rules/github-repository-configuration.md#review-of-an-implemented-pull-request).
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

- The installed workflow skills are self-contained with respect to concrete internal
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
  GitHub repository configuration rules, and its automation.

## Source profile

[standards.yaml](standards.yaml) is the source manifest. The maintained
[source profile](docs/development/source-profile.md) describes its profiles,
ownership, operations and CLI prerequisites;
[adoption compatibility](docs/development/adoption-compatibility.md) maps the
accepted requirements to the delivered interface. The
[validation boundary](docs/development/source-profile.md#validation-boundary)
distinguishes source validation from adoption evidence.

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

[ADR 0003](docs/adr/0003-follow-product-release-versioning.md) records why
the owner chose Repository Standards' release practice as the precedent.
The [versioning guide](docs/usage/versioning.md) owns the compatibility and
version-bump policy. A stable `1.0.0` baseline remains a consideration after
experience from real adoptions.
