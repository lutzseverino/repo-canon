# Issue tracker

Work is tracked in GitHub Issues. Infer the repository from the Git remote and
use authenticated `gh` operations. Resolve ambiguous remotes before making a
change. GitHub shares issue and PR numbers; identify the artifact before acting.

The issue, implementation contract, readiness, and pull request rules are in
`CONTRIBUTING.md`.

## Reading and writing

When reviewing a PR, read its description and diff. For multiline issue, PR,
and comment bodies, write the exact text to a file and pass it with
`--body-file`.

## Dependencies and planning

Use GitHub's native parent/sub-issue relationships and blocking dependencies
when available. Native dependencies use the blocker's database ID; distinguish
it from the visible issue number. When these interfaces are unavailable, keep
explicit parent and blocker links in the issue body.

For Wayfinder, retain its map and child-ticket formats. Link children to their
map, preserve the relevant planning labels, and follow the skill's frontier,
claiming, and resolution procedure. The four public intake/ticket templates do
not replace the formats of the installed planning workflow.

## Pull requests

**PRs as a request surface: no.** External PRs are reviewed as proposed changes;
they do not automatically enter issue triage as feature requests.
