# Skill exercises

This procedure exercises the pinned skills under `vendor/mattpocock-skills`
against disposable local Git repositories. Run it when a release changes a
skill, as the [release procedure](release.md#when-selected-bytes-change)
requires, for the changed skills. Three builders create the repositories: one
each for the engineering, productivity, and planning skills, which together
cover all 17 pinned workflow skills. Repo Canon's own `babysit` skill acts on a live pull request, so no builder covers it; exercise
it on a pull request in a disposable GitHub repository. Its wait script has
its own fixtures, which the [development guide](README.md) names.

Building and testing the fixtures is a prerequisite, not an exercise. An
exercise is an agent session that invokes the skill in a fixture repository
and produces an observed outcome.

## Common harness

The builders need only Node.js 24 or 26 and Git. The agent harness is a prerequisite
of the exercise, not of the builders, and no builder calls it. Run every
command from the Repo Canon root.

Each builder creates its repositories under a new temporary directory, or under
`--root <path>`, which must not exist yet. Each repository has real Git history,
the exact shared `AGENTS.md`, `CONTRIBUTING.md`, and `docs/agents`
configuration, scenario-specific project guidance in `docs/agents/project.md`,
and repository-scoped `.agents/skills` symbolic links to the complete
skill directories it needs. The repositories set `commit.gpgsign=false` in
repository-local configuration and have no remote.

Each builder's manifest maps every repository to its skills and records the
source `HEAD`, the SHA-256 of the builder, the shared fixture-authoring module,
and every copied file, and a digest of every linked skill directory. The digest
format is `repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1`:
traverse directories depth first, sort each directory's entries with JavaScript
`localeCompare`, and append each slash-normalized relative path, NUL, file
bytes, and NUL to the SHA-256 stream. These values identify the bytes actually
used even when the source worktree has uncommitted changes.

Run one session per scenario, with the fixture repository as its working
directory:

- Require the agent to read the exact repository-scoped `SKILL.md` before it
  acts.
- Prohibit remote contact: no issue, branch, release, adoption, setting,
  variable, secret, or message is published.
- Relax the harness sandbox, if at all, only inside the disposable repository.
  A sandbox that mounts `.git` read-only blocks the commits that the debugging,
  TDD, and planning scenarios make.

For example, with Codex CLI:

```bash
codex exec --json -c 'model_reasoning_effort="high"' \
  -C <fixture-repository> <scenario-prompt>
```

A scenario establishes only the path it exercises, not every behavior of the
skill. Report each outcome in the pull request that needs it, such as the
release pull request. Session output, transcripts, and produced artifacts are
not committed.

## Engineering skills

```bash
node scripts/create-engineering-skill-fixtures.mjs
npm run test:engineering-skill-fixtures
```

The builder prints its JSON manifest. Five repositories exercise seven
engineering skills: `review` for `code-review`; `architecture` for
`codebase-design` and `improve-codebase-architecture`; `debugging` for
`diagnosing-bugs`; `modeling-research` for `domain-modeling` and `research`;
and `tdd`. The scenarios supply a domain glossary,
applicable ADRs with their indexes, contributor commands, source, tests, requests, and
specifications.

The research exercise needs web search, such as Codex CLI's `--search` option.
Opening the architecture report needs a browser; in a headless harness, render
it with a local headless browser and inspect the result.

The test verifies the shared and scenario guidance, domain and development
context, ADR indexes, skill links and digests, the review specification, a
build from a Repo Canon checkout without an `origin` remote, and an ordinary later
commit under a host that requires signing with an unusable program.

## Productivity skills

```bash
node scripts/create-productivity-skill-fixtures.mjs
npm run test:productivity-skill-fixtures
```

The builder prints a `repo-canon/productivity-skill-fixtures/v1` manifest. Each
of the two skills has its own repository: `grilling` and `writing-for-agents`.
The root
`AGENTS.md` is byte-for-byte the shared guidance, and the scenario constraints
live in `docs/agents/project.md`; the `writing-for-agents` exercise edits that
file.

`grilling` needs a participant. Supply the participant's turns as explicit
controlled inputs, and do not present them as a real user or approver. It must
delegate repository fact-finding to a read-only sub-agent; facts gathered by the
primary agent do not exercise it.

The test verifies the exact shared guidance, the scenario prerequisites, intact
skill links, disabled local signing, a clean initial Git state, and an ordinary
later commit under hostile global signing.

## Planning skills and project-agent-guidance contextual work

```bash
node scripts/create-planning-skill-fixtures.mjs
npm run test:planning-skill-fixtures
```

The builder writes `manifest.json` under its root and prints that path. Four
repositories cover eight skills: `project-agent-guidance`, which links no skill,
supplies existing project-specific `AGENTS.md` instructions for the
`project-agent-guidance` contextual work described in
[adoption compatibility](adoption-compatibility.md#preserving-project-instructions);
`planning` for `grill-with-docs`, `to-spec`, and `to-tickets`;
`triage-wayfinder` for `triage` and `wayfinder`; and `delivery` for
`implement`, `pr`, and `prototype`. The latter
includes a local specification and child ticket for the ticket exercise, plus before-and-after evidence for a local PR body draft. The manifest also records the
support skills that exercised skills depend on, such as the productivity
`grilling` skill that `grill-with-docs` uses.

The repositories use a local Markdown tracker. It cannot supply GitHub
permissions, issue-event IDs, or native relationships; the
[issue contract fixtures](issue-contract-validation.md) cover those.

The test verifies every repository and skill link, the manifest identities,
local signing, an ordinary later commit under hostile global signing, and the
managed-update boundary: a synthetic change to a candidate copy of a vendored
skill is detected while the vendored directory stays unchanged.
