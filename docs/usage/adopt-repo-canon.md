# Adopt Repo Canon

Repo Canon is designed to supply one `complete` Repository Standards v2 profile.
Before using the commands below, check the
[source acceptance record](../development/completion-record.md) for the current
reviewed bytes, supporting evidence, and publication prerequisite. Select only
an owner-published stable SemVer tag covered by that record.

Source authoring, publication, and adoption are separate stages:

1. Repo Canon maintainers edit and validate the local source. The
   [development guide](../development/README.md) gives the repository checks,
   and the [source profile](../development/source-profile.md) gives exact public
   CLI validation.
2. The owner publishes a stable Repo Canon source version after confirming that
   its selected and transitive bytes have accepted evidence. The source
   acceptance record states whether that prerequisite is satisfied.
3. An adopting maintainer inspects the published version, confirms its complete
   project-specific scope, and then starts adoption. Adoption writes project
   content and can change GitHub settings, so review the inspection before
   confirmation.

## Prerequisites

Use macOS or Linux with Node.js 24, npm, and Git. Install the exact public CLI
1.2.2 in a persistent directory outside the adopting project so inspection,
start, and recovery use the same executable:

```sh
adoption_cli="$HOME/.local/share/repo-standards/cli-1.2.2"
mkdir -p "$adoption_cli"
npm install --prefix "$adoption_cli" --ignore-scripts --save-exact \
  --no-audit --no-fund @lutzseverino/repo-standards@1.2.2
repo_standards="$adoption_cli/node_modules/.bin/repo-standards"
"$repo_standards" --version
```

The CLI runtime stays outside the project. Retain it until adoption completes.
Before starting, read the packaged
`skills/adopt-standards/SKILL.md`; after installation, use the matching
repository-local skill for later maintenance.

Repo Canon's two setup fixes also require Git 2.18.0 or newer, GitHub CLI 2.57.0
or newer, an unambiguous `github.com` remote, an authenticated `gh` account, and
write access for labels plus admin access for required checks and merge
settings. Keep the repository clean and committed. If useful existing
`AGENTS.md` instructions need to survive replacement, follow
[Prepare existing agent guidance](prepare-agent-guidance.md), commit that change,
and inspect the prepared commit afresh.

## Inspect the published source

Use the current release, `v0.1.1`, after verifying its [GitHub release](https://github.com/lutzseverino/repo-canon/releases/tag/v0.1.1).
Set `source_tag` to that permanent published SemVer tag. Run the first
inspection from the adopting repository:

```sh
project_root=/path/to/adopting-project
source_tag=v0.1.1

"$repo_standards" inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile complete \
  --project "$project_root" \
  --json > /tmp/repo-canon-initial-inspection.json
```

This first report presents the exact files, skills, operations, current project
state, and discovery evidence. It does not authorize a write. Repo Canon uses
discovery for Project READMEs, documentation paths, and the intentionally empty
project-content scope of remote configuration.

Review the repository evidence and prepare a `repo-standards/scope/v1` proposal
that accounts for every candidate, source and destination of a documentation
move, directory index, and link repair. Record exclusions and reasons, and
resolve every question. Use individual paths; the interface does not accept
discovered directory trees, globs, or repository-root scope. The
[adoption evidence](../development/adoption-evidence.md#prepared-repository-matrix)
contains representative reviewed proposals and the source-backed builder used
for the disposable matrix. The public CLI's
[inspection contract](https://github.com/lutzseverino/repo-standards/blob/v1.2.2/docs/inspection.md)
defines the proposal fields and evidence binding.

Bind the proposal to the initial discovery evidence, then request the complete
inspection:

```sh
"$repo_standards" inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile complete \
  --scope /path/to/reviewed-scope.json \
  --project "$project_root" \
  --json > /tmp/repo-canon-complete-inspection.json
```

Read the full report, including resolved scope, exact replacements, repository
state, prerequisite status, and every operation. A changed project or proposal
changes the inspection identity and requires another review.

## Confirm and complete adoption

After a maintainer confirms the complete inspection, pass its exact `identity`
and the same scope proposal to `start`:

```sh
inspection_identity=sha256:REPLACE_WITH_CONFIRMED_IDENTITY

"$repo_standards" start \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile complete \
  --scope /path/to/reviewed-scope.json \
  --confirm "$inspection_identity" \
  --project "$project_root" \
  --json
```

The fixes run before contextual work. They reconcile canonical GitHub labels,
the `PR metadata` required check, and squash settings, then verify the remote
result. A `blocked` operation or incomplete run names the remaining work and
does not count as adoption. Repeat an interrupted run with `resume --retry` only
after reviewing its retained effects.

For contextual work, follow the returned request within the confirmed paths,
refresh the observation with `resume`, and submit the required
`repo-standards/assessment/v2` file:

```sh
"$repo_standards" resume --project "$project_root" --json
"$repo_standards" resume \
  --assessment /path/to/reviewed-assessment.json \
  --project "$project_root" --json
"$repo_standards" status --project "$project_root" --json
```

Completion requires exact bytes and modes, full skill inventories, retained
inputs and runtime, a current contextual assessment, all checks, unchanged Git
HEAD and index, and successful operation results. Review and commit the adoption
outputs through the project's normal workflow. Remote readback is point-in-time
evidence; the fixes provide repeatability and preservation, without a remote
rollback or freshness guarantee.

For additions discovered during an active run, inspect and confirm an
additions-only amendment before writing them. After a completed adoption, use
the pinned CLI's explicit `inspect --readopt` and `start --readopt` route for a
fresh same-pin adoption. The [compatibility guide](../development/adoption-compatibility.md)
records those supported lifecycle boundaries.
