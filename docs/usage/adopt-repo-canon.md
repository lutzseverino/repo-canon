# Adopt Repo Canon

The [Repository README](../../README.md#installation) gives the one-line `adopt`
command that adopts Repo Canon and every later update. `adopt` asks each
question adoption needs; this guide covers profiles, caller compatibility,
stacks, remote setup, opting into automated updates, orchestrating plans, and
the personal skills adoption leaves to you. The
CLI's
[adoption guide](https://github.com/lutzseverino/repo-standards/blob/v10.0.0/docs/usage/adoption.md)
describes `adopt` itself, at a terminal and through an agent.

## Choose a profile

Repo Canon supplies three profiles:

- `standard`: everything Repo Canon installs except the factory's repository
  files and workflow rules. Select it for every repository that no factory serves.
- `factory`: the standard profile plus the files a repository that a factory
  serves carries: its factory configuration, `.factory/config.json`; its
  toolchain image, `.factory/Dockerfile`; and the pull request workflow that
  builds that image. It also installs repository-wide factory workflow rules
  for readiness, model selection, state labels and owner handoffs, with an
  intentionally empty content scope. Select it only for a repository that a host-installed
  factory serves, as
  [the factory's usage documentation](https://github.com/lutzseverino/scriptorium/blob/main/docs/usage/README.md)
  describes.
- `workbench`: only the workflow skills, with the files their scripts import
  and their license notices, for the orchestrating agent's workbench rather
  than a project repository. It installs no rules, CI workflows, labels,
  branch requirements or remote setup; see
  [Orchestrate plans](#orchestrate-plans).

Every update offers the profiles again, so a repository switches profile by
answering differently when a factory starts or stops serving it.

## Prepare caller compatibility

Read the target release's notes before updating. If your repository's own tests
or scripts execute, import, or fake an installed runtime, identify the affected
callers and the calling contracts the notes describe. Check those callers
against the newly installed files and run your repository's own applicable
tests before committing the update; the adoption checks do not establish that
your callers still work. Check meaningful outcomes, such as rejection of
invalid input, as well as exit status.

Start adoption from a clean committed tree through the public CLI. A disposable
checkout of the current base can help explore compatibility against the target
release without disturbing other work. For an active run, follow the
[pinned-runtime completion and recovery rules](../../CONTRIBUTING.md#adoption-pull-requests).
Do not hand edit installed source to make a caller pass.

When repository-owned compatibility fixes are needed, land them in separate
prerequisite pull requests before the adoption pull request. Link their issues
under the [partial-work `Part of` convention](../../CONTRIBUTING.md#pull-requests).
Keep the existing default branch runnable while those fixes land. Supporting and checking both
the old and target runtimes can help when a prerequisite must work before and
after the update; it is a technique to use where needed, not a requirement for
every adoption.

After the prerequisites land, repeat any exploratory adoption that needs it
from a clean committed tree on the updated base, using the public CLI. Follow
the [adoption pull request rules](../../CONTRIBUTING.md#adoption-pull-requests)
for the pre-commit ready-to-commit verdict and delivery of one completed run.
Keep repository-owned compatibility fixes in their prerequisite pull requests.
This preparation adds no CLI gate or universal test command.

## Language statistics

The standard and factory profiles include the contextual `git-attributes`
declaration. On adoption
or update, it adds `linguist-vendored` entries to the root `.gitattributes` for
Repo Canon's installed code that GitHub would otherwise count as yours. It
preserves your existing lines and limits entries to installed files or
individual installed skill directories. Later updates remove obsolete Repo
Canon entries when the selected declarations stop installing those paths.
Repository Standards handles its own `.repo-standards/` state separately.

Repo Canon's own repository needs no entries for its own code. When nothing
needs an entry, adoption creates no `.gitattributes`. GitHub reads committed
attributes, so the language bar changes after the adoption reaches the default
branch.

## Stacks

The standard and factory profiles include the optional
`typescript-node-stack` declaration, for
CLIs and libraries built with pnpm 11, Node.js 24 or 26, TypeScript 7, oxlint 1,
Prettier 3 and `node --test`. Adoption drafts its scope from your manifests and
workspaces, one `package.json` per Project. A new Project joins the stack. An
existing Project that differs stays out, and the adoption handoff lists its
differences for a separate migration. For each Project in the scope, adoption
installs the stack's rules, assesses the Project against them, and runs a
read-only check of its manifests. A repository without such a Project confirms
no scope: no stack rules are installed and no stack check runs.
The optional `typescript-astro-stack` and `typescript-vite-stack` declarations
also ship in both of them for Sites and Apps. They install the same shared
web rules, with separate discovered scopes and checks. Node discovery excludes
web Projects, including shared web packages; a package with non-web consumers
remains independently eligible for Node. Framework tools alone do not decide
membership, and a Vite-built Site stays outside all stacks until migrated.
Each maintained workspace root is assessed independently of its members;
shared-only roots supply facts without becoming scoped Projects. Checks cover
manifest/configuration facts; framework and runner majors and actual validation
behavior remain assessed. [Recommended stacks](stacks.md) describes all three
stacks and their checked/assessed boundary.

## Remote setup

Remote setup is the part of adoption that changes the repository's settings on
GitHub. Repo Canon has two remote setup fixes:

- Canonical labels creates and reconciles the triage and planning labels. Its
  account needs write, maintain, or admin access to the repository.
- Pull request integration requires the `PR metadata` check and sets
  squash-only merging. Its account needs admin access.

Both also need Git 2.18.0 or newer, GitHub CLI 2.57.0 or newer signed in to
`github.com` with `gh auth login`, and repository-local `github.com` remotes
that all name the same repository. Before writing anything, `adopt` probes
each fix read-only and reports it not ready, with the reason, when one of these
is missing.

Resolve the reason and run `adopt` again, or defer the fix so adoption
completes locally without it; `status` and the adoption record list what was
deferred. Every later `adopt`, whether it updates or applies the adopted
version and profile again, probes again and applies a deferred fix once its
probe is ready. Once the reason is resolved, run `adopt` in the adopted
repository without the URL:

```sh
npx @lutzseverino/repo-standards adopt
```

Before changing a setting that already has a value, either fix asks for
confirmation, naming the current and proposed values. Settings still at
GitHub's stock values for a new repository need no confirmation: a label named
`wontfix` that still has GitHub's default color and description, and merge
settings that are all at GitHub's stock values. A single other value makes the
merge settings count as chosen. The `PR metadata`
requirement waits for the adoption to merge, because GitHub runs its workflow
only from the default branch: the first adoption applies the merge settings
and leaves the check unrequired, and the next `adopt` after the merge requires
it. On a private repository whose GitHub plan offers neither branch protection
nor rulesets, the check is unavailable, and adoption completes without it.

For unattended delivery, `babysit` confirms strict required-check enforcement
for the merging credential. A matching active ruleset's explicit
`current_user_can_bypass: "never"` supplies that evidence even when GitHub hides
the global bypass list or other actors can bypass. Without qualifying ruleset
evidence, the existing strict classic protection enforced for admins can still
qualify. Unconfirmed enforcement stops delivery for the owner; see the
[merge script's policy checks](../development/babysit-merge.md).

## Automated updates

The standard and factory profiles install an inert
`.github/workflows/standards-update.yml`. To
opt in, set the repository Actions variable `REPO_CANON_UPDATES` to `true`.
The workflow runs daily and through **Run workflow**, always against the
default branch, using the same `REPO_CANON_RUNS_ON` runner selection as the
other installed jobs. Delete the opt-in variable or change it from `true` to
skip the job again.

For updates that trigger CI and can change workflow files, install a GitHub
App on the repository with Contents, Pull requests, Issues and Workflows
repository permissions set to read and write. Set the repository Actions
variable `REPO_CANON_UPDATE_APP_CLIENT_ID` to its Client ID. Find it on the
App's settings page: in the owning account's or organization's settings, select
**Developer settings > GitHub Apps > Edit**, then copy **Client ID**.
Set Actions secret `REPO_CANON_UPDATE_APP_PRIVATE_KEY` to its private key.
The workflow creates an installation token only when both are set and requests
exactly those four write permissions. Otherwise it uses
`GITHUB_TOKEN`: pull requests it opens trigger no CI, and it cannot push
workflow-file changes. For the fallback, enable **Allow GitHub Actions to
create and approve pull requests** in the repository's Actions settings.

The action updates both adoption pins together and keeps one rolling pull
request, or one rolling issue with the open questions when it needs local
work or cannot push. New releases refresh that item; the same target does
nothing. Majors and `0.x` minors produce `chore!:` pull requests with Impact
and Migration sections. Remote setup is deferred: run local `adopt` after
merging to apply it. The installed caller does not wire `agent-command`;
write your own caller workflow if you want an agent to finish contextual work.
The [workflow development document](../development/standards-update-workflow.md)
describes its pins and validation.

## Orchestrate plans

Every profile installs the `orchestrate` skill, which only you can invoke.
With it, the orchestrating agent turns a feature or problem into a plan you
approve, keeps the plan's state in a workbench, and runs the plan to an
announced close. The workbench is a private git repository of plain Markdown,
outside every project repository. Name its path in your global agent
instructions and clone it on each host that runs an orchestrating session.
When they name none, the skill creates one and tells you the line to add.

The shared method works with the capabilities available in your session.
Applications can enhance it, and any application-specific tool mappings belong
in your own setup outside Repo Canon. No adoption profile installs that
private setup.

An orchestrating session often runs outside every project checkout, where no
repository's skills are found. Adopt the `workbench` profile into the
workbench and start orchestrating sessions there: it installs the workflow
skills pinned to a Repo Canon release, like any adopting repository, without
the rules, workflows and branch requirements a project repository carries.
When the skill creates a workbench, it offers this adoption. To adopt it
yourself, run this in the workbench, from a clean committed tree:

```sh
npx @lutzseverino/repo-standards adopt https://github.com/lutzseverino/repo-canon --profile workbench
```

Update it like any adoption, by running `adopt` there without the URL. A
workbench takes every change as a direct commit to its default branch, so
commit the completed adoption or update there once `status` reports it ready
to commit, rather than opening a pull request. Grilling sessions keep running
in their target repository's checkout.

Earlier versions of this guide had you link the skill directory from an
adopted project checkout into your user-level skills directory. That link
follows the checkout's working tree, including unreleased changes, so remove it
once the workbench has adopted the profile.

The skill's wait script wakes the orchestrating agent when a watched issue,
pull request or workbench file changes. It runs from the workbench with
Node.js 24 or 26, importing the installed `babysit` skill and vendored Postern
bundle, and reads GitHub with the GitHub CLI's current credential. Each
invocation names its own poll interval and maximum duration; the script has no
default for either.

Each plan you approve names its Close reviews, which run before the plan's
closing announcement. The retro is always one: a separate session reviews the
plan and sends each lesson to whoever owns the rule it concerns, such as your
own repository, your setup or a wish. A lesson about a Repo Canon skill or rule
becomes an issue filed against Repo Canon, even when you don't develop it,
because your installed copy changes only through an update. The orchestrating
agent also proposes an `improve-codebase-architecture` review for each
repository whose code the plan changes; you keep or remove each one.

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
