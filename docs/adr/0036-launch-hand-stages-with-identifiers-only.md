# Launch hand stages with identifiers only

Status: its assignment of hand-stage launches and intake model labels to the
orchestrating agent is superseded by
[ADR 0040](0040-watch-instead-of-launching.md). Its identifier-only launch
shape and other stage methods stand.

The orchestrating agent launches every hand stage the way the factory launches
a run: the stage's hand skill followed by its stage input, the identifiers the
Canonical stages table names for that stage, and nothing else. A fact a launch
needs is first written to the record the skill reads, an issue comment or a
launch report's header. The model and effort come from the `model:` label the
orchestrating agent applies to the anchor issue by the host's model guidance,
or from the host default when no issue anchors the launch. A stage whose output
is a tracker record reports through it; only a stage whose output is a
workbench record writes a launch report. Hand launches had paired the skill
with free-text fields, so procedure travelled in prompts: a brief's
instruction overrode a skill, worker reports repeated the pull request handoff,
and a runtime wait rule ended turns before reports were written (repo-canon
#960, #973; the 11.0.1 release of the Repository Standards CLI). The owner set
the direction on 2026-11-11: "You as the orchestrator should not keep as much
stuff on memory and should not have to tell workers so much. The factory
doesn't need it, why should you?" The orchestrating agent settled the design
the same day in grill G7, under the owner's delegation.

## Considered options

- Free-text context fields beside the skill invocation, the shape this
  replaces: rejected, because nothing checks what a prompt carries, and a
  correction made in a prompt never reaches the skill.
- A composer that renders launches: rejected, because an invocation without
  free text is the hand skill plus identifiers, as the factory's own is.
- Per-stage model defaults in host configuration: rejected, because they would
  restate the host's model guidance as a second table.
- A separate brief-review skill: rejected, because triage already reviews and
  accepts contracts; independence comes from the session and its provider, not
  from the skill.

## Consequences

- The Canonical stages table gains an Input column beside Hand skill, and the
  skills that lacked an input mode gain one by argument.
- Release gets a thin hand skill that pins the default branch and leaves the
  version, gates and publication to the repository's own release rules.
- Brief review is triage's accept mode. Where a contract names a read-only
  check of live facts, the review runs it.
- Live acceptance runs the operations skill its live-acceptance brief names.
  Owner steps with a deadline go on the issue, where the orchestrating agent's
  issue watch sees them.
- An owner step, a hold or a run condition that once rode in a prompt is a
  comment or a blocking link on the anchor before the launch.
