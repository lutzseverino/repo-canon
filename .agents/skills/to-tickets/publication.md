# Publication

Use the configured tracker branch below. Both publish the same independently
mergeable contracts awaiting review; only their representation differs.

## Local files

Write one file per ticket under
`.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency
order. Use this template:

```markdown
# <NN>: <Ticket title>

**What to build:** end-to-end behaviour from the user's perspective, not a
layer-by-layer implementation list. For a deepening ticket, state the
structural outcome and `Behaviour changes: none` or list each change.

**Blocked by:** numbers/titles of blockers, naming the passage or inventory
behind each overlap edge, or "None (readiness still required)".

**Status:** state:triage

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

## Hosted tracker

Before publishing, read the installed comment rules' Disclaimers section.
Publish one issue per ticket in its responsible repository, blockers first so
edges reference real identifiers. Link every ticket to the one specification
parent and its blockers using native sub-issue and blocking relationships.
The **Parent** and **Blocked by** sections restate those links, never establish
them. If a native link fails, stop publication progression and report the exact
missing parent/blocker relationship and platform failure; a text-only edge is
never established.

Use the tracker's ticket form with these sections:

```markdown
## Parent

Reference to the specification parent (omit if the source was no existing issue).

## What to build

End-to-end behaviour from the user's perspective, not a layer-by-layer
implementation list. For a deepening ticket, state the structural outcome and
`Behaviour changes: none` or list each change.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

References to each blocker, naming the shared passage or inventory for overlap
edges, or "None (readiness still required)".
```

## Both branches

Avoid specific file paths and code snippets in contracts: they go stale.
Exception: inline decision-rich parts of a prototype's state machine, reducer,
schema or type shape when more precise than prose, noting prototype provenance.
