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
| Shared rendered Markdown interpretation | `rendered-markdown-runtime` | Pure interpreted-document runtime used by both trusted validators and all three documentation checks | Exact file; also retained operation resource |
| Rendered Markdown dependencies | `marked-*`, `parse5-*` | Marked 18.0.13 and parse5 8.0.1 bundles, provenance, and license notices | Exact files; also retained operation resources |
| Repository README | `repository-readme` | `guidance/repository-readme.md`; `repository-readme-structure` check | Project-owned contextual `README.md` |
| Maintained Project READMEs | `project-readmes` | Separate assessment and discovery guidance; `project-readme-structure` check | Project-owned paths confirmed through v2 discovery |
| Documentation, glossaries, and project agent guidance | `documentation` | Separate assessment and discovery guidance; `documentation-navigation` check | Project-owned individual source, destination, index, glossary, and link-repair paths confirmed through v2 discovery |
| GitHub labels, required check, and squash settings | `github-repository-configuration` | Separate guidance and intentionally empty project-content discovery; repeat-safe `canonical-labels` and `pull-request-integration` fixes | Remote settings; no project-content paths |
| Pinned regular skills | `skill-*` (25 declarations) | Full directories under `vendor/mattpocock-skills`, pinned at `3cca18b368ae95cdbdebbff572ccafa662551015`; upstream notice retained by the configuration operation | Exact whole skill directories |

The resolved profile contains 52 declarations: 23 exact files, one contextual
file, three repository declarations, and 25 exact skill directories. It has
three checks and two fixes. Exact targets are individual and disjoint from all
contextual scope. Discovery proposes individual files rather than directory
trees, globs, or adopter-specific paths embedded in this source.

The documentation operation resources retain the shared rendered-Markdown
module, the separate local-link module, and complete Marked and parse5
directories with their notices. Other operation resources retain the shared
GitHub operation module, Repo Canon's MIT license and third-party notice, and
the upstream skill license. The rendered-Markdown runtime and parser files are
also exact declarations because both trusted workflow validators import them
from the adopting repository. Each executable therefore resolves the same
relative import layout after installation or resource retention.

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

That result is retained historical evidence for the earlier source bytes. Public
CLI 1.2.2 under Node.js 24.21.0 later returned `valid: true` with no errors for
the accepted `c0d57fa` snapshot at temporary `v0.0.2`.

After the hidden-HTML correction, the same installed public CLI and Node.js
version returned `valid: true`, no errors, one `complete` profile, and 51
declarations for exact reviewed commit
`eb98da8af94e25cc66a7bd0bf5424604d5e3b7ec`. Public acquisition from the new
immutable temporary tag `v0.0.3` resolved to that commit. The
[source closure record](source-closure.json) enumerates all 114 inputs and proves
that the corrected validator is the only selected byte change from `c0d57fa`.
[The adoption record](adoption-evidence.md) preserves the installed npm
integrity, source identity, public and historical execution boundaries, and
outcomes.

The accepted `eb98da8` result remains evidence for those exact 114 source files
and 51 declarations. The rendered-Markdown refactor changes selected and
transitive source bytes, adds the exact `rendered-markdown-runtime`
declaration, and adds the retained local-link resource. Issue
[#46](https://github.com/lutzseverino/repo-canon/issues/46) completed final
whole-source review, recomputed closure, public acquisition, full adoption, and
same-pin re-adoption for the changed source. Public CLI 1.2.2 returned
`valid: true`, no errors, one `complete` profile, and 52 declarations for exact
commit `e63f0d1438eb89c3df51a827ec169a8f5c489ded`; temporary `v0.0.4` resolved
directly to that commit.

Relative to accepted `eb98da8`, this refactor changes seven existing source
files and adds one. Every entry has regular-file mode `100644`; no source path
is removed, and the selected/transitive path set grows from 114 to 115:

| Source path | Delta | Declaration or resource ownership |
| --- | --- | --- |
| `standards.yaml` | Changed | Source manifest |
| `.github/scripts/validate-pr-metadata.mjs` | Changed | Exact `pr-metadata-validator` |
| `scripts/validate-issue-contract.mjs` | Changed | Exact `issue-contract-validator` |
| `operations/check-documentation.mjs` | Changed | `documentation-navigation` operation script |
| `operations/check-project-readmes.mjs` | Changed | `project-readme-structure` operation script |
| `operations/check-repository-readme.mjs` | Changed | `repository-readme-structure` operation script |
| `operations/lib/rendered-markdown.mjs` | Changed | Exact `rendered-markdown-runtime`; retained by all three checks |
| `operations/lib/local-markdown-links.mjs` | Added | Retained by all three checks |

The manifest resolves 52 declarations, including 23 exact files, and retains
three checks, two fixes, three repository declarations, one contextual file,
and 25 skill declarations. The final
[machine-readable closure](source-closure.json) records all 115 paths, roles,
modes, Git blobs, and SHA-256 identities. The
[adoption record](adoption-evidence.md) binds the reviewed source to public
installation, operation, preservation, workflow, and cleanup outcomes.

The accepted `e63f0d1` identity and its 115 source files were published as
`v0.1.0`. The workflow correction in [#55](https://github.com/lutzseverino/repo-canon/issues/55)
changes the bytes of the exact `pr-metadata-workflow` declaration and therefore
the source identity. Issue [#56](https://github.com/lutzseverino/repo-canon/issues/56)
owns the recomputed closure, the public CLI 1.2.2 result for the new commit, and
the `v0.1.1` publication. That correction changes one selected path and
adds or removes none; its mode stays `100644`, and the declaration set, counts,
operations, and skills are unchanged:

| Source path | Delta | Declaration or resource ownership |
| --- | --- | --- |
| `.github/workflows/pr-metadata.yml` | Changed | Exact `pr-metadata-workflow` |

Source validation checks schema, all profiles, references, operation metadata,
reserved identities, and determinable target conflicts. It executes no
operation or prerequisite and cannot establish semantic coverage or safe scope
in an adopting repository. The existing operation fixtures and skill inventory
review remain separate evidence. The confirmed v2 inspections, operation
execution, contextual assessments, authorized remote readback, and complete
adoptions are separately recorded. Repo Canon source publication and release
remain separate work.
