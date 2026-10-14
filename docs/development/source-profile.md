# Standards source profile

`standards.yaml` defines two `repo-standards/v2` profiles, as
[ADR 0017](../adr/0017-make-the-factory-an-optional-profile.md) decides. The
`standard` profile selects every default declaration unchanged, for every
adopting repository. The `factory` profile adds the factory's repository files
to it, for a repository a factory serves. The source identity is `repo-canon`,
and its compatibility contract is the open-ended minimum
`requires.repo-standards: ">=7.0.0"`. Public CLI 7.0.0 is the oldest version
this source was validated against; the range gates which CLI versions may
select it and is never re-validated afterwards. Neither profile implies a
release or successful adoption.

## Policy and ownership map

| Policy or material                                                               | Declaration IDs                                                                                                                                             | Source material and operations                                                                                                                                                                                                                      | Ownership                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shared contribution and agent workflow                                           | `agent-guidance`, `contribution-guidance`, `agent-configuration-index`, `domain-configuration`, `issue-tracker-configuration`, `triage-label-configuration` | Root guidance, the `docs/agents` index, and the vendored upstream setup seeds for GitHub, installed as the skill setup files                                                                                                                        | Exact files                                                                                                         |
| Issue and pull request intake                                                    | `bug-report-template`, `feature-request-template`, `implementation-ticket-template`, `specification-template`, `pull-request-template`                      | `.github` templates                                                                                                                                                                                                                                 | Exact files                                                                                                         |
| Trusted issue contract validation                                                | `issue-contract-workflow`, `issue-contract-validator`                                                                                                       | Default-branch workflow and validator                                                                                                                                                                                                               | Exact files                                                                                                         |
| Trusted pull request metadata validation                                         | `pr-metadata-workflow`, `pr-metadata-validator`                                                                                                             | Base-revision workflow and validator                                                                                                                                                                                                                | Exact files                                                                                                         |
| Shared rendered Markdown interpretation                                          | `rendered-markdown-runtime`                                                                                                                                 | Pure interpreted-document runtime used by both trusted validators and all three documentation checks                                                                                                                                                | Exact file; also retained operation resource                                                                        |
| Rendered Markdown dependencies                                                   | `marked-*`, `parse5-*`                                                                                                                                      | Marked 18.0.13 and parse5 8.0.1 bundles, provenance, and license notices                                                                                                                                                                            | Exact files; also retained operation resources                                                                      |
| Repository license                                                               | `repository-license`                                                                                                                                        | `rules/repository-license.md` and `guidance/repository-license.md`; contextual assessment only, with no fixes or checks                                                                                                                             | Project-owned contextual `LICENSE`                                                                                  |
| Repository README                                                                | `repository-readme`                                                                                                                                         | `rules/repository-readme.md` and `guidance/repository-readme.md`; `repository-readme-structure` check                                                                                                                                               | Project-owned contextual `README.md`                                                                                |
| Maintained Project READMEs                                                       | `project-readmes`                                                                                                                                           | `rules/project-readmes.md`, separate adoption and discovery guidance; `project-readme-structure` check                                                                                                                                              | Project-owned paths confirmed through v2 discovery                                                                  |
| Documentation, glossaries, and project agent guidance                            | `documentation`                                                                                                                                             | Separate assessment and discovery guidance; the documentation scope drafter as its discovery script; `documentation-navigation` check                                                                                                               | Project-owned individual source, destination, index, glossary, and link-repair paths confirmed through v2 discovery |
| GitHub labels, required check, squash settings, and optional reviewer validation | `github-repository-configuration`                                                                                                                           | Separate guidance and intentionally empty project-content discovery; repeat-safe `canonical-labels` and `pull-request-integration` remote setup fixes with read-only readiness probes, and the read-only `pull-request-reviewer` check              | Remote settings and validation of repository-owned optional reviewer data; no project-content paths                 |
| Pinned workflow skills                                                           | `skill-*` except `skill-babysit` (17 declarations)                                                                                                          | Full directories of the workflow skills under `vendor/mattpocock-skills`, pinned at tag `v1.3.1` (`24fe0ef7737efae15c87225755e9f6f5965e4888`); upstream notice retained by the configuration operation and installed by `mattpocock-skills-license` | Exact whole skill directories                                                                                       |
| Delivery through review to merge                                                 | `skill-babysit`                                                                                                                                             | Repo Canon's own `.agents/skills/babysit`, whose source is its installed path; it follows the installed contribution guidance                                                                                                                       | Exact whole skill directory                                                                                         |
| Factory configuration, in the `factory` profile only                             | `factory-configuration`                                                                                                                                     | Repo Canon's own `.factory/config.json`, whose source is its installed path: factory configuration version 1 with Repo Canon's labels, `model:` label prefix, and `implement` prompt                                                                | Exact file                                                                                                          |
| Factory toolchain image, in the `factory` profile only                           | `factory-sandbox-image`                                                                                                                                     | `guidance/factory-sandbox-image.md`; contextual assessment only, with no fixes or checks                                                                                                                                                            | Project-owned contextual `.factory/Dockerfile`                                                                      |
| Toolchain image build, in the `factory` profile only                             | `factory-sandbox-image-workflow`                                                                                                                            | `.github/workflows/sandbox-image.yml`; builds `.factory/Dockerfile` on pull requests changing it or the workflow                                                                                                                                    | Exact file                                                                                                          |
| Upstream skill license notice                                                    | `mattpocock-skills-license`                                                                                                                                 | `vendor/mattpocock-skills/LICENSE`, installed at `.agents/skills/LICENSE.mattpocock-skills` beside the copied skills                                                                                                                                | Exact file outside every skill directory                                                                            |
| HumanLayer license notice                                                        | `humanlayer-skills-license`                                                                                                                                 | `vendor/humanlayer-skills/LICENSE`, installed at `.agents/skills/LICENSE.humanlayer-skills` for material reproduced in the `pr` Summary                                                                                                             | Exact file outside every skill directory; also retained operation resource                                          |

The resolved `standard` profile contains 48 declarations: 25 exact files, two
contextual files, three repository declarations, and 18 exact skill
directories. The `factory` profile adds one exact file, one contextual file,
and the exact workflow, for 51 declarations. Each has four checks, two fixes,
and one discovery script. Exact targets are individual and disjoint from all
contextual scope. Discovery proposes individual files rather than directory
trees, globs, or adopter-specific paths embedded in this source.

Each skill declaration owns its whole `.agents/skills/<name>` directory by its
complete inventory, so the upstream license notice cannot be installed inside a
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
scope. Other operation resources retain the shared GitHub operation
module, Repo Canon's MIT license and third-party notice, and every license
linked by that notice. The rendered-Markdown runtime and parser files are also exact
declarations because both trusted workflow validators import them from the
adopting repository. Each executable therefore resolves the same relative
import layout after installation or resource retention.

## Executable prerequisites

All authored operations execute with Node.js 24. Their manifest prerequisite is
`node --version` constrained to `>=24.0.0 <25.0.0`, with a 30-second timeout.
The GitHub configuration operations additionally verify Git 2.18.0 or newer,
GitHub CLI 2.57.0 or newer, one unambiguous github.com remote, authenticated
access, and the required repository permissions before mutation. Both GitHub
fixes declare `remote-setup`, and their readiness probes run the same
verification read-only, with the same Node.js prerequisite and timeout, before
inspection writes anything. Marked and
parse5 are retained resources, so adopters do not install parser packages.

Source maintainers need Node.js 24, npm, Git, and a pinned public Repository
Standards CLI that satisfies the requirement. Install the CLI outside this
repository and validate every profile without filtering:

```sh
cli_prefix="$(mktemp -d)"
npm install --prefix "$cli_prefix" --ignore-scripts \
  --registry=https://registry.npmjs.org \
  @lutzseverino/repo-standards@7.0.0
"$cli_prefix/node_modules/.bin/repo-standards" --version
"$cli_prefix/node_modules/.bin/repo-standards" source validate "$PWD" --json
```

Follow the [development guide](README.md#setup-and-validation) for focused local
checks and PR validation. CI installs the same public CLI outside the checkout
and validates every profile.

## Validation boundary

Installed public CLI 7.0.0 under Node.js 24 returns `valid: true`, no errors,
and the `standard` and `factory` profiles with 48 and 51 declarations for the
source, matching the inventory above. Local validation and CI install
`@lutzseverino/repo-standards@7.0.0`, the oldest version the requirement admits;
[ADR 0005](../adr/0005-require-an-open-ended-minimum-cli-version.md) records why
the requirement is a minimum.

Source validation checks schema, all profiles, references, operation metadata,
reserved identities, and determinable target conflicts. It executes no
operation or prerequisite and cannot establish semantic coverage or safe scope
in an adopting repository. Operation fixtures, the skill inventory review, and
the confirmed inspections, operation results, and contextual assessments of an
adoption establish those separately. Source publication follows the
[release procedure](release.md), and each
[published release](https://github.com/lutzseverino/repo-canon/releases) carries
its notes.
