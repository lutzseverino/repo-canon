# Upstream skill compatibility

The managed snapshot is mattpocock/skills tag `v1.3.1`, commit
`24fe0ef7737efae15c87225755e9f6f5965e4888`. Its promoted plugin set contains 27
regular skills. Repo Canon declares the 17 of them that are workflow skills, as
[ADR 0018](../adr/0018-install-only-workflow-skills.md) decides, and vendors
only their complete directories under `vendor/mattpocock-skills/skills`, plus
the setup seeds that the skill setup files are installed from, as
[ADR 0008](../adr/0008-install-skill-setup-files-verbatim-from-upstream-seeds.md)
decides. The upstream MIT notice is retained at
`vendor/mattpocock-skills/LICENSE` and installed beside the copied skills as
`.agents/skills/LICENSE.mattpocock-skills`. `implement-spec` is not vendored,
because every factory run is a direct run, as
[ADR 0012](../adr/0012-run-each-ticket-as-its-own-factory-run.md) decides.
Repo Canon configuration adapts conventions without editing upstream skill
content.

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
included. The vendored snapshot contains 55 files: the 17 complete skill
directories, the five setup seeds, the retained `LICENSE`, and the plugin
manifest, retained at `vendor/mattpocock-skills/.claude-plugin/plugin.json` as
provenance. Every vendored byte, including referenced templates, scripts, agent
metadata, and supporting Markdown, matches the pinned commit.

Concrete local links from `SKILL.md` files resolve within their complete skill
directories. The declared skills invoke only other declared skills, apart from
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
productivity/grilling productivity/writing-for-agents'
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
diff -ru "$expected_snapshot" vendor/mattpocock-skills
```

## Standards-maintainer updates

Managed skills change only through a reviewed Repo Canon standards update. An
adopting repository's contributors do not update these files independently.
For a proposed upstream pin, a standards maintainer checks out that exact
commit, reviews the plugin manifest and the complete diff from the current pin,
decides whether a new or changed promoted skill is a workflow skill under
[ADR 0018](../adr/0018-install-only-workflow-skills.md), and stages only the
declared skill directories, the setup seeds, `LICENSE`, and
`.claude-plugin/plugin.json`. The staging commands reuse the `skills`, `seeds`,
and `setup` lists from the byte comparison above, amended for the reviewed
selection:

```bash
set -eu
proposed_commit=replace-with-reviewed-full-commit-sha
next_upstream_checkout="$(mktemp -d)"
git clone https://github.com/mattpocock/skills.git "$next_upstream_checkout"
git -C "$next_upstream_checkout" checkout --detach "$proposed_commit"
git -C "$next_upstream_checkout" diff \
  "24fe0ef7737efae15c87225755e9f6f5965e4888..$proposed_commit" -- \
  .claude-plugin/plugin.json LICENSE skills

git rm -r vendor/mattpocock-skills
mkdir -p vendor/mattpocock-skills/skills/engineering \
  vendor/mattpocock-skills/skills/productivity \
  "vendor/mattpocock-skills/$setup"
cp "$next_upstream_checkout/LICENSE" vendor/mattpocock-skills/LICENSE
mkdir -p vendor/mattpocock-skills/.claude-plugin
cp "$next_upstream_checkout/.claude-plugin/plugin.json" vendor/mattpocock-skills/.claude-plugin/plugin.json
for skill in $skills; do
  category="${skill%%/*}"
  name="${skill#*/}"
  cp -R "$next_upstream_checkout/skills/$skill" \
    "vendor/mattpocock-skills/skills/$category/$name"
done
for seed in $seeds; do
  cp "$next_upstream_checkout/$setup/$seed" "vendor/mattpocock-skills/$setup/$seed"
done
git add vendor/mattpocock-skills
```

After replacing the selected directories and notice, reconcile every
authoritative pin, inventory, and skill-count reference. This includes at least
`authoring-notes.md`, this compatibility record, and
`docs/development/adoption-compatibility.md`; locate further references with:

```bash
rg -n '24fe0ef7737efae15c87225755e9f6f5965e4888|all 27|27 (managed|promoted|regular|skill)|17 (declared|workflow)|55 files|20 engineering|seven productivity' \
  authoring-notes.md docs
```

Update the tag, commit, and per-file SHA-256 values in
`test/fixtures/mattpocock-v1.3.1.json` from the independent upstream checkout,
renaming the fixture and its test reference for a new tag. The fixture records
every promoted file, vendored or not. The repository conformance suite compares
the declared skills to the workflow skill list, checks that the vendored tree
holds only declared skills and setup seeds and that every vendored byte matches
those digests, checks that installed skills' routes to undeclared skills are
dormant or overridden, and compares the installed setup files to their seeds.
The manifest is provenance, not an installed adopter file.

Rerun the byte comparison with the proposed commit, review all resource
references and runtime prerequisites, and exercise the changed skills through
the [skill exercise procedure](skill-exercises.md). Release review then decides
whether to distribute the new snapshot. Vendored bytes are never edited to adapt
Repo Canon conventions.

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
