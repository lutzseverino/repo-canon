# Self-adoption of v0.2.0

Repo Canon adopted its own published `v0.2.0` release with the `complete`
profile through the public Repository Standards CLI, taking exactly the path
every adopter takes and never reading its working tree, as
[ADR 0004](../adr/0004-adopt-published-releases-of-this-source.md) requires.
This record completes the delivery that
[#60](https://github.com/lutzseverino/repo-canon/issues/60) specifies and
[#63](https://github.com/lutzseverino/repo-canon/issues/63) tickets, following
[release v0.2.0](release-v0-2-0.md) and sitting beside the
[first real adoption](real-adoption.md).
[The machine-readable record](self-adoption-record.json) binds the identities
and outcomes below.

Status: complete. The run finished with all adoption changes uncommitted, and
they entered the repository through the normal pull request flow.

## Selection and identities

The CLI was public `@lutzseverino/repo-standards` 1.3.0, installed outside the
project with npm integrity
`sha512-9YMmxfIVkTYXSVODNe5C/mwIbLBO+2d++3jw/JXkb1nyQ4p37C6H3/SLg+ZKT3I9qy6p0iJkmiSf9M5P1dqfWg==`
and kept there for inspection, start, and resume. The selection was
`https://github.com/lutzseverino/repo-canon` at `v0.2.0`, commit
`79ff51198465248df67c6e1d6a66c95e2f964df5`, profile `complete`.

| Identity | Value |
| --- | --- |
| Confirmed complete inspection | `sha256:ead33120407cce9fabf34f821f2517b1be1f0886a3e3a408fd99876ef2c50172` |
| Discovery request | `sha256:4a2f6cb3a83d666a5fb411608efbce33d8d6ae328ee73371927996f79cbaaa42` |
| Run | `baaed5f0-ce1d-4e35-87fa-59c246269b00` |
| Selection | `sha256:8f22ef9f166d4cb75331fe1ea9b127a1818ec5ba7938703aadffe2d1f6483eb9` |
| After-fixes snapshot | `sha256:c79fdf00c9aaf53faaa8dd23e6662a41243f6a61f9a7fcddd302ec115f413072` |
| Assessed snapshot | `sha256:91537700c31f5b108c1f922ccda5726546acb3c5a1a7b1c7168cfca25feb5997` |

The first inspection was rejected for adoption with `DISCOVERY_REQUIRED`, as
every v2 discovery source is, and the scope proposal below made the second
inspection reviewable. That first report's own identity is not part of the
retained state and is deliberately not restated here; the confirmed identity
above is the one adoption was tied to. An inspection identity binds the
inspected project state and root as well as the selection, so it reproduces only
for this repository at HEAD `5a03353d95f327b67673e6285c991a4a244b179e` with a
clean tree.

## Maintainer confirmation before start

The maintainer confirmed the complete inspection personally before any write,
on 2026-09-18 at 13:41 UTC, one minute before `start` ran:

> maintainer lutzseverino confirmed inspection identity `sha256:ead33120…` and
> the disclosed operations before `start`, with the label-drift outcome
> acknowledged

The confirmation was tied to that one identity and to the disclosed operations,
explicitly including that `pull-request-integration` would create the
required-check ruleset with no bypass actors and that `canonical-labels` would
report `changed` because three canonical label descriptions had drifted from
the shipped bytes. The maintainer also decided the one open scope question,
`CONTEXT.md`, in favor of inclusion. A general request to adopt was never
treated as confirmation, and the repository state was re-verified as unchanged
immediately before `start`.

## Confirmed scope

The proposal was built from the real inspection's 398 discovery-evidence
entries, bound to discovery request `sha256:4a2f6cb3…`, and prepared outside the
project.

The `documentation` declaration confirmed 126 paths: every Markdown document in
the `docs` tree except the four exact-owned shared agent configuration files,
the project-specific agent guidance `docs/agents/project.md`, the repository
root glossary `CONTEXT.md`, and the two root decision records
`authoring-notes.md` and `design-review.md`. `docs/README.md` with the `usage`,
`development`, and `adr` category indexes makes the documentation root
recognizable to the read-only check. No document moved, so no link repair was
due: [#61](https://github.com/lutzseverino/repo-canon/issues/61) had already
rewritten the two broken wayfinder links during preparation.

Exclusions, each recorded with its reason:

| Excluded | Reason |
| --- | --- |
| `README.md` | The `repository-readme` declaration's own contextual target. |
| `docs/agents/README.md`, `domain.md`, `issue-tracker.md`, `triage-labels.md` | Exact-owned shared agent configuration the discovery guidance keeps outside documentation scope. |
| `AGENTS.md`, `CONTRIBUTING.md` | Exact-owned shared guidance replaced byte for byte. |
| `.github/` | Exact-owned templates and workflows plus repository automation. |
| `drafts/` | Review drafts retained as the reviewed material as of the design review, deliberately not re-synced. |
| `guidance/`, `discovery/` | Source-side guidance and discovery instructions shipped to adopters, not this repository's documentation. |
| `vendor/` | Vendored third-party material that must stay byte-identical to its upstream releases. |
| `operations/`, `scripts/`, `test/` | Declared source operations, maintenance tooling, and fixtures. |
| `THIRD_PARTY_NOTICES.md`, `LICENSE`, `standards.yaml`, `package.json` | Legal notices, licensing, the manifest, and project configuration. |
| 15 non-Markdown artifacts under `docs/` | Retained evidence records that must not be rewritten; the documents linking them stay in scope. |

`github-repository-configuration` and `project-readmes` confirmed empty
project-content scope with explanations: the first changes only remote settings
through its authored fixes, and this repository is a single standards source
with one root manifest and no nested Project. No declaration left an unresolved
question.

`CONTEXT.md` was the one membership question decided explicitly. The
documentation guidance governs where domain glossaries live, and scope that
omits a file grants no authority to maintain it, so the glossary belongs in the
declaration that governs it. The repository conformance test's documentation
declaration was widened to match the confirmed scope in the same change.

## Operation results

| Operation | Phase | Result |
| --- | --- | --- |
| `canonical-labels` | fixes | `changed`: updated 3 labels; readback confirmed all 12 canonical labels and preserved the unrelated ones. |
| `pull-request-integration` | fixes | `changed`: created the required-check ruleset; final readback confirmed `PR metadata`, squash-only integration, pull request title subjects, and body messages, preserving unrelated settings and rules. |
| `documentation-navigation` | checks | `passed` |
| `project-readme-structure` | checks | `passed` for 0 concrete targets |
| `repository-readme-structure` | checks | `passed` |

Independent readback of `repos/lutzseverino/repo-canon/rulesets` after the run
shows ruleset `23659277`, "Repo Canon required PR checks", `target: branch`,
`enforcement: active`, condition `~DEFAULT_BRANCH`, one `required_status_checks`
rule requiring the `PR metadata` context, `bypass_actors: []`, and
`current_user_can_bypass: "never"`. Merge settings were already squash-only with
`PR_TITLE` subjects and `PR_BODY` messages, so the fix changed only the ruleset.

## Installed material and completion

48 exact declarations resolved: 23 already matched byte for byte, and 25 were
created, all of them author skills installed as copies under `.agents/skills/`
(74 files), alongside the product-owned `adopt-standards` skill. Nothing under
`.agents/` or the tracked parts of `.repo-standards/` is a symlink;
[ADR 0001](../adr/0001-manage-shared-skills-through-standards-releases.md) and
ADR 0004 explain why these copies of source-owned files exist and must not be
removed as duplicates. Durable state under `.repo-standards/` adds about 1.3 MB
of tracked content, the compact format that CLI 1.3.0 introduced.

`start` completed installation and both fixes and handed off with
`CONTEXTUAL_REQUIRED`. After the contextual work below, `resume --json`
refreshed the work request, and `resume --assessment` accepted a
`repo-standards/assessment/v2` submission covering all four contextual
declarations, each `satisfied`, with both scope-validity reviews `valid` for the
three discovery declarations. That command returned a `repo-standards/run/v2`
report with `outcome: complete`, reason "Exact installation, fixes, contextual
assessment where required, checks, runtime, retained inputs and durable state
verified", and exit status 0 at 2026-09-18T13:46:19.466Z over HEAD
`5a03353d95f327b67673e6285c991a4a244b179e`.

`status --json` then reported `repo-standards/status/v5` with `active: null` and
`lastComplete` naming run `baaed5f0-ce1d-4e35-87fa-59c246269b00`, inspection
`sha256:ead33120…`, and that completion time, with all three checks `passed` and
the assessment retained. The status format carries no literal `outcome` field;
`outcome: complete` is the run report's field, and `status` expresses the same
fact as a completed run with no active one. Every recorded observation interval
shows zero scope violations and zero boundary changes, and the only agent change
in the run is `README.md`.

No repository test asserts adoption state. The existing suite and the source
validation step in CI cover the source itself, and the repository conformance
test keeps running the three shipped checks against this tree.

## Contextual work on the Repository README

The only contextual edit was `README.md`, under the `repository-readme`
declaration. The Repository README guidance orders recognized sections
Installation, Features, Usage, Configuration, Documentation, Contributing,
License, and makes Installation first when it applies. The former Usage section
was really the installation path, so it became Installation: the shortest
working user path installs the exact public CLI 1.3.0 that `v0.2.0` requires,
outside the adopting project, and points at the adoption guide for the remaining
prerequisites, which keeps user installation distinct from contributor setup.
Usage now carries one representative example, the read-only inspection of
`v0.2.0` with the `complete` profile, and keeps the facts the old section
stated: verify the published release, and select only bytes the
[source acceptance record](completion-record.md) covers. A short Features list
states what adopting applies, drawn from the resolved profile this run
installed. The centered title, description, and badges were preserved.

## What self-adoption surfaced

- **Canonical label drift in the source's own repository.** Three canonical
  label descriptions on `lutzseverino/repo-canon` differed from the bytes this
  source ships: `ready-for-agent`, `ready-for-human`, and `wontfix`. The fix
  updated them, so `canonical-labels` reported `changed` where the
  specification expected `unchanged`. Nothing in the repository's own tests
  compares live labels with the canonical set, so only running the shipped fix
  against this repository could find it.
- **The source did not run under its own pull request rule.** Before this
  adoption `repos/lutzseverino/repo-canon/rulesets` was empty, so the
  required `PR metadata` check the source requires of every adopter was not
  enforced here. It now is, with no bypass actors.
- **A structural check cannot see a mislabeled section.** The Repository README
  check passed before this work, because it validates title centering, section
  order, navigation links, and the license link. It had no way to notice that
  the section named Usage was the installation path. Contextual guidance work,
  not the check, corrected that.
- **The glossary sat outside the declaration that governs it.** The repository
  conformance test's documentation declaration did not cover `CONTEXT.md`, and
  the confirmed scope had to decide the glossary explicitly. Test and confirmed
  scope now agree.
- **Compact durable state is real.** Completed adoption added about 1.3 MB of
  tracked state, against the roughly 26 MB that CLI 1.2.2 would have committed
  and that blocked this work until the compact evidence release.

## Evidence boundary

Self-adoption complements adoption by other repositories; **it cannot find what
only a different repository reveals**. The `v0.1.0` workflow defect that broke
the installed `PR metadata` check for a pnpm repository was invisible here,
because this repository uses npm, and only the
[first real adoption](real-adoption.md) could surface it. Everything above
describes this one run at this one pin: it renews no source validation,
publishes nothing, and asserts no continuing compliance after later edits.

The inspection reports, the scope proposal, and the run reports were stored
outside the repository during the delivery, as adoption requires, and that
temporary storage was cleared by a host reboot before this record was written.
Those external files were not retained. Every identity, scope decision, and
operation result recorded here was read back afterwards from the retained
durable state the completed run wrote into `.repo-standards/`: `state.json` for
the run, checks, and assessment, `inputs/scope-history.json` for the accepted
proposal with its candidate reasons, `selection.yaml` for the pins, and the
local run report the CLI keeps outside Git. The maintainer's confirmation of
inspection identity `sha256:ead33120…` was given before `start` and is recorded
above as it was received. The durable subset that outlives this delivery is this
document and [the machine-readable record](self-adoption-record.json).
