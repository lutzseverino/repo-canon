# Shared material review

This record covers the contribution and agent workflow material finalized for
[issue #2](https://github.com/lutzseverino/repo-canon/issues/2). The review used
the accepted parent contract, the two repository ADRs, the authoring notes, and
the pinned upstream compatibility audit.

## Reviewed material

The review covered these exact-owned files and their copies under `drafts/`:

- `AGENTS.md` and `CONTRIBUTING.md`;
- `docs/agents/README.md`, `domain.md`, `issue-tracker.md`, and
  `triage-labels.md`;
- the bug report, feature request, specification, and implementation-ticket
  issue forms; and
- `.github/PULL_REQUEST_TEMPLATE.md`.

The final exact files and review copies are byte-identical. Project-owned
`docs/agents/project.md` and `docs/development/README.md` remain outside that
set. The shared material keeps the small-correction exception, Conventional
Commit and squash rules, full Agent Brief convention, contract revision
invalidation, native specification and ticket behavior, and Wayfinder formats.

The four issue forms require only their applicable contract fields. Optional
environment, context, proposed approach, parent, implementation decisions,
testing decisions, and further notes fields remain optional. The public forms
do not replace the native formats produced by the installed planning skills.
The pull request template requests meaningful Summary, Validation, and issue or
small-correction context while making Limits conditional. The dependent PR
validation ticket enforces those fields.

## Structural checks

The following commands were run from the repository root:

```sh
git diff --check

for path in \
  AGENTS.md \
  CONTRIBUTING.md \
  docs/agents/README.md \
  docs/agents/domain.md \
  docs/agents/issue-tracker.md \
  docs/agents/triage-labels.md \
  .github/PULL_REQUEST_TEMPLATE.md \
  .github/ISSUE_TEMPLATE/bug-report.yml \
  .github/ISSUE_TEMPLATE/feature-request.yml \
  .github/ISSUE_TEMPLATE/specification.yml \
  .github/ISSUE_TEMPLATE/implementation-ticket.yml
do
  cmp "$path" "drafts/$path"
done

python3 /tmp/validate-issue2.py "$PWD"
```

The comparison passed for every file. An authoring check using Python 3.14.4
and PyYAML 6.0.3 parsed all four forms, required a unique nonempty ID for every
field, verified the intended required/optional field sets and default labels,
and confirmed that the template inventory contains exactly the four reviewed
forms. A separate local Markdown-link check resolved repository-relative links
in the reviewed material and its documentation; all targets exist. Draft links
were checked through their byte-identical destination files because draft
paths describe the installed layout.

## Preparation exercises

The [preparation procedure](../usage/prepare-agent-guidance.md) was exercised in
three temporary Git repositories. Each fixture began from a committed existing
state and was inspected again after the preparation attempt.

| Fixture | Existing instructions | Observable result |
| --- | --- | --- |
| Useful project guidance | Required `pnpm test` from the repository root and prohibited manual edits to generated migrations. | Both instructions were reconciled into `docs/agents/project.md`, committed separately, and remained present after a simulated exact `AGENTS.md` replacement. A fresh inspection saw a clean preparation commit. |
| Contradiction | Directed agents to merge behavior changes without an issue, contrary to `CONTRIBUTING.md`. | Preparation stopped before staging or replacing files. The repository stayed at its original commit and no project-guidance file was created. |
| No project guidance | Contained only instructions supplied by the proposed exact files. | Review found nothing repository-specific, so the preparation produced no commit and did not create an empty `docs/agents/project.md`. |

The temporary check script encoded the exact file inventory and the reviewed
required, optional, and label sets. The fixtures used `git init`, local
fixture-only Git identity, `git add`, `git commit`, `git diff --check`,
`git status --porcelain`, `git show`, `cmp`, and exact string assertions. They
did not submit forms to GitHub or run Repository Standards source validation or
adoption. GitHub metadata automation, the complete v2 source profile, public
CLI inspection, operations, remote settings, and full adoption remain separate
tickets.
