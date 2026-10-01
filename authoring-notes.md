# Repo Canon authoring notes

These notes are the one home for Repo Canon's confirmed authoring decisions and
their rationale. They stay beside `standards.yaml`, the source they explain.

## Ownership

Repo Canon owns a file only when every adopting repository should hold the
same bytes. Exact content includes `AGENTS.md`, `CONTRIBUTING.md`, the issue
and pull request templates, the skill setup files under `docs/agents`, the
trusted validation workflows with their scripts, the vendored rendered-Markdown
runtime and parsers with their notices, and the pinned skills with their
upstream license notice. It is installed identically in every
adopting repository and changes only through a Repo Canon release.

`guidance/` and `discovery/` are source-side instructions for the agent that
adopts Repo Canon. They are not installed as documents of the adopting
repository; the CLI only retains them with the other source inputs.

READMEs, development documentation, glossaries, and project-specific agent
guidance belong to the adopting repository, because they describe it and its
projects. Repo Canon shapes them through contextual guidance and checks. The
Repository README has the fixed target `README.md`. Discovery proposes the
concrete paths of Project READMEs at arbitrary locations and of documentation
files, glossaries, and indexes, including documentation moves and link repairs.
The maintainer confirms the complete inspection before adoption writes any of
them.

## Confirmed preferences

Preferences that a shipped file states are cited here by their home rather than
repeated.

- Name: repo-canon (Repo Canon), distinct from the repo-standards product.
  The GitHub identity is lutzseverino/repo-canon.
- Scope: express the author's preferred standards for any repository whose
  maintainers choose to adopt them, including collaborative repositories and
  repositories maintained by others. Start with one complete profile; no
  ownership-based differences have been requested.
- The Repository README's title, description, badges, section order, length,
  examples, Features items, and pointer sections are stated in the
  [Repository README guidance](guidance/repository-readme.md).
- Project membership and Project README content are stated in the
  [Project README guidance](guidance/project-readmes.md).
- The documentation rules are stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#documentation), with the adoption steps in
  the [documentation guidance](guidance/documentation.md) and the scope in the
  [documentation discovery guidance](discovery/documentation.md).
  [ADR 0006](docs/adr/0006-keep-point-in-time-records-with-their-event.md) and
  [ADR 0007](docs/adr/0007-keep-superseded-adrs.md) record the decisions on
  point-in-time records and superseded ADRs. These rules stay contextual; the
  documentation check keeps its mechanical scope.
- Include all regular Matt Pocock skills. Upstream's promoted set at commit
  `3cca18b368ae95cdbdebbff572ccafa662551015` consists of 18 engineering and seven
  productivity skills, matching its plugin manifest. Experimental skills are
  excluded; the upstream in-progress, misc, and deprecated categories are
  outside the regular set. No additional regular-skill exclusions are agreed.
- The standards source manages reviewed, pinned upstream skill snapshots and
  distributes changes through standards releases. Keep upstream skill content
  intact; Repo Canon's own conventions live in `CONTRIBUTING.md` and the
  guidance files, not in the skills or their setup files.
- Omit contributor-facing instructions for updating the managed skill
  collection. Contributors to an adopting repository do not maintain the
  standards source.
- Automate objective issue/PR requirements. Incomplete issues should receive
  actionable feedback and remain unready. Agents assess content meaning.
  Automation identifies missing information rather than inventing it.
- When an issue is required is stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#issues). The small-correction exemption is
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
  and implementation contracts, readiness, development setup, validation, pull
  requests, titles and commits, and documentation. Every other file cites it
  rather than repeating one of them. Agent implementation procedures belong in
  skills. Files Repo Canon authors do not restate or cite them; the skill setup
  files may, and AGENTS.md may name the Repository Standards adoption skill.
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
  small-correction exemption and the adoption record accepted as an update pull
  request's description.
  [Pull request metadata validation](docs/development/pr-metadata-validation.md)
  states what the check enforces.
- The readiness rules are stated in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#readiness), and the mechanism that
  enforces them in
  [issue contract validation](docs/development/issue-contract-validation.md).
- The skill setup files under docs/agents are installed verbatim from the
  vendored upstream setup seeds, and Repo Canon writes nothing into them, as
  [ADR 0008](docs/adr/0008-install-skill-setup-files-verbatim-from-upstream-seeds.md)
  decides. Project-specific guidance remains separate. AGENTS.md is an
  identical standards-owned pointer file, and its Available updates section is
  the home of the shared available-updates guidance. Create the optional
  project guidance document, docs/agents/project.md, only when it has useful
  content.
- GitHub automation rechecks affected issue, brief, and PR metadata on relevant
  changes. The
  [GitHub repository configuration guidance](guidance/github-repository-configuration.md)
  makes PR validation a required merge check.
  [Pull request metadata validation](docs/development/pr-metadata-validation.md)
  and [issue contract validation](docs/development/issue-contract-validation.md)
  state what each check requires and how a contract loses readiness.
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
- When an existing AGENTS.md contains useful project-specific instructions,
  preserve and reconcile them into docs/agents/project.md in a separate
  preparation change, committed through the project's normal workflow before
  a fresh inspection and adoption. This is the chosen existing-tool route;
  integrated preparation support is not required for this standards source.
- Adoption uses repeat-safe authored operations to configure GitHub labels,
  required checks, and squash defaults, as the
  [GitHub repository configuration guidance](guidance/github-repository-configuration.md)
  describes. These operations do not create a built-in GitHub governance
  subsystem.

## Verified upstream facts

- The 25 promoted skills are self-contained with respect to concrete internal
  skill invocations and referenced resources; none requires an experimental,
  miscellaneous, or deprecated skill. Full directories must be retained.
  Harness facilities such as subagents and context controls remain runtime
  capabilities, not additional skills.
- Upstream's GitHub tracker, domain, and triage-label setup seeds can be shared
  without repository-name substitution. Git remotes supply repository identity.
  The seeds do not provision remote labels or repository branch rules.
- Upstream recognizes an Agent Brief heading but provides no approval marker,
  approved-revision selector, or revision invalidation mechanism. Repo Canon's
  readiness rules are its own convention and live in `CONTRIBUTING.md` and its
  automation, preserving upstream skill content.

## Source profile

The complete `repo-standards/v2` source is `standards.yaml`, with one
`complete` profile and the open-ended CLI compatibility minimum `>=2.0.0`. The
concise policy-to-declaration, material, operation, ownership, and prerequisite
mapping is maintained in [the source profile](docs/development/source-profile.md).
Contextual Project README and documentation scope uses separate assessment and
discovery guidance and resolves to individual adopter-reviewed paths.

[Adoption compatibility](docs/development/adoption-compatibility.md) maps the
accepted requirements to the delivered product interface. Use installed public
CLI 2.0.0 as the current validation baseline; claim only compatibility
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
