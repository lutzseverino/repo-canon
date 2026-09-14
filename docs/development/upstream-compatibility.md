# Matt Pocock workflow compatibility

The managed snapshot is mattpocock/skills commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Its promoted plugin set contains 25
regular skills. Their complete directories are vendored under
`vendor/mattpocock-skills/skills`, with the upstream MIT notice retained at
`vendor/mattpocock-skills/LICENSE`. Repo Canon configuration adapts conventions
without editing upstream skill content.

## Included skills

| Category | Skills |
| --- | --- |
| Engineering | ask-matt, code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, implement, improve-codebase-architecture, prototype, research, resolving-merge-conflicts, setup-matt-pocock-skills, tdd, to-spec, to-tickets, triage, wayfinder, wizard |
| Productivity | grill-me, grilling, handoff, teach, to-questionnaire, wait-what, writing-for-agents |

Experimental skills are excluded; the pinned tree has no top-level
`experimental` skill category. The `in-progress`, `misc`, and `deprecated`
categories are also outside this promoted set. The selected skill files contain
no concrete dependency on any of those exclusions. Harness capabilities such as
subagents, context controls, browser access, and authenticated tracker tools
remain runtime requirements.

Sources: [promoted manifest](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/.claude-plugin/plugin.json),
[upstream taxonomy](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/CLAUDE.md).

## Snapshot review and verification

The pinned plugin manifest was reviewed against the inventory above. All 25
promoted regular skills are present, and no experimental skill or skill from the
upstream `in-progress`, `misc`, or `deprecated` categories is included. The
vendored snapshot contains 74 files across the 25 full skill directories. Every
byte in those directories, including referenced templates, scripts, agent
metadata, and supporting Markdown, matches the pinned commit. The retained
`LICENSE` also matches that commit byte for byte.

Concrete local links from `SKILL.md` files resolve within their complete skill
directories. The skills invoke only other selected regular skills. References
to subagents, context controls, browsers, issue-tracker clients, and similar
harness facilities describe runtime prerequisites; they are not missing source
dependencies. This inventory and content review does not exercise any skill.
Tickets #11, #12, and #13 record the separate runtime exercises and their
available or unavailable prerequisites.

Standards maintainers can reproduce the byte comparison from the repository
root. These commands intentionally verify content and do not run the skills:

```bash
set -eu
upstream_checkout="$(mktemp -d)"
git clone https://github.com/mattpocock/skills.git "$upstream_checkout"
git -C "$upstream_checkout" checkout --detach \
  3cca18b368ae95cdbdebbff572ccafa662551015

skills='engineering/ask-matt engineering/code-review engineering/codebase-design
engineering/diagnosing-bugs engineering/domain-modeling engineering/grill-with-docs
engineering/implement engineering/improve-codebase-architecture engineering/prototype
engineering/research engineering/resolving-merge-conflicts
engineering/setup-matt-pocock-skills engineering/tdd engineering/to-spec
engineering/to-tickets engineering/triage engineering/wayfinder engineering/wizard
productivity/grill-me productivity/grilling productivity/handoff productivity/teach
productivity/to-questionnaire productivity/wait-what productivity/writing-for-agents'

expected_snapshot="$(mktemp -d)"
mkdir -p "$expected_snapshot/skills/engineering" \
  "$expected_snapshot/skills/productivity"
cp "$upstream_checkout/LICENSE" "$expected_snapshot/LICENSE"
for skill in $skills; do
  category="${skill%%/*}"
  name="${skill#*/}"
  cp -R "$upstream_checkout/skills/$skill" \
    "$expected_snapshot/skills/$category/$name"
done
diff -ru "$expected_snapshot" vendor/mattpocock-skills
```

## Standards-maintainer updates

Managed skills change only through a reviewed Repo Canon standards update. An
adopting repository's contributors do not update these files independently.
For a proposed upstream pin, a standards maintainer checks out that exact
commit, reviews the plugin manifest and the complete diff from the current pin,
and stages only the promoted engineering and productivity directories plus
`LICENSE`. The manifest-reading command uses the project's Node.js 24 authoring
baseline; that maintainer prerequisite is separate from skill runtime:

```bash
set -eu
proposed_commit=replace-with-reviewed-full-commit-sha
next_upstream_checkout="$(mktemp -d)"
git clone https://github.com/mattpocock/skills.git "$next_upstream_checkout"
git -C "$next_upstream_checkout" checkout --detach "$proposed_commit"
git -C "$next_upstream_checkout" diff \
  "3cca18b368ae95cdbdebbff572ccafa662551015..$proposed_commit" -- \
  .claude-plugin/plugin.json LICENSE skills

skills="$(node -e '
const manifest = require(process.argv[1]);
const selected = manifest.skills.map((entry) => {
  const match = entry.match(/^\.\/skills\/(engineering|productivity)\/([a-z0-9-]+)$/);
  if (!match) throw new Error(`unexpected promoted skill path: ${entry}`);
  return `${match[1]}/${match[2]}`;
});
if (new Set(selected).size !== selected.length) {
  throw new Error("duplicate promoted skill path");
}
process.stdout.write(selected.join("\n"));
' "$next_upstream_checkout/.claude-plugin/plugin.json")"
git rm -r vendor/mattpocock-skills
mkdir -p vendor/mattpocock-skills/skills/engineering \
  vendor/mattpocock-skills/skills/productivity
cp "$next_upstream_checkout/LICENSE" vendor/mattpocock-skills/LICENSE
for skill in $skills; do
  category="${skill%%/*}"
  name="${skill#*/}"
  cp -R "$next_upstream_checkout/skills/$skill" \
    "vendor/mattpocock-skills/skills/$category/$name"
done
git add vendor/mattpocock-skills
```

After replacing the 25 selected directories and notice, update the pin and
inventory in this document, rerun the byte comparison with the proposed commit,
review all resource references and runtime prerequisites, and record skill
exercises separately. Release review then decides whether to distribute the new
snapshot.

## Native issue shapes

The four public templates do not prohibit the installed skills' native issue
formats. Validation must recognize the applicable contract and workflow.

| Shape | Required structure and readiness meaning |
| --- | --- |
| Native specification | Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes. to-spec can publish a reviewed specification ready-for-agent without intake triage or a brief. |
| Native implementation ticket | Optional Parent, What to build, Acceptance criteria, Blocked by. to-tickets can publish reviewed tickets ready-for-agent even when blockers remain open. |
| Triaged request | Agent Brief comment with Category, Summary, Current behavior, Desired behavior, Key interfaces, Acceptance criteria, Out of scope; original body/discussion is intake context. |
| Wayfinder map | Destination, Notes, Decisions so far, Not yet specified, Out of scope. An initially empty decisions section is valid; label wayfinder:map. |
| Wayfinder child | Question; one wayfinder research/prototype/grilling/task label. Eligibility uses open state, assignment, and blockers rather than requiring intake labels or a brief. |

Recognize GitHub form heading levels and harmless casing differences. Optional
unanswered fields are not missing required content. Native parent/dependency
relationships can carry information outside the body.

The shared brief-approval and revision-invalidation convention is this author's
addition. Upstream has no approved-revision selector or immutable approval
marker. Do not treat matching a heading, an AI preamble, or passing structural
validation as proof of human approval or authorization.

Sources: [to-spec](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/to-spec/SKILL.md),
[to-tickets](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/to-tickets/SKILL.md),
[triage](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/triage/SKILL.md),
[wayfinder](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/wayfinder/SKILL.md).

## Shared instructions and configuration

Upstream setup provides a reusable Agent skills section, not the complete
shared AGENTS.md chosen here. It ordinarily preserves surrounding repository
instructions. The author's whole-file ownership choice therefore uses the
separate preparation workflow recorded in the adoption compatibility audit.

The GitHub seed infers repository identity from remotes. Domain conventions
support lazy glossaries and ADRs, including multiple contexts. Triage supplies
five canonical states, while the complete workflow also uses bug, enhancement,
and five Wayfinder planning labels. Writing these configuration files does not
provision those labels on GitHub.

Source: [setup](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/engineering/setup-matt-pocock-skills/SKILL.md).
