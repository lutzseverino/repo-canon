# Adopt Repo Canon

The [Repository README](../../README.md#installation) gives the one-line `adopt`
command that adopts Repo Canon and every later update. `adopt` asks each
question adoption needs; this guide covers the choices behind three of them:
the profile, remote setup, and the personal skills adoption leaves to you. The
CLI's
[adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.0.0/docs/usage/adoption.md)
describes `adopt` itself, at a terminal and through an agent.

## Choose a profile

Repo Canon supplies two profiles:

- `standard`: everything Repo Canon installs except the factory's repository
  files. Select it for every repository that no factory serves.
- `factory`: the standard profile plus the files a repository that a factory
  serves carries: its factory configuration, `.factory/config.json`; its
  toolchain image, `.factory/Dockerfile`; and the pull request workflow that
  builds that image. Select it only for a repository that a host-installed
  factory serves, as
  [the factory's usage documentation](../../factory/docs/usage/README.md)
  describes.

Every update offers the profiles again, so a repository switches profile by
answering differently when a factory starts or stops serving it.

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
confirmation, naming the current and proposed values. The `PR metadata`
requirement waits for the adoption to merge, because GitHub runs its workflow
only from the default branch: the first adoption applies the merge settings
and leaves the check unrequired, and the next `adopt` after the merge requires
it. On a private repository whose GitHub plan offers neither branch protection
nor rulesets, the check is unavailable, and adoption completes without it.

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
