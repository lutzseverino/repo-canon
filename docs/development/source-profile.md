# Standards source profile

`standards.yaml` defines three `repo-standards/v2` profiles, as
[ADR 0017](../adr/0017-make-the-factory-an-optional-profile.md) and
[ADR 0027](../adr/0027-give-the-workbench-its-own-profile.md) decide. The
`standard` profile selects every default declaration unchanged, for every
adopting repository. The `factory` profile adds the factory's repository files
and repository-wide workflow rules to it, for a repository a factory serves.
The `workbench` profile excludes every default declaration except the workflow
skills, the files their executables import and the license notices, for the
orchestrating agent's workbench.
The source identity is `repo-canon`,
and its compatibility contract is the open-ended minimum
`requires.repo-standards: ">=10.0.0"`. Public CLI 10.0.0 is the oldest version
this source was validated against. It is the first that accepts an optional
discovery declaration with no scope, which all three TypeScript stacks need to
stay out of repositories without a matching Project. Its check request
`invocation` field, which earlier CLIs also supply, lets
`documentation-navigation` prove scope coverage only during adoption runs,
while standalone checks continue checking content. The range gates which CLI versions may
select it and is never re-validated afterwards. No profile implies a
release or successful adoption.

## Policy and ownership map

| Policy or material                                                                                               | Declaration IDs                                                                                                                                             | Source material and operations                                                                                                                                                                                                                                                                                                                            | Ownership                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Shared contribution and agent workflow                                                                           | `agent-guidance`, `contribution-guidance`, `agent-configuration-index`, `domain-configuration`, `issue-tracker-configuration`, `triage-label-configuration` | Root guidance, the `docs/agents` index, and the owned skill setup files under `docs/agents`, each installed from itself, with their upstream bases, the vendored setup seeds for GitHub, recorded in `setup-file-bases.json`                                                                                                                              | Exact files                                                                                                              |
| Issue and pull request intake                                                                                    | `bug-report-template`, `feature-request-template`, `implementation-ticket-template`, `specification-template`, `pull-request-template`                      | `.github` templates                                                                                                                                                                                                                                                                                                                                       | Exact files                                                                                                              |
| Trusted issue contract validation                                                                                | `issue-contract-workflow`, `issue-contract-validator`                                                                                                       | Default-branch workflow and validator                                                                                                                                                                                                                                                                                                                     | Exact files                                                                                                              |
| Trusted pull request metadata validation                                                                         | `pr-metadata-workflow`, `pr-metadata-validator`                                                                                                             | Base-revision workflow and validator                                                                                                                                                                                                                                                                                                                      | Exact files                                                                                                              |
| Automated standards updates                                                                                      | `standards-update-workflow`                                                                                                                                 | `.github/workflows/standards-update.yml`; opt-in daily and manual Repository Standards update caller                                                                                                                                                                                                                                                      | Exact file in the standard and factory profiles; disabled until the repository opts in                                   |
| Shared rendered Markdown interpretation                                                                          | `rendered-markdown-runtime`                                                                                                                                 | Pure interpreted-document runtime used by both trusted validators and all three documentation checks                                                                                                                                                                                                                                                      | Exact file; also retained operation resource                                                                             |
| Rendered Markdown dependencies                                                                                   | `marked-*`, `parse5-*`                                                                                                                                      | Marked 18.0.13 and parse5 8.0.1 bundles, provenance, and license notices                                                                                                                                                                                                                                                                                  | Exact files; also retained operation resources                                                                           |
| Installed code language statistics                                                                               | `git-attributes`                                                                                                                                            | `rules/git-attributes.md` and `guidance/git-attributes.md`; contextual assessment only, with no fixes or checks                                                                                                                                                                                                                                           | Project-owned contextual `.gitattributes`; preserves repository-owned lines                                              |
| Shared platform validation and access                                                                            | `validator-command`, `github-validator-trigger`, `postern-bundle`, `postern-license`, `postern-provenance`                                                  | Common neutral validator command and trusted GitHub trigger; exact published Postern 1.2.0 bundle, MIT license and provenance, used by issue validation, babysit and the orchestrate wait                                                                                                                                                                 | Five exact files; all consumers resolve the same installed relative layout without npm                                   |
| Repository license                                                                                               | `repository-license`                                                                                                                                        | `rules/repository-license.md` and `guidance/repository-license.md`; contextual assessment only, with no fixes or checks                                                                                                                                                                                                                                   | Project-owned contextual `LICENSE`                                                                                       |
| Repository README                                                                                                | `repository-readme`                                                                                                                                         | `rules/repository-readme.md` and `guidance/repository-readme.md`; `repository-readme-structure` check                                                                                                                                                                                                                                                     | Project-owned contextual `README.md`                                                                                     |
| Maintained Project READMEs                                                                                       | `project-readmes`                                                                                                                                           | `rules/project-readmes.md`, separate adoption and discovery guidance; `project-readme-structure` check                                                                                                                                                                                                                                                    | Project-owned paths confirmed through v2 discovery                                                                       |
| Project-specific agent guidance                                                                                  | `project-agent-guidance`                                                                                                                                    | `rules/project-agent-guidance.md` and `guidance/project-agent-guidance.md`; contextual assessment preserves replaced `AGENTS.md` instructions from `HEAD`, with no fixes or checks                                                                                                                                                                        | Project-owned contextual `docs/agents/project.md`                                                                        |
| Documentation and glossaries                                                                                     | `documentation`                                                                                                                                             | `rules/documentation.md`, separate adoption and discovery guidance; the documentation scope drafter as its discovery script; `documentation-navigation` check                                                                                                                                                                                             | Project-owned individual source, destination, index, glossary, and link-repair paths confirmed through v2 discovery      |
| GitHub labels, required check, squash settings, issue and pull request process, and optional reviewer validation | `github-repository-configuration`                                                                                                                           | Repository-wide `rules/github-repository-configuration.md`, separate adoption guidance, and intentionally empty project-content discovery; repeat-safe `canonical-labels` and `pull-request-integration` remote setup fixes with read-only readiness probes, and the read-only `pull-request-reviewer` check                                              | Remote settings and validation of repository-owned optional reviewer data; no project-content paths                      |
| Optional app-author review policy validation                                                                     | `github-repository-configuration`                                                                                                                           | The read-only `factory-review-policy` check, retaining `operations/lib/review-policy.mjs` byte-identical to babysit's policy reader                                                                                                                                                                                                                       | Validation of repository-owned optional policy data; no project-content paths                                            |
| Owned workflow skills taken unchanged from upstream                                                              | `skill-*` except `skill-babysit`, `skill-orchestrate` and `skill-triage` (16 declarations)                                                                  | The owned tree, `.agents/skills/<name>`, whose source is its installed path; each skill is identical to its upstream base under `vendor/mattpocock-skills`, tag `v1.3.1` (`24fe0ef7737efae15c87225755e9f6f5965e4888`), which its `CREDITS.md` names; upstream notice retained by the configuration operation and installed by `mattpocock-skills-license` | Exact whole skill directories                                                                                            |
| Triage routing and brief acceptance                                                                              | `skill-triage`                                                                                                                                              | Repo Canon's own `.agents/skills/triage`, whose source is its installed path; its `CREDITS.md` names its upstream base, the vendored `v1.3.1` skill, and how it differs, and it follows the installed contribution guidance and rules                                                                                                                     | Exact whole skill directory                                                                                              |
| Delivery through review to merge                                                                                 | `skill-babysit`                                                                                                                                             | Repo Canon's own `.agents/skills/babysit`, whose source is its installed path; its `CREDITS.md` says it was written for Repo Canon, and it follows the installed contribution guidance                                                                                                                                                                    | Exact whole skill directory                                                                                              |
| Plans across tickets, kept in a workbench                                                                        | `skill-orchestrate`                                                                                                                                         | Repo Canon's own user-invoked `.agents/skills/orchestrate`, whose source is its installed path; its `CREDITS.md` says it was written for Repo Canon and credits `chief-of-staff`, and it follows the installed contribution guidance                                                                                                                      | Exact whole skill directory                                                                                              |
| `typescript-node` stack for the Projects that use it                                                             | `typescript-node-stack`                                                                                                                                     | `rules/typescript-node-stack.md`, separate adoption and discovery guidance; the typescript-node stack scope drafter as its discovery script; `typescript-node-stack-manifests` check                                                                                                                                                                      | Optional: one project-owned `package.json` per confirmed Project, or no scope, which installs no rules and runs no check |
| Factory workflow, in the `factory` profile only                                                                  | `factory-workflow`                                                                                                                                          | `rules/factory-workflow.md`, separate adoption guidance, and discovery confirming no content paths or directories                                                                                                                                                                                                                                         | Whole repository, with intentionally empty confirmed scope                                                               |
| Factory configuration, in the `factory` profile only                                                             | `factory-configuration`                                                                                                                                     | Repo Canon's own `.factory/config.json`, whose source is its installed path: factory configuration version 1 with Repo Canon's labels, `model:` label prefix, and `implement` prompt                                                                                                                                                                      | Exact file                                                                                                               |
| Factory toolchain image, in the `factory` profile only                                                           | `factory-sandbox-image`                                                                                                                                     | `rules/factory-sandbox-image.md` and `guidance/factory-sandbox-image.md`; contextual assessment only, with no fixes or checks                                                                                                                                                                                                                             | Project-owned contextual `.factory/Dockerfile`                                                                           |
| Toolchain image build, in the `factory` profile only                                                             | `factory-sandbox-image-workflow`                                                                                                                            | `.github/workflows/sandbox-image.yml`; builds `.factory/Dockerfile` on pull requests changing it or the workflow                                                                                                                                                                                                                                          | Exact file                                                                                                               |
| Upstream skill license notice                                                                                    | `mattpocock-skills-license`                                                                                                                                 | `vendor/mattpocock-skills/LICENSE`, installed at `.agents/skills/LICENSE.mattpocock-skills` beside the copied skills                                                                                                                                                                                                                                      | Exact file outside every skill directory                                                                                 |
| HumanLayer license notice                                                                                        | `humanlayer-skills-license`                                                                                                                                 | `vendor/humanlayer-skills/LICENSE`, installed at `.agents/skills/LICENSE.humanlayer-skills` for material reproduced in the `pr` Summary                                                                                                                                                                                                                   | Exact file outside every skill directory; also retained operation resource                                               |

The optional `typescript-astro-stack` and `typescript-vite-stack` repository
declarations own confirmed manifests, with guidance and discovery per stack,
shared web rules, one check each and retained discovery/check resources. Their
installed runtime closure includes `stack-files.mjs`, `stack-scope.mjs`,
`stack-check.mjs`, `typescript-node-stack.mjs`, `typescript-web-stack.mjs` and
`local-markdown-links.mjs` under `operations/lib/`. The Node discovery entry also selects
that shared scope implementation, so release review covers these helpers along
with all four discovery entry points and both web check entry points.

The resolved `standard` profile contains 60 declarations: 31 exact files, four
contextual files, six repository declarations, and 19 exact skill
directories. The `factory` profile adds one exact file, one contextual file,
the exact workflow, and one repository declaration, for 64 declarations. Each has eight checks, two fixes,
and four discovery scripts.

The `workbench` profile excludes the other 27 default declarations with
`exclude: true` and adds none, for 33 declarations: the 19 exact skill
directories and 14 exact files, with no rules, guidance, checks, fixes or
discovery. The files are the two skill license notices, the three Postern
files that `babysit`, the `orchestrate` wait and the issue-contract validator
import, and that validator, which the `triage` readiness command imports, with
the rendered-Markdown runtime and the Marked and parse5 files it imports. The
excluded declarations include all three default workflows,
`issue-contract-workflow`, `pr-metadata-workflow` and
`standards-update-workflow`, so the profile installs nothing under `.github/`.
A new default declaration joins the workbench profile unless the profile
excludes it, so `test/workbench-profile.test.mjs` fails until it is excluded
or admitted to the list there. Exact targets are individual and disjoint from all
contextual scope. Discovery proposes individual files rather than directory
trees, globs, or adopter-specific paths embedded in this source.

Every skill declaration installs from the owned tree, `.agents/skills/` in
this repository, as
[ADR 0028](../adr/0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md)
decides: each skill's source is its own installed path, so this repository
runs the skills it publishes and their relative imports resolve the same way
in source and after installation. The vendored snapshot is the upstream base
for reconciliation, never a source; the
[upstream compatibility record](upstream-compatibility.md#owned-skills-and-their-upstream-bases)
describes the base records and their check. Each skill declaration owns its
whole `.agents/skills/<name>` directory by its complete inventory, so the upstream license notice cannot be installed inside a
skill directory. The exact `mattpocock-skills-license` declaration installs the
vendored upstream `LICENSE` byte for byte as the sibling file
`.agents/skills/LICENSE.mattpocock-skills`, whose name identifies the upstream
project. Skill names are lower-case kebab-case, so that name never collides
with a skill directory.

The `humanlayer-skills-license` exact file declaration likewise installs
`vendor/humanlayer-skills/LICENSE` at
`.agents/skills/LICENSE.humanlayer-skills`. It covers the material reproduced
from HumanLayer's `show-me` in the `pr` skill's Summary section. The vendored
`UPSTREAM.json` records the upstream repository, root `LICENSE` path, and
pinned commit; no HumanLayer skill is vendored or installed.

The documentation operation resources retain the shared rendered-Markdown
module, the separate local-link module, the documentation model, the
entry-document sentence and glossary module, and complete Marked and parse5
directories with their notices. The documentation declaration's discovery
script, the documentation scope drafter, retains the same modules and
`standards.yaml`; inspection runs it read-only to draft the documentation
scope. The `typescript-node-stack` check and its discovery script, the
typescript-node stack scope drafter, both retain the shared stack module,
`operations/lib/typescript-node-stack.mjs`, and the local-link module it reads
paths through, so the draft and the check read a Project's manifests the same
way. The web stacks additionally retain `stack-files.mjs`,
`typescript-web-stack.mjs` and the shared `stack-check.mjs` or `stack-scope.mjs`
entry implementation. Node discovery retains the same scope and web helpers
to preserve web exclusions. Both optional web declarations reference
`rules/typescript-web-stacks.md`; confirmed no scope installs no rules or
checks. The [web check](typescript-web-stack-check.md) and
[web discovery](typescript-web-stack-scope-drafter.md) pages define their
execution and checked/assessed boundary. Other operation resources retain the shared GitHub operation
module, Repo Canon's MIT license and third-party notice, and every license
linked by that notice. The rendered-Markdown runtime, parser files and Postern resources are also
exact declarations because the validators and babysit import them from the
adopting repository. Each executable therefore resolves the same relative
import layout after installation or resource retention.

## Executable prerequisites

All authored operations execute with stable Node.js 24 or 26. Their manifest prerequisite is
`node --version` constrained to `>=24.0.0 <25.0.0 || >=26.0.0 <27.0.0`, with a 30-second timeout.
Node.js 22, odd majors, prereleases, and untested future majors are excluded.
The GitHub configuration operations additionally verify Git 2.18.0 or newer,
GitHub CLI 2.57.0 or newer, one unambiguous github.com remote, authenticated
access, and the required repository permissions before mutation. Both GitHub
fixes declare `remote-setup`, and their readiness probes run the same
verification read-only, with the same Node.js prerequisite and timeout, before
inspection writes anything. Marked and
parse5 are retained resources, so adopters do not install parser packages.

Source maintainers need Node.js 24 or 26, npm, Git, and a pinned public Repository
Standards CLI that satisfies the requirement. Install the CLI outside this
repository and validate every profile without filtering:

```sh
cli_prefix="$(mktemp -d)"
npm install --prefix "$cli_prefix" --ignore-scripts \
  --registry=https://registry.npmjs.org \
  @lutzseverino/repo-standards@10.0.0
"$cli_prefix/node_modules/.bin/repo-standards" --version
"$cli_prefix/node_modules/.bin/repo-standards" source validate "$PWD" --json
```

Follow the [development guide](README.md#setup-and-validation) for focused local
checks and PR validation. CI installs the same public CLI outside the checkout
and validates every profile.

## Validation boundary

Public CLI 10.0.0 on stable Node.js 24 or 26 returns `valid: true`, no errors,
and the `standard`, `factory` and `workbench` profiles with 60, 64 and 33
declarations for the source, matching the inventory above. Local validation and CI install
`@lutzseverino/repo-standards@10.0.0`, the oldest version the requirement admits;
[ADR 0005](../adr/0005-require-an-open-ended-minimum-cli-version.md) records why
the requirement is a minimum. The release pull request records local validation outcomes and separate CI
evidence for both runtimes in its Evidence section.

Source validation checks schema, all profiles, references, operation metadata,
reserved identities, and determinable target conflicts. It executes no
operation or prerequisite and cannot establish semantic coverage or safe scope
in an adopting repository. Operation fixtures, the skill inventory review, and
the confirmed inspections, operation results, and contextual assessments of an
adoption establish those separately. Source publication follows the
[release procedure](release.md), and each
[published release](https://github.com/lutzseverino/repo-canon/releases) carries
its notes.
