# Give the workbench its own profile

Repo Canon offers a third profile, the workbench profile, which the
orchestrating agent's workbench adopts. It installs only the workflow skills,
with the files their executables import and the license notices, and no rules,
CI workflows, labels, branch requirements or remote setup. An update works like
any other adoption update, except that it lands as one direct commit to the
workbench's default branch, as every workbench change does. An orchestrating
session runs in the workbench and gets the pinned `orchestrate` skill from it;
a grilling session still runs in its target repository's checkout.

Workflow skills are installed per repository, so a session outside every
repository found no Repo Canon skill except a stale user-level copy. The
adoption guide had the owner link a skill directory from an adopted checkout
into their user-level skills, which follows that checkout's working tree,
including unreleased changes. The owner chose this profile in the cleanup grill
on 2026-10-30 (decision D34, recorded in
[#734](https://github.com/lutzseverino/repo-canon/issues/734)). The standard
profile does not fit a workbench: its default-branch checks, pull request
workflows and remote setup conflict with direct commits to a private record.
Three alternatives were rejected: a user-level install from a release tag,
because nothing updates or checks it; running orchestrating sessions in an
arbitrary adopting repository, because the workbench lies outside every project
repository; and an installer for the owner's own hosts, which the owner judged
"too arbitrary", since other adopters do not share their setup.

## Consequences

- Repository Standards profiles do not combine, as
  [ADR 0017](0017-make-the-factory-an-optional-profile.md) records, so the
  workbench profile is a whole profile that excludes every other default
  declaration with `exclude: true`. A new default declaration joins it until
  it is excluded, and a test fails until then.
- "Only the workflow skills" excludes conventions and configuration, not the
  files the installed skills need to run: Postern for `babysit` and the
  `orchestrate` wait, and the issue-contract validator, the rendered-Markdown
  runtime and its parsers for the `triage` readiness command, with their
  license notices. The CLI's own adoption records and runtime are bookkeeping.
- The `orchestrate` skill offers this profile when it creates a workbench, and
  the adoption guide replaces its checkout-link instructions with it. Personal
  skills stay each maintainer's own install, as
  [ADR 0018](0018-install-only-workflow-skills.md) decides.
- Release verification adopts and updates the workbench profile like the other
  profiles; the first release that declares it has no earlier adoption to
  update.
