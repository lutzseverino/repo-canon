# Standards source profile

`standards.yaml` defines one complete `repo-standards/v2` profile named
`complete`. The source identity is `repo-canon`, and its compatibility contract
is the open-ended minimum `requires.repo-standards: ">=5.0.1"`. Public CLI 5.0.1
is the oldest version this source was validated against; the range gates which
CLI versions may select it and is never re-validated afterwards. The profile
does not imply a release or successful adoption.

## Policy and ownership map

| Policy or material                                    | Declaration IDs                                                                                                                                             | Source material and operations                                                                                                                                                                                | Ownership                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shared contribution and agent workflow                | `agent-guidance`, `contribution-guidance`, `agent-configuration-index`, `domain-configuration`, `issue-tracker-configuration`, `triage-label-configuration` | Root guidance, the `docs/agents` index, and the vendored upstream setup seeds for GitHub, installed as the skill setup files                                                                                  | Exact files                                                                                                         |
| Issue and pull request intake                         | `bug-report-template`, `feature-request-template`, `implementation-ticket-template`, `specification-template`, `pull-request-template`                      | `.github` templates                                                                                                                                                                                           | Exact files                                                                                                         |
| Trusted issue contract validation                     | `issue-contract-workflow`, `issue-contract-validator`                                                                                                       | Default-branch workflow and validator                                                                                                                                                                         | Exact files                                                                                                         |
| Trusted pull request metadata validation              | `pr-metadata-workflow`, `pr-metadata-validator`                                                                                                             | Base-revision workflow and validator                                                                                                                                                                          | Exact files                                                                                                         |
| Shared rendered Markdown interpretation               | `rendered-markdown-runtime`                                                                                                                                 | Pure interpreted-document runtime used by both trusted validators and all three documentation checks                                                                                                          | Exact file; also retained operation resource                                                                        |
| Rendered Markdown dependencies                        | `marked-*`, `parse5-*`                                                                                                                                      | Marked 18.0.13 and parse5 8.0.1 bundles, provenance, and license notices                                                                                                                                      | Exact files; also retained operation resources                                                                      |
| Repository README                                     | `repository-readme`                                                                                                                                         | `guidance/repository-readme.md`; `repository-readme-structure` check                                                                                                                                          | Project-owned contextual `README.md`                                                                                |
| Maintained Project READMEs                            | `project-readmes`                                                                                                                                           | Separate assessment and discovery guidance; `project-readme-structure` check                                                                                                                                  | Project-owned paths confirmed through v2 discovery                                                                  |
| Documentation, glossaries, and project agent guidance | `documentation`                                                                                                                                             | Separate assessment and discovery guidance; `documentation-navigation` check                                                                                                                                  | Project-owned individual source, destination, index, glossary, and link-repair paths confirmed through v2 discovery |
| GitHub labels, required check, and squash settings    | `github-repository-configuration`                                                                                                                           | Separate guidance and intentionally empty project-content discovery; repeat-safe `canonical-labels` and `pull-request-integration` fixes                                                                      | Remote settings; no project-content paths                                                                           |
| Pinned regular skills                                 | `skill-*` except `skill-deliver` (25 declarations)                                                                                                          | Full directories under `vendor/mattpocock-skills`, pinned at `3cca18b368ae95cdbdebbff572ccafa662551015`; upstream notice retained by the configuration operation and installed by `mattpocock-skills-license` | Exact whole skill directories                                                                                       |
| Delivery through the contribution workflow            | `skill-deliver`                                                                                                                                             | Repo Canon's own `.agents/skills/deliver`, whose source is its installed path; it reads the installed contribution guidance, pull request template, and skill setup files and the project's development guide | Exact whole skill directory                                                                                         |
| Upstream skill license notice                         | `mattpocock-skills-license`                                                                                                                                 | `vendor/mattpocock-skills/LICENSE`, installed at `.agents/skills/LICENSE.mattpocock-skills` beside the copied skills                                                                                          | Exact file outside every skill directory                                                                            |

The resolved profile contains 54 declarations: 24 exact files, one contextual
file, three repository declarations, and 26 exact skill directories. It has
three checks and two fixes. Exact targets are individual and disjoint from all
contextual scope. Discovery proposes individual files rather than directory
trees, globs, or adopter-specific paths embedded in this source.

Each skill declaration owns its whole `.agents/skills/<name>` directory by its
complete inventory, so the upstream license notice cannot be installed inside a
skill directory. The exact `mattpocock-skills-license` declaration installs the
vendored upstream `LICENSE` byte for byte as the sibling file
`.agents/skills/LICENSE.mattpocock-skills`, whose name identifies the upstream
project. Skill names are lower-case kebab-case, so that name never collides
with a skill directory.

The documentation operation resources retain the shared rendered-Markdown
module, the separate local-link module, the documentation model, the
documentation scope drafter, and complete Marked and parse5 directories with
their notices. The agent runs the drafter during discovery; the CLI only
retains it. Other operation resources retain the shared GitHub operation
module, Repo Canon's MIT license and third-party notice, and the upstream skill
license. The rendered-Markdown runtime and parser files are also exact
declarations because both trusted workflow validators import them from the
adopting repository. Each executable therefore resolves the same relative
import layout after installation or resource retention.

## Executable prerequisites

All authored operations execute with Node.js 24. Their manifest prerequisite is
`node --version` constrained to `>=24.0.0 <25.0.0`, with a 30-second timeout.
The GitHub configuration operations additionally verify Git 2.18.0 or newer,
GitHub CLI 2.57.0 or newer, one unambiguous github.com remote, authenticated
access, and the required repository permissions before mutation. Marked and
parse5 are retained resources, so adopters do not install parser packages.

Source maintainers need Node.js 24, npm, Git, and a pinned public Repository
Standards CLI that satisfies the requirement. Install the CLI outside this
repository and validate every profile without filtering:

```sh
cli_prefix="$(mktemp -d)"
npm install --prefix "$cli_prefix" --ignore-scripts \
  --registry=https://registry.npmjs.org \
  @lutzseverino/repo-standards@5.0.1
"$cli_prefix/node_modules/.bin/repo-standards" --version
"$cli_prefix/node_modules/.bin/repo-standards" source validate "$PWD" --json
```

Follow the [development guide](README.md#setup-and-validation) for focused local
checks and PR validation. CI installs the same public CLI outside the checkout
and validates every profile.

## Validation boundary

Installed public CLI 5.0.1 under Node.js 24 returns `valid: true`, no errors,
one `complete` profile, and 54 declarations for the source, matching the
inventory above. Local validation and CI install
`@lutzseverino/repo-standards@5.0.1`, the oldest version the requirement admits;
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
