# Matt Pocock workflow compatibility

The reference is mattpocock/skills commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Its promoted plugin set contains 25
regular skills. Preserve full skill directories and upstream attribution when
the source is authored; the draft configuration adapts conventions without
editing upstream skills.

## Included skills

| Category | Skills |
| --- | --- |
| Engineering | ask-matt, code-review, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, implement, improve-codebase-architecture, prototype, research, resolving-merge-conflicts, setup-matt-pocock-skills, tdd, to-spec, to-tickets, triage, wayfinder, wizard |
| Productivity | grill-me, grilling, handoff, teach, to-questionnaire, wait-what, writing-for-agents |

The in-progress, misc, and deprecated categories are outside this promoted set.
The selected skill files contain no concrete dependency on those excluded
categories. Harness capabilities such as subagents, context controls, browser
access, and authenticated tracker tools remain runtime requirements.

Sources: [promoted manifest](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/.claude-plugin/plugin.json),
[upstream taxonomy](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/CLAUDE.md).

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
