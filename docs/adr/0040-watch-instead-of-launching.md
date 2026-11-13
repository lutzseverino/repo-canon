# Watch instead of launching; a factory session performs the factory gaps

Status: supersedes [ADR 0037](0037-act-in-repositories-only-through-launches.md)
and the launch and intake-model-label responsibilities in
[ADR 0036](0036-launch-hand-stages-with-identifiers-only.md).

The orchestrating agent launches no pipeline stage. It talks with the owner,
answers in the owner's place except reserved decisions, keeps the plans, and
watches the work through the tracker and the factory's status: it shows the
owner what waits on them and files a finding when something breaks. Every
factory gap is performed by the factory session, which reads only the tracker
and the factory's status and writes only to the tracker. The orchestrating
agent's one launch is that session: it starts it and revives it when it stops.
The owner asked for this on 2026-11-13: "The idea is that the orchestrator
would not need to launch work itself. Instead, we'll give it a factory. I'm
thinking this can be in the form of a thread, or we can even make it execute
the factory itself", and "If not launching, watching that everything goes
smoothly and tracking." Watching launches had been most of the orchestrating
agent's load: in grill G9's pace retro of 2026-11-12, 68 of 134 wakes on one
day led to no action, and the owner's question "does anything need me?" was
answered wrongly 9 times in 23.

## Considered options

- The orchestrating agent keeps launching factory gaps until the factory
  covers them: rejected, because launch observation is the load that makes
  the owner-facing session hand over every few hours.
- Two orchestrator sessions, one facing the owner and one landing work, as
  tried from 2026-11-12: rejected after the trial, because the landing session
  read the same private records, relayed through files, copied errors in the
  relay and died unseen for 56 minutes. The factory session shares no record
  with the orchestrating agent; the tracker is the only interface.
- Waiting for the factory to gain a run kind for every gap: rejected, because
  work would stop for every stage the factory lacks, and a host without a
  factory could not work at all.

## Consequences

- Model labels are chosen and applied by the triage run, never by the
  orchestrating agent at intake.
- Readiness is applied when a contract is accepted; withholding it to order
  work is never used, and the factory orders ready work.
- No label is changed, and nothing proceeds, past a script's refusal: the
  refusal becomes a finding.
- A factory session that stops, or whose turn ends waiting, is detected by the
  same observation that detects a launch's ended turn, through an application
  adapter kept outside the skill.
- A host without a factory runs the factory session alone; the factory needs
  no local mode.
- A stage whose hand skill a repository's adopted release lacks still runs
  there by its installed procedure, now in the factory session, and is logged
  as a factory gap.
