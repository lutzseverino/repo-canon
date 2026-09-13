# Repo Canon authoring notes

Status: policy decisions settled; drafted material is available for content review.
These notes record confirmed preferences;
they are not an adoptable standards source. No declarations have been authored
or validated yet. Declaration IDs and material mappings follow source review.

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
  information rather than inventing it. Concrete behavior and permissions were
  subsequently agreed below; implementation and exercises remain outstanding.
- Behavior changes and substantive work require an issue. Small corrections
  such as typos, broken links, and formatting may explain their purpose in the
  PR alone. Larger work can use a parent specification and implementation
  tickets; straightforward bugs do not require that hierarchy.
- A triaged request's approved agent-brief comment is its implementation
  contract. Directly authored specifications and tickets use their issue
  bodies. Agents read the full issue and blockers, clarify contradictions,
  and validate the applicable contract rather than only the intake body.
- Monorepo documentation policy remains independent of directory names.
  Record the format's inability to discover arbitrary project README targets
  as a product capability gap. Resolve it before claiming universal monorepo
  adoption support; do not silently narrow coverage to conventional folders.
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
  missing or ambiguous licensing requires maintainer clarification. The
  monorepo adoption capability gap must not be reported as passing coverage.
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
  Project-specific guidance remains separate. The known scope capability gap
  therefore includes reorganizing existing docs around protected exact files.
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

## Remaining authoring work

- Review the complete drafted shared configuration. No additional regular-skill
  exclusions are chosen. The accepted shared AGENTS.md is inspired by
  upstream's reusable Agent skills section; upstream does not supply the
  complete file.
- Review complete issue/PR template contents, including
  required fields and how optional fields avoid empty boilerplate.
- Concrete automation implementation and exercises of accepted behaviors,
  including executable/version prerequisites where operations require them.
- Translate accepted ownership and scope into declarations after the product
  scope dependency is resolved. The current format requires explicit disjoint
  targets; arbitrary discovery cannot silently expand adoption write scope.
- Exercise installation and licensing edge cases and preservation of existing
  repository information against the agreed guidance.
- Whole-source review, operation/skill exercises, and public CLI validation.

The compatibility audit is docs/development/adoption-compatibility.md. The
scope capability remains a product dependency, not an author-policy question.
The user requested a handoff for a fresh grilling session focused on the
missing support once the standards decisions were settled. That session should
design the product solution without reopening these author preferences.

## Bootstrap and specification handoff

The user subsequently chose to create and develop Repo Canon as a work in
progress now, with product support developed separately and complete adoption
verified before treating a release as adoption-ready. They requested a separate
handoff for the next stage. Their latest direction is to bootstrap the repository
now and focus the next agent on a to-spec run, synthesizing the recorded
decisions into the GitHub specification. Ticket breakdown and implementation
follow that specification.

The recorded design can authorize the initial repository bootstrap before a
GitHub issue tracker exists. Publish the parent specification and implementation
tickets after repository creation, then make GitHub the canonical work tracker.
Keep the product scope dependency in repo-standards, linked from the dependent
Repo Canon work. Creating the repository does not publish an adoptable source,
implement the planned automation, or settle the proposed product interface.

The author's license choice for Repo Canon itself has not been made. Do not
infer it from the product's or upstream skills' licenses. Preserve required
upstream notices and obtain the source-license choice before adding LICENSE
or declaring licensing complete. This does not prevent creating a work-in-
progress repository and its issue tracker.

## Delivery boundary

Author a separate local standards source. Repository provisioning, publication,
and adoption are separate workflows. Do not change the Repository Standards
product contracts to implement these personal preferences.
