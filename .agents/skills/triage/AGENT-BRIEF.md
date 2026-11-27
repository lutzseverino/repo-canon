# Writing Agent Briefs

Before publication or acceptance, follow [Publication mode](SKILL.md#publication-mode).
For issues, describe the change to build; for PRs, describe what remains to
finish or fix in the existing diff.

## Principles

### Available inputs

Required inputs belong in the repository, issue/comments or public URLs.
Check host material for secrets, publish its non-secret content on the issue,
then cite it. Copy relied-on decisions with dates and quoted words into the
repository-facing record, including private-source decisions; cite repository
records, never a private workbench, host path or instruction, even as provenance.
Independent review verifies availability and rejects private references
substituted for decision content.

### Durability over precision

Describe interfaces, types, function signatures, config shapes and behavioral
contracts that survive renames, moves and refactors while the issue waits in
`state:ready`. Omit file paths, line numbers and assumptions about the current structure.

### Behavioral, not procedural

State what the system should do; leave implementation decisions to the agent.

### Short fields

Summary is one sentence. Current behavior and Desired behavior hold at most
three sentences each. Every list item and acceptance criterion is one sentence.
Link longer material instead of copying it.

### Complete acceptance criteria

Every brief needs concrete, testable, independently verifiable criteria, such
as "`gh issue list --label state:triage` returns classified issues", not "Triage works correctly."

### Progress stays out of the brief

Follow the contribution guide's Implementation contracts: after readiness,
progress belongs in linked PRs, sub-issue states and comments, not brief edits
or checked acceptance boxes.

### Live evidence and split tickets

Apply the contribution guide's Implementation contracts to live evidence:
source acceptance carries it unless the guide's split case needs a blocked
live-acceptance ticket. The source PR links that ticket without closing it;
its readiness follows installed host-access rules.

### Design acceptance criteria

For UI, visual and icon work, add these outcomes for PR review:

- A token plan before building records a small colour set, type roles, layout sketch and design principles.
- A self-review names generic design tells of its own choosing and each verdict.
- Built screens have screenshots and a critique before review.
- Icon work has a vector master judged against a named reference icon of the same family.

These outcomes require no installed design skill.

### Explicit scope boundaries

Name adjacent work that is out of scope.

### Seams

After Out of scope, record **Seams** under
`codebase-design`'s [Ownership check](../codebase-design/OWNERSHIP.md):
`No trigger`, or the triggered read and chosen default or accepted override.
Review assesses honesty, Value owner, consumers, reversibility and cost;
validation checks non-placeholder content only.

### Decisions, not options

Settle intent before acceptance; state decisions as behavior. Route unresolved
questions through [SKILL.md](SKILL.md) under the planning rules' inference test
and Decision rights (the contribution guide when absent).
“Reasonable retry period”, unchosen fallbacks and alternatives leave intent
open; a chosen retry limit needs the owner's dated, quoted decision in notes.
Leave invisible implementation choices to the agent.
For reserved owner review, state the designation as contract behavior and
retain its dated decision source in notes, rather than using a routing label
as provenance. Apply the installed GitHub rules' Designated owner review gate;
installed rules retain merge ownership and continuation.

## Triage notes

Notes follow the brief; earlier fact-finding and decisions use separate notes
comments. Keep notes collapsed under the [template](#template)'s summary with
owner-question/inferred-intent counts and model; show questions and inferred
intent above it when present. Apply installed publication and comment rules
for placement and disclosure. Cover:

- **Path:** code-bound or intent-bound and why.
- **Verification:** reproduction, code paths, tests and redundancy-search locations.
- **Owner decisions:** every relied-on decision, including reserved review, dated and quoted; copy grill decisions and cite repository records.
- **Inferred intent:** each behavioral answer with dated, quoted source and repository citation; copy private-source content without its private reference; factory runs follow the installed Triage run source limits.
- **Dependencies:** issues that must land first, for native blockers.
- **Model:** when required, one `model:` label with the installed Model selection rule's guidance-based reason; a reviewer suggestion, or the factory run's chosen label.
- **Owner questions:** none for a brief ready for review.

## Template

The lead line comes first, as the comment rules' Lead line section says. The
template carries no disclosure footer: a hand post adds the one the comment
rules require, and a factory frames its run result itself.

```markdown
✅ **Ready for implementation** · code-bound · priority normal

## Agent Brief

**Category:** bug / enhancement
**Summary:** one-line description of what needs to happen

**Current behavior:**
Describe what happens now. For bugs, this is the broken behavior.
For enhancements, this is the status quo the feature builds on.

**Desired behavior:**
Describe what should happen after the agent's work is complete.
Be specific about edge cases and error conditions.

**Key interfaces:**

- `TypeName`: what needs to change and why
- `functionName()` return type: what it currently returns vs what it should return
- Config shape: any new configuration options needed

**Acceptance criteria:**

- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2

**Out of scope:**

- Thing that should NOT be changed or addressed in this issue

**Seams:**
Record the Ownership check's result.

<details>
<summary><b>Triage notes</b> · owner questions: none · inferred intent: none · model <model></summary>

Path, verification, owner decisions, dependencies and the model's reason.

</details>
```

## Examples

### Good agent brief (bug)

```markdown
✅ **Ready for implementation** · code-bound · priority normal

## Agent Brief

**Category:** bug
**Summary:** Skill description truncation drops mid-word, producing broken output

**Current behavior:** Descriptions exceeding 1024 characters truncate mid-word at 1024.

**Desired behavior:** Break at the last word boundary before 1024 characters and append "...".

**Key interfaces:**

- `SkillMetadata.description`: keep its type; populate it at word boundaries
- Functions reading SKILL.md frontmatter to extract the description

**Acceptance criteria:**

- [ ] Under 1024 chars: unchanged
- [ ] Over 1024 chars: truncate at the last word boundary before the limit
- [ ] Truncated output ends with "..."; total length is at most 1024 chars

**Out of scope:**

- Changing the limit or supporting multi-line descriptions

**Seams:** No trigger
```

### Good agent brief (enhancement)

```markdown
✅ **Ready for implementation** · intent-bound · priority low

## Agent Brief

**Category:** enhancement
**Summary:** Record rejected feature requests in `.out-of-scope/`

**Current behavior:**
Rejections close with `wontfix` and a comment, with no persistent decision or
reasoning record; later requests require recalling or searching discussion.

**Desired behavior:**
Record rejected features in `.out-of-scope/<concept>.md`, including the decision,
reasoning and all requesting issue links. Check for matches during triage.

**Key interfaces:**

- Each record: `# Concept Name`, `**Decision:**`, `**Reason:**`, and a
  `**Prior requests:**` issue-link list
- Triage: read all `.out-of-scope/*.md` early; match by concept similarity

**Acceptance criteria:**

- [ ] Closing a feature as wontfix creates/updates its record with the decision,
      reasoning and closed-issue link
- [ ] Matching records gain a Prior requests link rather than a duplicate file
- [ ] Triage checks records and surfaces matching prior rejections

**Out of scope:**

- Automated matching: a human confirms each match
- Reopening rejections or recording bugs (only enhancements belong here)

**Seams:** A new decision record triggers the Ownership check. The repository
owns its rejected-feature decisions; triage and maintainers consume them.
The Markdown record is reversible, cost now S and carrying cost S. Choose the
cheapest local record; defer a shared record interface until another consumer.
```

### Good agent brief (PR)

For a PR, "Current behavior" describes the state of the diff, and the brief asks the agent to finish or fix it rather than build from scratch.

```markdown
✅ **Ready for implementation** · code-bound · priority normal

## Agent Brief

**Category:** enhancement
**Summary:** Finish the contributor's `--json` output flag for `triage list`

**Current behavior:** The PR's `--json` flag serializes the list, fits the command structure and works
on success, but errors remain human text and the flag lacks tests.

**Desired behavior:** With `--json`, all output including errors is valid JSON on stdout. Preserve
exit codes and the existing human-readable output without the flag.

**Key interfaces:**

- Error path: emit `{ "error": string }` under `--json`
- Reuse the PR's serializer

**Acceptance criteria:**

- [ ] `triage list --json` emits valid JSON for both success and error cases
- [ ] Exit codes match the non-JSON command
- [ ] A test covers the `--json` success output and one error case
- [ ] Default (non-JSON) output is byte-for-byte unchanged

**Out of scope:** Other commands or changes to the PR's success JSON shape

**Seams:** No trigger
```

### Bad agent brief

```markdown
## Agent Brief

**Summary:** Fix the triage bug

**What to do:** The triage thing is broken. Fix the function around line 150.

**Files to change:** src/triage/handler.ts (line 150)
```

This lacks a category, concrete current/desired behavior, acceptance criteria
and scope boundaries; its vague task and stale-prone paths/lines are not a contract.
