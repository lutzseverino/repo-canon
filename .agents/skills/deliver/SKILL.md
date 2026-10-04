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
default branch: commits on the current branch and uncommitted changes. Ask when
the tree mixes unrelated changes and the maintainer has not said which belong.

The work is an **adoption run** when its uncommitted changes include
`.repo-standards/`. Read `status --json` with the project's pinned
`.repo-standards/runtime/node_modules/.bin/repo-standards`. An `active` run
that is not `null` is unfinished: stop and hand back to `adopt-standards`.
Otherwise the run is complete, and its record is the output of `status
--summary`. An adoption run is delivered alone, in its own pull request.

Find the link the pull request rules require: the related issue, from the
maintainer, the branch, or the commits, read with its comments; or, for an
eligible small correction, its reason. An adoption run needs neither, because
its record is the description. When work needs an issue and has none, stop and
ask.

Done when the work's paths and its issue, small-correction reason, or adoption
record are known.

## 3. Branch

Put the work on a branch that holds only this work, created from the up-to-date
default branch when the current branch is the default branch or carries other
work. Carry uncommitted changes onto it unchanged. Leave unrelated changes where
they are.

Done when `git log <default>..HEAD` and `git status` show only this work.

## 4. Validate

Run every required check from the development guide, plus the focused tests for
the changed behavior. Record each command and its outcome as you run it. Fix a
failure that the work caused, within the work's scope, and run the checks again;
stop and report any other failure.

Done when every required check has run on the final content and each outcome is
recorded.

## 5. Commit and title

Write the title as `CONTRIBUTING.md` requires for titles and commits, including
its breaking-change marker. For an adoption run, name the selected source
version and CLI from the record's Selection table. Commit the work with the
title as the commit subject. For an adoption run, stage the record's changed
paths and `.repo-standards/`, and nothing else.

Done when `git status` shows no part of the work left uncommitted.

## 6. Describe

Write the description with the template's sections in its order, as the pull
request rules require: the problem and resulting change, each check you ran with
its outcome, and the issue link or small-correction reason. Add Limits last
only when relevant, and explain a breaking change's impact and migration.

For an adoption run, the description is the `status --summary` output
unchanged, starting with its `# Repository Standards adoption record` heading.

Done when every template section is present in order and the Validation section
lists only checks that actually ran.

## 7. Open and report

Push the branch and open the pull request against the default branch with the
title and description. For an adoption run, post the step 4 outcomes as one
pull request comment, because the record leaves them out.

Wait for the pull request's checks to finish, for example with
`gh pr checks <number> --watch`. Report to the maintainer:

- the pull request URL and title;
- each local check and its outcome;
- each pull request check and its outcome, naming any failure with its details.

Done when every pull request check has a final outcome and the report states
each one as observed.
