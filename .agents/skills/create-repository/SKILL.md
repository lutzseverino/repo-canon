---
name: create-repository
description: Interview the maintainer and create a repository, optionally adopt repository standards, then route its vision to a small design interview or a planning map.
disable-model-invocation: false
---

A prompt or brief naming this skill is its invocation.

Own the founding interview and creation. Delegate adoption to the separately
installed `adopt-repository-standards` skill; delegate vision to `grill-with-docs`
or `wayfinder`. Check the chosen route's dependencies before invoking it. The
small route needs `grill-with-docs`, `grilling` and `domain-modeling`; Wayfinder
also needs `research` and `prototype`. If a required skill is missing, report
its name and pause that step for installation, retaining the completed work.

## Interview

Ask one question at a time, proposing an answer from what the person has said
and waiting for confirmation. Where there is no basis for a proposal, ask for
the value; invent no namespace, visibility, location or license. Reuse supplied
answers. If the interview shows the work belongs in an existing repository or
needs no repository, stop before creating anything.

Settle these in order:

1. Repository name and one-line purpose.
2. Hosting namespace and visibility, unless the person chose local-only. If no
   authenticated hosting-platform tool or credential is supplied, explain the
   local fallback and skip remote questions that cannot be used.
3. Parent directory. Resolve the proposed destination and check it and its
   existing ancestors with Git, including linked worktrees and bare repositories.
   Refuse a destination inside an existing Git work tree. Propose the current
   directory as the parent only when it is outside every Git work tree, and
   have the person confirm it. Use a new empty destination; preserve existing
   content.
4. License, including “none for now.” Keep the answer for adoption's contextual
   work; this skill never chooses one or creates a license on the non-adoption
   path.
5. Whether to adopt repository standards. When invoked with adoption on (as
   `create-adopted-repo` does), keep it on and skip this question.
6. Vision size: propose the small interview if it fits one agent session, or
   Wayfinder if it needs more than one agent session. Ask the person to confirm
   that route, or to skip vision entirely.

## Found

Initialize the local repository on its default branch, using the supplied
platform or Git configuration; ask if the branch cannot be established.
Make the founding commit directly there with **only `README.md`, containing
the confirmed name and one-line purpose**. Verify the tree is clean.

For remote creation, use the hosting platform's own supplied authenticated
tool with the confirmed namespace, name and visibility, then connect the local
repository and push the founding commit. Use an empty remote so it introduces
no extra founding files. This step needs no repository-creation abstraction.
When the tool or credential is absent, or local-only was chosen, finish this
step locally. Report the path and explain the later steps: create an empty
remote with the intended namespace/visibility, add its URL as a Git remote,
then push the default branch and any deliverable branches.

## Adopt, when enabled

For remote GitHub project adoption, first have the owner establish the
repository-chosen exact check names in `.github/required-checks.json` on the
destination default branch through the source's owner correction procedure.
This is a separate repository-policy change after the README-only founding
commit, outside the adoption commit and PR; adoption supplies neither this
file nor its names. If it is missing or invalid, stop before adoption, report
that owner action and retain the repository and interview answers for
continuation. A local or proposed declaration cannot satisfy the trusted-default
prerequisite. Local-only and workbench adoption keep their delivery below.

In the new repository, invoke `adopt-repository-standards` from the clean
default branch after any prerequisite policy change. Pass a source only when
the person named one; otherwise keep that skill's Repo Canon default. Let
`adopt` supply its profile descriptions
and questions: standard for a repository no factory serves, factory only for
one served by a host-installed factory, workbench for a workbench. Add no
source or profile selector of your own. Pass the interview's license answer
into contextual work, resolving any remaining license requirement there.

Follow the CLI's printed guidance. Once a run starts, use its pinned runtime
for completion and recovery. Before committing a completed run, preserve the
pinned runtime's `status --summary` output and `status` ready-to-commit verdict.
Deliver one completed run per adoption PR under the new `CONTRIBUTING.md`:
adoption branch, complete adoption record, separate review and squash merge.
The standard profile has no configured PR reviewer by default; follow its
contribution-guide delivery without imposing factory review-agent configuration.
A workbench commits each completed adoption directly on its default branch.

When the first remote project adoption installs the metadata workflow absent
from default, carry its explicit owner-delivery stop through separate review,
including on a private plan without protection or rulesets. Leave the PR open
and stop with the exact reviewed head, saved pre-commit summary and verdict,
validation outcomes, missing prerequisites, required owner action and next
adoption continuation. Distinguish local validation from absent hosted checks.
This handoff grants no alternate merge authority: wait/merge refusals stand,
and owner delivery or correction must be confirmed before continuing below.

For local-only project adoption, commit the completed run on its adoption
branch and leave it ready to push and open its adoption PR once a remote exists. Report
that branch, saved pre-commit evidence, remaining review/merge steps and the
later `adopt` continuation. The workbench direct-commit exception still applies.
Do not try to open a remote PR locally. Retain this adopted tree for vision
work on a separate deliverable branch if needed.

After remote adoption is delivered, return to the clean, updated default
branch and run `adopt` again without a source, as the source's remote-setup
continuation directs. Inspect its actual selection: it may propose a newer
CLI or standards release. This is a fresh full adoption run, not a promise of
remote-settings-only work. Even an unchanged selection can write adoption
bookkeeping; scope and contextual work are assessed again. Complete the run,
apply available remote setup or record the documented deferral, and preserve
its pre-commit pinned summary and verdict before committing any changed files.
Deliver those files as another adoption PR, or a direct workbench commit.
A workbench installs no project remote setup; do not impose it there.

## Vision and handoff

Run the confirmed route in the new repository after creation/adoption:

- **Small:** invoke `grill-with-docs`, composing `grilling` and `domain-modeling`.
  Create domain documents only when the method warrants them. Before editing,
  use an owned branch in an owned checkout; deliver under `CONTRIBUTING.md`.
  Without that guide, leave edits on the method's own branch. For adopted
  local-only work, leave the deliverable branch and report push/PR steps and
  its dependency on the pending adoption branch.
- **Large:** invoke `wayfinder` in **chart the map** mode with the repository's
  tracker. Use local-markdown for local-only work or when none is supplied.
  Preserve Wayfinder's earlier no-fog stop when no map is warranted. Stop after
  charting, including its research launches; report the map's name/link and how
  to resume it with Wayfinder. Do not work through the map.
- **Skip:** finish with the repository path and remaining work.

Always report local path, remote URL when created, delivered or pending branches
and PRs, adoption/remote-setup deferrals and their continuation, and the vision
outcome. Keep the founding, adoption and vision deliverables distinct.

## Reads

Paths are relative to the new repository root.

- `README.md`: the founding name and purpose. When missing in the new empty
  repository, create it for the founding commit.
- `CONTRIBUTING.md`: adoption and domain-document delivery. When missing before
  adoption, let adoption install it; without adoption, leave vision edits on
  their own branch as `domain-modeling` directs.
- `.github/required-checks.json`: repository-owned check names for remote
  GitHub project adoption. When missing or invalid, retain the created
  repository and hand the separate default-branch policy change to the owner
  before adoption; local-only and workbench delivery need no remote prerequisite.
- The pinned CLI runtime and adoption state under `.repo-standards/`, including
  the `status --summary` adoption record: completion, recovery and pre-commit
  evidence. When missing before adoption, let `adopt-repository-standards` start
  the run; when a runtime needs restoring, follow the CLI's recovery guidance.
- `docs/agents/issue-tracker.md`: the tracker for Wayfinder. When missing and
  none is supplied, use local-markdown; local-only work always uses it.

Dependencies are installed skills, not files copied from another checkout:
`adopt-repository-standards` only for adoption; `grill-with-docs`, `grilling` and
`domain-modeling` for small vision; `wayfinder`, those small-route skills,
`research` and `prototype` for large vision. Each method owns its further Reads
and missing-input fallbacks. Hosting tools and tracker/subagent capabilities
are supplied by the session; honor each invoked command's standalone limits.
