# Upstream skill compatibility

The upstream base snapshot is mattpocock/skills tag `v1.3.1`, commit
`24fe0ef7737efae15c87225755e9f6f5965e4888`. Its promoted plugin set contains 27
regular skills. Repo Canon installs the 17 of them that are workflow skills, as
[ADR 0018](../adr/0018-install-only-workflow-skills.md) decides, together with
its own `babysit` and `orchestrate`. Every workflow skill is an owned skill, as
[ADR 0028](../adr/0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md)
decides: adoption installs it from the owned tree, `.agents/skills/<name>` in
this repository, and never from the vendored snapshot. The snapshot under
`vendor/mattpocock-skills` holds, unedited, the upstream base of each owned
skill taken from upstream and the setup seeds that the owned skill setup files
take as their bases. The upstream MIT notice is retained at
`vendor/mattpocock-skills/LICENSE` and installed beside the owned skills as
`.agents/skills/LICENSE.mattpocock-skills`. `implement-spec` is not vendored,
because every factory run is a direct run, as
[ADR 0012](../adr/0012-run-each-ticket-as-its-own-factory-run.md) decides.

## Owned skills and their upstream bases

Each owned skill's `CREDITS.md` says where it comes from. A skill written for
Repo Canon, `babysit` or `orchestrate`, says that it was written for Repo
Canon and has no upstream base. A skill taken from upstream names its base in
one sentence of this form, with the tree link at the same commit and path:

```markdown
Its upstream base is tag `v1.3.1`, commit `24fe0ef7737efae15c87225755e9f6f5965e4888`, at [`skills/engineering/tdd`](https://github.com/mattpocock/skills/tree/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/tdd).
```

It then says either that the skill is identical to its upstream base or that
it differs from its upstream base, and how. The comparison covers every file
of the skill except `CREDITS.md`. When the base has its own `CREDITS.md`, as
`pr`'s does for the HumanLayer material, the owned `CREDITS.md` keeps that
text word for word. Sixteen of these skills are identical to their bases;
`triage` differs, as its `CREDITS.md` describes.

The skill setup files `docs/agents/domain.md`, `docs/agents/issue-tracker.md`
and `docs/agents/triage-labels.md` are owned files installed from themselves.
Adopters' `docs/agents/` has no place for a `CREDITS.md` beside each one, so
`setup-file-bases.json` at the repository root records their bases: for each
path, its `upstream` repository, tag, commit and seed path, and `edits`, which
is `null` while the file is identical to its base and otherwise summarizes how
it differs. All three are identical to their seeds. The snapshot's own
`UPSTREAM.json` records its repository, tag and commit; it is Repo Canon's
provenance record, not an upstream file.

`node scripts/upstream-bases.mjs check` fails, naming each problem, when a
skill installs from anywhere but the owned tree, a setup file installs from
anywhere but itself, an owned skill lacks its `CREDITS.md`, a recorded base
differs from the snapshot's `UPSTREAM.json` or is missing from the snapshot, a
file identical to its base claims edits, a file that differs claims none, a
setup file's `edits` is neither `null` nor a summary, a skill declaration does
not read as `kind`, `name` and `source` in that order, or upstream's own
credits are dropped. `test/upstream-bases.test.mjs` runs it on
this repository and on disposable copies that break each rule.

## Vendored skills

| Category     | Skills                                                                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineering  | code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, implement, improve-codebase-architecture, pr, prototype, research, tdd, to-spec, to-tickets, triage, wayfinder |
| Productivity | grilling, writing-for-agents                                                                                                                                                                    |
| Setup seeds  | `domain.md`, `issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`, and `triage-labels.md` from `setup-matt-pocock-skills`, without its `SKILL.md` or metadata         |

The undeclared promoted skills are left out: `ask-matt`, `grill-me`, and
`setup-matt-pocock-skills` only set up or route the others, `implement-spec`
builds a whole specification in one run, and `teach`, `to-questionnaire`,
`wait-what`, `handoff`, `retro`, and `wizard` are personal skills that the
[adoption guide](../usage/adopt-repo-canon.md#recommended-personal-skills)
recommends installing at user scope.

Experimental skills are excluded; the pinned tree has no top-level
`experimental` skill category. The `in-progress`, `misc`, and `deprecated`
categories are also outside this promoted set. The selected skill files contain
no concrete dependency on any of those exclusions. Harness capabilities such as
subagents, context controls, browser access, and authenticated tracker tools
remain runtime requirements.

Sources: [promoted manifest](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/.claude-plugin/plugin.json),
[upstream taxonomy](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/CLAUDE.md).

## Snapshot review and verification

The pinned plugin manifest was reviewed against the inventory above. All 27
promoted regular skills are present upstream, and no experimental skill or skill
from the upstream `in-progress`, `misc`, or `deprecated` categories is
included. The vendored snapshot contains 55 upstream files: the 17 complete
skill directories, the five setup seeds, the retained `LICENSE`, and the plugin
manifest, retained at `vendor/mattpocock-skills/.claude-plugin/plugin.json` as
provenance. Every vendored upstream byte, including referenced templates,
scripts, agent metadata, and supporting Markdown, matches the base commit.

Concrete local links from `SKILL.md` files resolve within their complete skill
directories. The owned skills invoke only other declared skills, apart from
routes to `setup-matt-pocock-skills` that fire only when the skill setup files
are missing; the route test lists those as dormant. References to subagents,
context controls, browsers, issue-tracker clients, and similar harness
facilities describe runtime prerequisites; they are not missing source
dependencies. This inventory and content review does not exercise any skill;
the [skill exercise procedure](skill-exercises.md) does.

Standards maintainers can reproduce the byte comparison from the repository
root. These commands intentionally verify content and do not run the skills:

```bash
set -eu
upstream_checkout="$(mktemp -d)"
git clone https://github.com/mattpocock/skills.git "$upstream_checkout"
git -C "$upstream_checkout" checkout --detach \
  24fe0ef7737efae15c87225755e9f6f5965e4888

skills='engineering/code-review engineering/codebase-design
engineering/diagnosing-bugs engineering/domain-modeling engineering/grill-with-docs
engineering/implement engineering/improve-codebase-architecture engineering/pr
engineering/prototype engineering/research engineering/tdd engineering/to-spec
engineering/to-tickets engineering/triage engineering/wayfinder
productivity/grilling
productivity/writing-for-agents'
seeds='domain.md issue-tracker-github.md issue-tracker-gitlab.md
issue-tracker-local.md triage-labels.md'
setup=skills/engineering/setup-matt-pocock-skills

expected_snapshot="$(mktemp -d)"
mkdir -p "$expected_snapshot/skills/engineering" \
  "$expected_snapshot/skills/productivity" "$expected_snapshot/$setup"
cp "$upstream_checkout/LICENSE" "$expected_snapshot/LICENSE"
mkdir -p "$expected_snapshot/.claude-plugin"
cp "$upstream_checkout/.claude-plugin/plugin.json" "$expected_snapshot/.claude-plugin/plugin.json"
for skill in $skills; do
  category="${skill%%/*}"
  name="${skill#*/}"
  cp -R "$upstream_checkout/skills/$skill" \
    "$expected_snapshot/skills/$category/$name"
done
for seed in $seeds; do
  cp "$upstream_checkout/$setup/$seed" "$expected_snapshot/$setup/$seed"
done
diff -ru -x UPSTREAM.json "$expected_snapshot" vendor/mattpocock-skills
```

## Upstream reconciliation

Owned skills and setup files change only through a reviewed Repo Canon
standards release. An adopting repository's contributors do not update them
independently. Repo Canon edits an owned skill whenever its workflow needs it,
and records the change in the skill's `CREDITS.md`.

Each upstream release Repo Canon takes is one reconciliation ticket. A
standards maintainer checks out the release's exact commit, reviews the plugin
manifest and the complete diff from the current base, and decides whether a
new or changed promoted skill is a workflow skill under
[ADR 0018](../adr/0018-install-only-workflow-skills.md). They then stage the
next snapshot outside the checkout, reusing the `skills`, `seeds`, and `setup`
lists from the byte comparison above, amended for the reviewed selection:

```bash
set -eu
proposed_tag=replace-with-reviewed-tag
proposed_commit=replace-with-reviewed-full-commit-sha
next_upstream_checkout="$(mktemp -d)"
git clone https://github.com/mattpocock/skills.git "$next_upstream_checkout"
git -C "$next_upstream_checkout" checkout --detach "$proposed_commit"
git -C "$next_upstream_checkout" diff \
  "24fe0ef7737efae15c87225755e9f6f5965e4888..$proposed_commit" -- \
  .claude-plugin/plugin.json LICENSE skills

next_snapshot="$(mktemp -d)/mattpocock-skills"
mkdir -p "$next_snapshot/skills/engineering" \
  "$next_snapshot/skills/productivity" "$next_snapshot/$setup" \
  "$next_snapshot/.claude-plugin"
cp "$next_upstream_checkout/LICENSE" "$next_snapshot/LICENSE"
cp "$next_upstream_checkout/.claude-plugin/plugin.json" \
  "$next_snapshot/.claude-plugin/plugin.json"
for skill in $skills; do
  category="${skill%%/*}"
  name="${skill#*/}"
  cp -R "$next_upstream_checkout/skills/$skill" \
    "$next_snapshot/skills/$category/$name"
done
for seed in $seeds; do
  cp "$next_upstream_checkout/$setup/$seed" "$next_snapshot/$setup/$seed"
done
printf '{\n  "repository": "https://github.com/mattpocock/skills",\n  "tag": "%s",\n  "commit": "%s"\n}\n' \
  "$proposed_tag" "$proposed_commit" > "$next_snapshot/UPSTREAM.json"
```

Reconcile every owned skill and setup file with the staged snapshot. The
command three-way merges each owned file from its base in
`vendor/mattpocock-skills` to the same path in the staged snapshot with
`git merge-file`. With `--dry-run` it only lists what would change:

```bash
node scripts/upstream-bases.mjs reconcile "$next_snapshot" --dry-run
node scripts/upstream-bases.mjs reconcile "$next_snapshot"
```

Each changed file prints one line: `merged`, `added`, `removed`, or
`conflict` with its reason. `No owned file changes.` means nothing changes. The
command exits `0` when every change merged cleanly, `2` when a conflict
remains, and `1` for invalid arguments or a path that is not a staged snapshot.
A conflicting file holds `<<<<<<< owned` and `>>>>>>> upstream` markers;
resolve each by judgment, keeping what Repo Canon's edit needs and what the
upstream change adds. A change to upstream's own `CREDITS.md`, a file changed
upstream but removed from the owned copy, a base missing from the staged
snapshot, and a recorded base that is not the vendored snapshot are reported
as conflicts to resolve by hand. A dry run against the
current base, `node scripts/upstream-bases.mjs reconcile vendor/mattpocock-skills --dry-run`,
prints `No owned file changes.`; `test/upstream-bases.test.mjs` runs it.

Then replace the base snapshot and record the new base:

```bash
git rm -r --quiet vendor/mattpocock-skills
cp -R "$next_snapshot" vendor/mattpocock-skills
git add vendor/mattpocock-skills
```

Update each upstream-derived `CREDITS.md` to the new tag, commit and tree link,
and its statement of whether the skill differs from its base and how. Update
`setup-file-bases.json` the same way, then run
`node scripts/upstream-bases.mjs check`. Reconcile every authoritative base,
inventory, and skill-count reference. This includes at least
`authoring-notes.md`, this compatibility record, and
`docs/development/adoption-compatibility.md`; locate further references with:

```bash
rg -n '24fe0ef7737efae15c87225755e9f6f5965e4888|all 27|27 (managed|promoted|regular|skill)|1[67] (declared|workflow)|55 upstream files|20 engineering|seven productivity' \
  authoring-notes.md docs .agents/skills/*/CREDITS.md setup-file-bases.json
```

Update the tag, commit, and per-file SHA-256 values in
`test/fixtures/mattpocock-v1.3.1.json` from the independent upstream checkout,
renaming the fixture and its test reference for a new tag. The fixture records
every promoted file, vendored or not. The repository conformance suite compares
the declared skills to the workflow skill list, checks that the vendored tree
holds only owned skills' bases and setup seeds, that every vendored upstream
byte matches those digests and that `UPSTREAM.json` names the same tag and
commit, and checks that installed skills' routes to undeclared skills are
dormant or overridden. The manifest is provenance, not an installed adopter
file.

Rerun the byte comparison with the proposed commit, review all resource
references and runtime prerequisites, and exercise the changed skills through
the [skill exercise procedure](skill-exercises.md). Release review then decides
whether to distribute the reconciled skills. Vendored bytes are never edited to
adapt Repo Canon conventions; the owned copies carry them.

## Native issue shapes

The four public templates do not prohibit the installed skills' native issue
formats. Validation must recognize the applicable contract and workflow.

| Shape                        | Required structure and readiness meaning                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native specification         | Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes. to-spec can publish a reviewed specification ready-for-agent without intake triage or a brief. |
| Native implementation ticket | Optional Parent, What to build, Acceptance criteria, Blocked by. to-tickets can publish reviewed tickets ready-for-agent even when blockers remain open.                                                            |
| Triaged request              | Agent Brief comment with Category, Summary, Current behavior, Desired behavior, Key interfaces, Acceptance criteria, Out of scope; original body/discussion is intake context.                                      |
| Wayfinder map                | Destination, Notes, Decisions so far, Not yet specified, Out of scope. An initially empty decisions section is valid; label wayfinder:map.                                                                          |
| Wayfinder child              | Question; one wayfinder research/prototype/grilling/task label. Eligibility uses open state, assignment, and blockers rather than requiring intake labels or a brief.                                               |

The `github-repository-configuration` rules state the Agent Brief and
Wayfinder shapes the validator enforces, citing `triage` and `wayfinder` as
methods. Recognize GitHub form heading levels and harmless casing differences. Optional
unanswered fields are not missing required content. Native parent/dependency
relationships can carry information outside the body.

The shared brief-approval and revision-invalidation convention is this author's
addition. Upstream has no approved-revision selector or immutable approval
marker. Do not treat matching a heading, an AI preamble, or passing structural
validation as proof of human approval or authorization.

Sources: [to-spec](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/to-spec/SKILL.md),
[to-tickets](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/to-tickets/SKILL.md),
[triage](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/triage/SKILL.md),
[wayfinder](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/wayfinder/SKILL.md).

## Shared instructions and configuration

Upstream setup provides a reusable Agent skills section, not the complete
shared AGENTS.md chosen here. It ordinarily preserves surrounding repository
instructions. The author's whole-file ownership choice therefore relies on the
`project-agent-guidance` contextual declaration described in
[adoption compatibility](adoption-compatibility.md#preserving-project-instructions).

The GitHub seed infers repository identity from remotes. Domain conventions
support lazy glossaries and ADRs, including multiple contexts. Triage supplies
five canonical states, while the complete workflow also uses bug, enhancement,
and five Wayfinder planning labels. Writing these configuration files does not
provision those labels on GitHub.

Source: [setup](https://github.com/mattpocock/skills/blob/24fe0ef7737efae15c87225755e9f6f5965e4888/skills/engineering/setup-matt-pocock-skills/SKILL.md).
