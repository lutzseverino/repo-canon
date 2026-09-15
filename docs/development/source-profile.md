# Standards source profile

`standards.yaml` defines one complete `repo-standards/v2` profile named
`complete`. The source identity is `repo-canon`, and its compatibility contract
is the exact public CLI version `requires.repo-standards: "1.2.2"`. The profile
does not imply a release or successful adoption.

## Policy and ownership map

| Policy or material | Declaration IDs | Source material and operations | Ownership |
| --- | --- | --- | --- |
| Shared contribution and agent workflow | `agent-guidance`, `contribution-guidance`, `agent-configuration-index`, `domain-configuration`, `issue-tracker-configuration`, `triage-label-configuration` | Root guidance and `docs/agents` shared configuration | Exact files |
| Issue and pull request intake | `bug-report-template`, `feature-request-template`, `implementation-ticket-template`, `specification-template`, `pull-request-template` | `.github` templates | Exact files |
| Trusted issue contract validation | `issue-contract-workflow`, `issue-contract-validator` | Default-branch workflow and validator | Exact files |
| Trusted pull request metadata validation | `pr-metadata-workflow`, `pr-metadata-validator` | Base-revision workflow and validator | Exact files |
| Rendered Markdown dependencies | `marked-*`, `parse5-*` | Marked 18.0.13 and parse5 8.0.1 bundles, provenance, and license notices | Exact files; also retained operation resources |
| Repository README | `repository-readme` | `guidance/repository-readme.md`; `repository-readme-structure` check | Project-owned contextual `README.md` |
| Maintained Project READMEs | `project-readmes` | Separate assessment and discovery guidance; `project-readme-structure` check | Project-owned paths confirmed through v2 discovery |
| Documentation, glossaries, and project agent guidance | `documentation` | Separate assessment and discovery guidance; `documentation-navigation` check | Project-owned individual source, destination, index, glossary, and link-repair paths confirmed through v2 discovery |
| GitHub labels, required check, and squash settings | `github-repository-configuration` | Separate guidance and intentionally empty project-content discovery; repeat-safe `canonical-labels` and `pull-request-integration` fixes | Remote settings; no project-content paths |
| Pinned regular skills | `skill-*` (25 declarations) | Full directories under `vendor/mattpocock-skills`, pinned at `3cca18b368ae95cdbdebbff572ccafa662551015`; upstream notice retained by the configuration operation | Exact whole skill directories |

The resolved profile contains 51 declarations: 22 exact files, one contextual
file, three repository declarations, and 25 exact skill directories. It has
three checks and two fixes. Exact targets are individual and disjoint from all
contextual scope. Discovery proposes individual files rather than directory
trees, globs, or adopter-specific paths embedded in this source.

The operation resources retain the shared rendered-Markdown module, complete
Marked and parse5 directories with their notices, the shared GitHub operation
module, Repo Canon's MIT license and third-party notice, and the upstream skill
license. Workflow-installed parser files are also exact declarations because
the trusted issue and pull request validators import them from the adopting
repository.

## Executable prerequisites

All authored operations execute with Node.js 24. Their manifest prerequisite is
`node --version` constrained to `>=24.0.0 <25.0.0`, with a 30-second timeout.
The GitHub configuration operations additionally verify Git 2.18.0 or newer,
GitHub CLI 2.57.0 or newer, one unambiguous github.com remote, authenticated
access, and the required repository permissions before mutation. Marked and
parse5 are retained resources, so adopters do not install parser packages.

Source maintainers need Node.js 24, npm, Git, and the exact public Repository
Standards CLI. Install the CLI outside this repository and validate every
profile without filtering:

```sh
cli_prefix="$(mktemp -d)"
npm install --prefix "$cli_prefix" --ignore-scripts \
  --registry=https://registry.npmjs.org \
  @lutzseverino/repo-standards@1.2.2
"$cli_prefix/node_modules/.bin/repo-standards" --version
"$cli_prefix/node_modules/.bin/repo-standards" source validate "$PWD" --json
```

Follow the [development guide](README.md#current-validation) for focused local
checks and PR validation. CI installs the same public CLI outside the checkout
and validates every profile.

## Validation boundary

On 2026-09-14, public CLI 1.2.1 under Node.js 24 validated the complete local
source with `valid: true`, no errors, and the single `complete` profile. The
reported source identity was `repo-canon` using `repo-standards/v2` and exact
compatibility `1.2.1`. The resolved counts matched the inventory above, and the
CLI reported discovery required for `documentation`,
`github-repository-configuration`, and `project-readmes`.

That result is retained historical evidence for the earlier source bytes. The
final manifest, install command, and CI validation pin CLI 1.2.2. Public CLI
1.2.2 under Node.js 24.21.0 returned `valid: true` with no errors for the exact
reviewed snapshot `c0d57fadaee738b65d0ff12ecd9f8ec5df86c7ef`. The immutable
temporary `v0.0.2` source tag and every adoption selection resolved to that same
commit. [The adoption record](adoption-evidence.md) preserves the installed npm
integrity, source identity, public and local execution boundaries, and outcomes.

Source validation checks schema, all profiles, references, operation metadata,
reserved identities, and determinable target conflicts. It executes no
operation or prerequisite and cannot establish semantic coverage or safe scope
in an adopting repository. The existing operation fixtures and skill inventory
review remain separate evidence. The confirmed v2 inspections, operation
execution, contextual assessments, authorized remote readback, and complete
adoptions are separately recorded. Repo Canon source publication and release
remain separate work.
