# Repo Canon authoring notes

Status: policy decisions settled; shared contribution and agent workflow
material reviewed. The complete source profile is authored and structurally
validated with public CLI 1.2.1. Complete adoption evidence remains outstanding,
so this repository is not yet an adoption-ready release.

## Confirmed preferences

- Name: repo-canon (Repo Canon), distinct from the repo-standards product.
  The GitHub identity is lutzseverino/repo-canon. Repository creation is a
  work-in-progress bootstrap, separate from a published standards release.
- Scope: express the author's preferred standards for any repository whose
  maintainers choose to adopt them, including collaborative repositories and
  repositories maintained by others. Start with one complete profile; no
  ownership-based differences have been requested.
- Repository README: centered title, one-sentence description, and technology
  badges for major languages, frameworks, and runtimes rather than every
  development dependency.
- Recognized README sections have this relative order: Installation, Features,
  Usage, Configuration, Documentation, Contributing, License. Installation is
  the first section when applicable. Omit inapplicable sections; place useful
  project-specific sections appropriately between recognized sections.
- Keep READMEs concise, aiming for roughly 300 prose words without a hard limit.
  Give the shortest working installation path and one representative usage
  example; link detailed explanations elsewhere.
- Contributing sections link to CONTRIBUTING.md. The License section contains
  only a link using the actual license name and the repository LICENSE file.
  This standard does not choose the project's license.
- Each maintained monorepo app, service, library, or tool with its own
  responsibility and development commands has a project README, including
  internal packages. Fixtures, generated code, and organizational directories
  do not qualify. Project READMEs use a plain title and describe purpose,
  commands, important configuration, and relevant documentation.
- Documentation is fully categorized under docs/usage (using, configuring,
  integrating), docs/development (building, testing, architecture,
  maintenance), docs/adr (consequential decisions), and docs/agents (agent
  workflow configuration). Create categories when they have content. Every
  documentation directory has a short README explaining its purpose and
  linking useful contents; docs/README.md supplies the documentation map and
  placement rules. Durable research belongs under its relevant usage or
  development topic. CONTEXT.md remains the root glossary.
- Include all regular Matt Pocock skills. Upstream's promoted set at commit
  `3cca18b368ae95cdbdebbff572ccafa662551015` consists of 18 engineering and seven
  productivity skills, matching its plugin manifest. Experimental skills are
  excluded; the upstream in-progress, misc, and deprecated categories are
  outside the regular set. No additional regular-skill exclusions are agreed.
- The standards source manages reviewed, pinned upstream skill snapshots and
  distributes changes through standards releases. Keep upstream skill content
  intact and express repository conventions through configuration.
- Omit contributor-facing instructions for updating the managed skill
  collection. Contributors to an adopting project do not maintain the
  standards source.
- Automate objective issue/PR requirements. Failed PR validation should block
  merging; incomplete issues should receive actionable feedback and remain
  unready. Agents assess content meaning. Automation identifies missing
  information rather than inventing it. Concrete behavior, permissions, and
  fixture exercises are implemented; remote execution remains separate.
- Behavior changes and substantive work require an issue. Small corrections
  such as typos, broken links, and formatting may explain their purpose in the
  PR alone. Larger work can use a parent specification and implementation
  tickets; straightforward bugs do not require that hierarchy.
- A triaged request's approved agent-brief comment is its implementation
  contract. Directly authored specifications and tickets use their issue
  bodies. Agents read the full issue and blockers, clarify contradictions,
  and validate the applicable contract rather than only the intake body.
- Monorepo documentation policy remains independent of directory names. Use
  the delivered v2 discovery interface for arbitrary Project README targets;
  demonstrate complete coverage before claiming monorepo adoption support.
  The original v1 capability gap remains historical evidence in the
  compatibility audit.
- CONTRIBUTING.md states contributor-facing requirements for getting a change
  accepted: issue expectations, development setup, validation, and PR/review
  expectations. Agent implementation procedures belong in skills. The file
  should be repository-agnostic exact content, copied identically between
  adopting projects. The concrete draft is drafts/CONTRIBUTING.md; its fixed
  link to docs/development/README.md delegates project-specific setup and
  required checks to a project-owned development entry point, required in
  every adopting repository. The complete draft received author acceptance.
- Provide Bug report (reproduction and expected/actual behavior), Feature
  request (problem and desired outcome), Implementation ticket (scope,
  acceptance, blockers, optional parent), and Specification issue templates.
  Intake reporters do not need to provide implementation plans.
- PRs use Summary, Validation, and Related issue, with Limits only when
  relevant. Summary explains the problem and resulting change; Validation
  records what actually ran and its outcome. Small corrections can omit an
  issue link under the agreed exception.
- The latest agent brief is the candidate implementation contract. A
  maintainer or explicitly authorized triaging agent marks it ready after
  review. Editing or replacing the brief removes readiness and requires
  review again. Structural automation may remove readiness for missing
  requirements; passing checks never grants readiness by itself.
- Initial agent setup uses shared GitHub tracker, domain, and label
  configuration under docs/agents, infers repository identity from Git remotes,
  uses CONTEXT.md and docs/adr, and includes the approved brief convention.
  Use upstream's standard triage and planning labels; external PR triage is
  off. AGENTS.md is an identical standards-owned pointer file, accepted in full
  as drafts/AGENTS.md. Preserve and reconcile existing project-specific
  instructions in optional docs/agents/project.md before replacing the original
  file. This supersedes the earlier contextual AGENTS choice. Create the
  project guidance document only when it has useful content.
- GitHub automation rechecks affected issue, brief, and PR metadata on relevant
  changes. PRs require nonempty Summary and Validation plus an issue reference
  or an explicit small-correction explanation; leftover placeholders fail.
  Issues require their template fields and applicable implementation contract
  before readiness. Invalid or changed contracts lose readiness and receive
  one maintained feedback comment. Corrections return to review; automation
  never grants readiness. PR validation is a required merge check alongside
  the adopting repository's own checks.
- Accepted automation prerequisites are GitHub Actions, permission to update
  issue labels/comments, and repository-setup permission for labels and branch
  rules. Metadata validation runs trusted code without executing PR-supplied
  code. Remote settings need actual provisioning; copied configuration is not
  evidence that those settings exist.
- Read-only documentation checks cover the centered root title, recognized
  section order, license-link format, required development guide, documentation
  categories, directory READMEs, and local file-link targets. Findings identify
  specific corrections. Agents assess factual descriptions, technology badges,
  commands, and meaningful placement. Approximate length remains guidance;
  missing or ambiguous licensing requires maintainer clarification. Confirmed
  scope and repository evidence establish monorepo coverage; standalone
  documentation checks do not establish complete adoption.
- Issue titles use concise sentence case and domain terminology. Bugs name
  observable failures; features name desired capabilities; implementation
  tickets name concrete actions; specifications name the capability being
  specified. Avoid redundant type prefixes, issue numbers, and trailing
  periods. Roughly 72 characters is guidance, not a hard limit.
- PR titles and final commits on the default branch use Conventional Commits.
  Types are lowercase feat, fix, docs, refactor, perf, test, build, ci, style,
  chore, and revert. Optional scopes name stable components or projects.
  Descriptions state concise actions without trailing periods, preserving
  proper names and identifiers. Style means formatting changes. Breaking
  changes require ! and a body explanation of impact and migration.
- Squash-merge PRs into the default branch. Use the PR title as the squash
  subject and the PR description as its body, preserving issue references and
  breaking-change explanations. Prefer Conventional Commits during development
  but permit temporary work-in-progress commits. Require PR-title validation
  before merging; semantic type accuracy remains a review responsibility.
  This does not prohibit local merge/rebase operations or govern integration
  between working branches. GitHub squash defaults remain editable at merge
  time; configuration and title checks are not an immutable final-message
  guarantee.
- These title and commit rules extend the shared CONTRIBUTING.md draft. The
  revised complete file is included in the final design review.
- The shared tracker, domain, and triage-label configuration files are
  standards-owned exact content, identical between adopting repositories.
  Project-specific guidance remains separate. Reorganize existing docs using
  confirmed individual contextual file paths while preserving exact files.
- When an existing AGENTS.md contains useful project-specific instructions,
  preserve and reconcile them into docs/agents/project.md in a separate
  preparation change, committed through the project's normal workflow before
  a fresh inspection and adoption. This is the chosen existing-tool route;
  integrated preparation support is not required for this standards source.
- Adoption uses repeat-safe authored operations to configure GitHub labels,
  required checks, and squash defaults. They verify repository identity,
  preserve unrelated settings, apply the agreed configuration, and read it
  back. Repetition with matching settings is unchanged. Missing authenticated
  access or required permissions leaves setup explicitly incomplete. These
  operations do not create a built-in GitHub governance subsystem.

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
  approved-revision selector, or revision invalidation mechanism. The accepted
  readiness rule above is this standards source's convention and belongs in
  its configuration and automation, preserving upstream skill content.
- The reviewed shared contribution and agent configuration files are
  byte-identical between their final locations and `drafts/` review copies.
  The four public forms preserve optional answers and the native planning
  formats; the PR template preserves the agreed small-correction and
  conditional Limits behavior. The material review and separate committed
  preparation exercises are recorded in
  `docs/development/shared-material-review.md`.

## Source profile

The complete `repo-standards/v2` source is `standards.yaml`, with one
`complete` profile and exact CLI compatibility `1.2.1`. The concise
policy-to-declaration, material, operation, ownership, and prerequisite mapping
is maintained in
[the source profile record](docs/development/source-profile.md). Contextual
Project README and documentation scope uses separate assessment and discovery
guidance and resolves to individual adopter-reviewed paths.

## Remaining authoring work

- Exercise installation and licensing edge cases and preservation of existing
  repository information against the agreed guidance.
- Remaining skill exercises and complete adoption evidence.

The [compatibility audit](docs/development/adoption-compatibility.md) maps the
accepted requirements to the delivered product interface and retains the
historical v1 findings. Use installed CLI 1.2.1 as the initial validation
baseline; claim only compatibility demonstrated against the final source.

## Bootstrap and specification refresh

The user chose to bootstrap Repo Canon as a work in progress while product
support developed separately, with complete adoption required before treating
a release as adoption-ready. GitHub specification
[#1](https://github.com/lutzseverino/repo-canon/issues/1) and implementation
tickets #2–17 now carry the implementation contracts.

The 2026-09-14 refresh preserves the full accepted vision and reconciles those
existing contracts with the delivered and accepted product scope capability.
Amend the parent before reconciling affected children and native relationships;
retain their substantive source, operation, skill, and adoption requirements.
Implementation follows verified remaining blockers. Product acceptance does
not establish Repo Canon completion or publish an adoptable source.

The author selected the MIT License for Repo Canon's original material during
the 2026-09-14 specification-refresh interview. Preserve required upstream
notices; this choice does not replace third-party licenses or choose an
adopting repository's license. The author confirmed
`Copyright (c) 2026 Jasper Lutz Severino` for the notice. Ticket
[#14](https://github.com/lutzseverino/repo-canon/issues/14) applies the selected
license and verifies attribution. The root license covers original Repo Canon
material; third-party material retains its accompanying licenses and notices.

## Delivery boundary

Author a separate local standards source. Repository provisioning, publication,
and adoption are separate workflows. Do not change the Repository Standards
product contracts to implement these personal preferences.
