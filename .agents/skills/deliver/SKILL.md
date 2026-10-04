---
name: deliver
description: Take completed work, including an adoption run's uncommitted changes, through the contribution workflow to an opened pull request with its checks reported.
disable-model-invocation: true
---

Deliver completed work as one focused pull request, following this repository's
contribution workflow. The workflow's rules live in `CONTRIBUTING.md`; this
skill sequences them and never overrides them. Delivery ends at an opened pull
request with its checks reported. Merging belongs to review.

## 1. Read the rules

Read these before acting, and keep them as the authority for every later step:

- `CONTRIBUTING.md`: issues, validation, titles and commits, and pull requests.
- `.github/PULL_REQUEST_TEMPLATE.md`: the description's sections and their order.
- `docs/development/README.md`: its Setup and validation section names the
  required checks.
- `docs/agents/issue-tracker.md`: how to read issues and pull requests.
- `docs/agents/project.md`, when present: project constraints, such as branch
  naming or a base branch, that supplement the shared rules.

Done when you can name the required checks, the template's sections, and any
project constraint on branches.

## 2. Establish the work and its link

The work is what the maintainer names, or else everything that differs from the
remote default branch: commits on the current branch and uncommitted changes.
Ask when the tree mixes unrelated changes and the maintainer has not said which
belong.

The work is an **adoption run** when its uncommitted changes include
`.repo-standards/`. Read `status --json` with the project's pinned
`.repo-standards/runtime/node_modules/.bin/repo-standards`. When `active` is
not `null`, the run is unfinished: stop, and tell the maintainer to finish it
with `adopt-standards`. Otherwise the run is complete, and its record is the
output of `status --summary`. The record describes only the run, so its pull
request holds only the run.

Find the link the pull request rules require: the related issue, from the
maintainer, the branch, or the commits, read with its comments; or, for an
eligible small correction, its reason. An adoption run needs neither when its
record is the description. When work needs an issue and has none, stop and ask.

Done when the work's paths and its issue, small-correction reason, or adoption
record are known.

## 3. Branch

Put the work on a branch that holds only this work, created from the up-to-date
remote default branch when the current branch is the default branch or carries
other work. Carry the work's uncommitted changes onto it unchanged, and leave
any unrelated uncommitted changes uncommitted.

Done when `git log origin/<default>..HEAD` shows only this work's commits.

## 4. Commit and title

Write the title as the rules for titles and commits require. An adoption run's
title names the selected source version and CLI from the record's Selection
table, and takes no breaking-change marker, because the record carries no
impact or migration explanation. Commit the work with the title as the commit
subject, staging only the work's paths. For an adoption run, those are the
record's changed paths and `.repo-standards/`.

Done when `git status` shows no part of the work left uncommitted.

## 5. Validate

Check that the changed behavior has the tests the validation rules ask for;
when it lacks them, stop and report. Run every required check from the
development guide on the committed work, plus the focused tests for the changed
behavior. A check that reads a diff, such as `git diff --check`, sees only
unstaged changes in its bare form: run it over the pull request's whole change
instead, against `origin/<default>...HEAD`. Record each command and its outcome
as you run it. Fix a failure that the work caused, within the work's scope,
commit the fix, and run the checks again; stop and report any other failure.

Done when every required check has run on the final commit and each outcome is
recorded.

## 6. Describe

Write the description from the template, as the pull request rules require.
For an adoption run, use the record as the description instead, as those rules
allow: the `status --summary` output unchanged, starting with its
`# Repository Standards adoption record` heading.

Done when every template section is present in its order, and the Validation
section lists only checks that actually ran and explains any required check
that did not.

## 7. Open and report

Push the branch and open the pull request against the default branch with the
title and description. For an adoption run, post the step 5 outcomes as one
pull request comment, because the record leaves them out.

Wait for the pull request's checks to finish, for example with
`gh pr checks <number> --watch`. When no check has registered yet, wait briefly
and look again. Report to the maintainer:

- the pull request URL and title;
- each local check and its outcome;
- each pull request check and its outcome, naming any failure with its details,
  or that the repository reported none.

Done when every pull request check has a final outcome, or none registered, and
the report states each one as observed.
