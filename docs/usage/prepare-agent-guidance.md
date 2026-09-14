# Prepare existing agent guidance

Repo Canon owns `AGENTS.md` and the shared `docs/agents/README.md`, `domain.md`,
`issue-tracker.md`, and `triage-labels.md` files as exact content. An adopting
repository can keep its own agent instructions in `docs/agents/project.md`,
which the shared `AGENTS.md` tells agents to read. Prepare that file in a
separate committed change before starting adoption.

## Review the existing instructions

From a clean checkout, read the existing `AGENTS.md` and any files it links.
Classify each instruction before editing:

- Keep repository-specific facts and constraints, such as required tools,
  generated-file rules, local architecture boundaries, and extra validation.
- Leave setup and development commands in `docs/development/README.md`; link
  that guide from project guidance when an agent-specific reminder is useful.
- Do not copy instructions already supplied by the proposed shared files.
- Stop when an existing instruction conflicts with the proposed contribution
  or agent workflow. Resolve the contradiction with the maintainer before
  preparing for adoption; do not choose one instruction silently.

Inspect the proposed exact files together with the current files. During source
development they are available under `drafts/`; an adoption inspection presents
the exact proposed content before any write.

## Reconcile and commit

If useful repository-specific instructions remain, create or update
`docs/agents/project.md`. Preserve their meaning, remove duplication, and keep
links relative to that file. If there are no such instructions, do not create
the file.

Review the preparation as an ordinary project change. At minimum, inspect the
diff, verify local links, run the repository's required validation, and commit
through its normal workflow. For example:

```sh
git diff --check
git diff -- AGENTS.md docs/agents/project.md docs/development/README.md
git status --short
git add docs/agents/project.md
git commit -m "docs: preserve project agent guidance"
```

Adjust the staged paths when the reconciliation also updates existing project
documentation. Do not replace `AGENTS.md` in this preparation commit; adoption
installs the reviewed exact file later.

## Inspect again before adoption

Start a fresh Repo Canon inspection from the preparation commit. Re-read the
current and proposed agent files and confirm that:

- every useful project instruction has a clear surviving location;
- the proposed exact files contain no unresolved contradiction with project
  guidance;
- `docs/agents/project.md` is absent when there is no project-specific content;
  and
- the worktree is clean, so the inspection describes the committed repository.

If the preparation changes after inspection, discard that inspection and run a
new one. Copying the shared files manually is not evidence of adoption, and
this preparation does not configure GitHub settings.
