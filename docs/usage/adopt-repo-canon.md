# Adopt Repo Canon

Repo Canon supplies two Repository Standards v2 profiles:

- `standard`: everything Repo Canon installs except the factory's repository
  files. Select it for every repository that no factory serves.
- `factory`: the standard profile plus the files a repository that a factory
  serves carries: its factory configuration, `.factory/config.json`; its
  toolchain image, `.factory/Dockerfile`; and the pull request workflow that
  builds that image. Select it only for a repository that a host-installed
  factory serves, as
  [the factory's usage documentation](../../factory/docs/usage/README.md)
  describes.

The commands below select `standard`; for a repository a factory serves,
replace it with `factory`. Before using the commands below, read the notes of the
[published release](https://github.com/lutzseverino/repo-canon/releases) you
select. Select only an owner-published stable SemVer tag.

Source authoring, publication, and adoption are separate stages:

1. Repo Canon maintainers edit and validate the local source. The
   [development guide](../development/README.md) gives the repository checks,
   and the [source profile](../development/source-profile.md) gives exact public
   CLI validation.
2. The owner publishes a stable Repo Canon source version through the
   [release procedure](../development/release.md), which reviews and validates
   its source inputs before publication.
3. An adopting maintainer inspects the published version, reviews its complete
   project-specific scope, and then starts adoption, confirming only when the
   inspection requires it. Adoption writes project
   content and can change GitHub settings, so review the inspection before
   starting. The
   [first real adoption](https://github.com/lutzseverino/repo-canon/blob/b759f28cff401431fdd93901abd4f65f9b8dcb00/docs/development/real-adoption.md) records how one
   repository completed these stages, including the migration effort and the
   defects it surfaced.

## Prerequisites

Use macOS or Linux with Node.js 24, npm, and Git 2.32.0 or newer. Use public CLI
7.0.0 or newer; 7.0.0 is the current source-validation baseline. Install a pinned
CLI in a persistent directory outside the adopting repository so inspection,
start, and recovery use the same executable:

```sh
adoption_cli="$HOME/.local/share/repo-standards/cli-7.0.0"
mkdir -p "$adoption_cli"
npm install --prefix "$adoption_cli" --ignore-scripts --save-exact \
  --no-audit --no-fund @lutzseverino/repo-standards@7.0.0
repo_standards="$adoption_cli/node_modules/.bin/repo-standards"
"$repo_standards" --version
```

The CLI runtime stays outside the project. Retain it until adoption completes.

Repo Canon's two setup fixes also require Git 2.18.0 or newer, GitHub CLI 2.57.0
or newer, an unambiguous `github.com` remote, an authenticated `gh` account, and
write access for labels plus admin access for required checks and merge
settings. Both fixes are remote setup: inspection probes each one read-only and
reports it not ready, with the reason, when one of those is missing. Resolve
the reason and inspect again, or add `--defer-remote-setup` to `start` to
complete adoption without it; every later update probes again and applies it
once ready. Keep the repository clean and committed. If useful existing
`AGENTS.md` instructions need to survive replacement, follow
[Prepare existing agent guidance](prepare-agent-guidance.md), commit that change,
and inspect the prepared commit afresh. Records with retired formats in `.repo-standards` or as run records in Git's
directory cannot be read by CLI 7.0.0; such a repository adopts fresh, as the CLI's
[adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.0.0/docs/usage/adoption.md#adopt-fresh-from-a-retired-format)
describes.

## Inspect the published source

The latest [published release, `v0.13.0`](https://github.com/lutzseverino/repo-canon/releases/tag/v0.13.0),
works with CLI 7.0.0 and uses operation/result v2. Before updating an
existing adoption, review the breaking standards changes and migration steps of
each release since the adopted one.
Run the first inspection from the adopting repository:

```sh
project_root=/path/to/adopting-project
source_tag=v0.13.0

"$repo_standards" inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile standard \
  --project "$project_root" \
  --json > /tmp/repo-canon-initial-inspection.json
```

This first report presents the exact files, skills, operations, current project
state, and discovery evidence. It does not authorize a write. Repo Canon uses
discovery for Project READMEs, documentation paths, and the intentionally empty
project-content scope of remote configuration.

Prepare a `repo-standards/scope/v2` proposal from the repository evidence and
Repo Canon's discovery guidance. For the `documentation` declaration, that
guidance has the agent run the documentation scope drafter shipped with the
selected source and decide only its unresolved questions. The public CLI's
[inspection contract](https://github.com/lutzseverino/repo-standards/blob/v7.0.0/docs/usage/inspection.md#discover-contextual-file-scope)
defines the proposal fields; the CLI derives the evidence binding.

Request the complete inspection with the proposal:

```sh
"$repo_standards" inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile standard \
  --scope /path/to/reviewed-scope.json \
  --project "$project_root" \
  --json > /tmp/repo-canon-complete-inspection.json
```

Read the full report, including resolved scope, exact replacements and the
edits they discard, repository state, prerequisite status, and every operation.
A changed project or proposal changes the inspection identity and requires
another review.

## Review and complete adoption

After reviewing the complete inspection, pass its exact `identity` and the
same scope proposal to `start`:

```sh
inspection_identity=sha256:REPLACE_WITH_REVIEWED_IDENTITY

"$repo_standards" start \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$source_tag" \
  --profile standard \
  --scope /path/to/reviewed-scope.json \
  --identity "$inspection_identity" \
  --project "$project_root" \
  --json
```

When the report's `confirmation.required` is `true`, obtain the maintainer's
confirmation of those changes and add `--confirmed` to `start`. When it is
`false`, start with the identity alone; `--confirmed` is rejected when the
inspection does not require it.

The fixes run before contextual work. They reconcile canonical GitHub labels,
the `PR metadata` required check, and squash settings, then verify the remote
result. They create missing settings freely. Before changing an existing
chosen value, a fix returns `confirmation-required` without mutation, naming
the current and proposed values. After the maintainer confirms that overwrite,
run `resume --confirmed --project "$project_root" --json`. Confirmation applies
to that fix only; a later fix asks separately when it needs to overwrite.
The required check is plan-gated: on a private repository whose GitHub
plan offers neither branch protection nor rulesets, the fix reports it
unavailable and adoption completes without it. A first adoption defers the
required check, because GitHub runs the PR metadata validation workflow only
from the default branch, which carries it only once the adoption merges: the
fix applies the squash settings, reports the check deferred, and adoption
completes without it. After the adoption merges, the next update, including one
with an unchanged selection, requires the check. A `blocked` operation or
incomplete run names the remaining work and does not count as adoption. Repeat
an interrupted run with `resume --retry` only after reviewing its retained
effects.

For contextual work, follow the returned request within the confirmed paths,
refresh the observation with `resume`, and submit the required
`repo-standards/assessment/v3` file:

```sh
"$repo_standards" resume --project "$project_root" --json
"$repo_standards" resume \
  --assessment /path/to/reviewed-assessment.json \
  --project "$project_root" --json
"$repo_standards" status --project "$project_root"
"$repo_standards" status --project "$project_root" --json
```

Plain `status` prints the Markdown adoption record with its ready-to-commit
verdict; `status --json` returns `repo-standards/status/v8` for scripts.

Completion requires exact bytes and modes, full skill inventories, retained
inputs and runtime, a current contextual assessment, all checks, unchanged Git
HEAD and index, and successful operation results. Review and commit the adoption
outputs through the project's normal workflow. Remote readback is point-in-time
evidence; the fixes provide repeatability and preservation, without a remote
rollback or freshness guarantee.

## Correct a confirmed scope

When contextual work needs a file outside the confirmed scope, or a confirmed
path is mistaken, correct the scope as the CLI's
[adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.0.0/docs/usage/adoption.md#correct-a-confirmed-scope)
describes.

## Recommended personal skills

Adoption installs only workflow skills, whose output the shared workflow keeps.
Personal skills serve only the person using them, so Repo Canon leaves them to
each maintainer. It recommends these:

- `teach`: learn a new skill or concept within the workspace.
- `to-questionnaire`: turn a decision you can't fully answer into a
  questionnaire for someone else.
- `wait-what`: have the agent re-pitch a message that did not land.
- `handoff`: compact a conversation into a document another agent picks up.
- `retro`: run a retrospective on a coding session.
- `wizard`: generate a bash wizard for steps only a person can perform.
- `show-me`: explain the current topic with diagrams and focused HTML.

Install them at user scope with the upstream installer, so they follow you
across repositories:

```sh
npx skills@latest add mattpocock/skills --global --skill teach \
  --skill to-questionnaire --skill wait-what --skill handoff --skill retro \
  --skill wizard
npx skills@latest add humanlayer/skills --global --skill show-me
```
