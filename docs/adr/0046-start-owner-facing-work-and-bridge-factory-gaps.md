# Start owner-facing work; the factory session is a bridge with removal conditions

Status: accepted (2026-11-13); amends
[ADR 0040](0040-watch-instead-of-launching.md).

Besides the factory session, the orchestrating agent starts **owner-facing
work**, a closed list: the grill, the retro, the Done check and the
architecture review. Each reads the owner or the private plans, so none is a
pipeline stage and none is a factory gap; the factory session never sees a
plan. The factory session is a bridge: every stage it performs names the
factory ticket that will remove it, or a recorded decision that the stage stays
outside the factory, and the list lives in the workbench plan, not in the
installed rules. The tickets closing the top gaps in the projects that own
them keep their priority (serving the remaining repositories, review of any
ready pull request in a served repository, an answered stop re-entering the
factory, Release as a run kind), but a minimal factory session ships as the
bridge, and removing hand launches from `orchestrate` does not wait for them.

The owner agreed on 2026-11-13 ("Agreed to all"), after an audit found the
factory session at risk of becoming a permanent second executor.

## Considered options

- Holding the factory session until the factory covers the top gaps: rejected,
  because the largest deletion in `orchestrate` would wait on cross-repository
  additions, and a host without a factory still needs the session (ADR 0040).
- Running owner-facing work in the factory session: rejected, because the
  session reads only the tracker and the factory's status.
