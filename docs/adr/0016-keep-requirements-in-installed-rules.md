# Keep requirements in installed rules, and use skills as methods

Every requirement a standard places on an adopting repository lives in
installed, human-readable rules that its checks and assessments cite. An
installed skill is a method: it says how to do work and never defines what the
work must satisfy. This covers every skill the standard installs, pinned
upstream skills included, and does not govern an adopting repository's own
skills. Requirements had drifted into places an agent changing a file later
could not see: the guidance for each file was kept only with the adoption
run's inputs, and some requirements that the installed checks enforce were
written only in skills, such as the Agent Brief fields and the triage
disclaimer in `triage`, the map shapes in `wayfinder`, and the reviewer file's
schema and the no-check wait in `babysit`. Three alternatives were rejected:
moving file rules into `CONTRIBUTING.md`, because one guide for every file
would grow without bound; stating requirements in skills, because a skill is
read only when invoked and a check cannot cite a method; and leaving
guidance uninstalled, because it mixes lasting rules with one-time adoption
steps that a later reader must not follow.

## Consequences

- Each declaration separates its rules, which adoption installs, from its
  adoption guidance, which stays with the run's inputs.
- Where a check enforces a shape that a pinned skill produces, the rules
  restate that shape, and an upstream snapshot update changes the rules and
  the check together.
- Before a rule overrides a pinned skill's instruction, the skill's
  instruction is judged on its own merit; when it is as cheap or better, the
  standard follows it, and only an instruction that breaks the workflow is
  overridden. [ADR 0019](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md)
  decides when overrides give way to a fork.
- A route from an installed skill to an uninstalled one needs an override only
  when it can fire; a route that the installed setup files keep dormant needs
  none.
- [ADR 0010](0010-carry-delivery-rules-in-the-environment.md) already keeps
  delivery rules out of Repo Canon's own skills; this decision extends that to
  every requirement and every installed skill.
