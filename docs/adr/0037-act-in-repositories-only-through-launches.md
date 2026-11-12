# Act in repositories only through launches

The orchestrating agent acts in a repository only by launching that stage's
hand skill into the repository's own checkout, where the skill runs the
repository's installed scripts at its adopted version. It applies no label
itself: readiness, holds, skips and pauses happen inside a launch, readiness
in triage's accept mode. It reads coverage and capacity only from the
factory's status, never from a repository's factory configuration. On an
issue it posts only the record of an owner decision. Adopting repositories run
different releases of the standard: on 2026-11-12, eleven of them spanned two
ready-label families and three shapes of triage's readiness command, and an
orchestrating agent that applied readiness itself had to know each one. The
owner asked on 2026-11-12 for this split: "My head tells me the right split is
having SC follow whatever the repo wants, and also this idea / orchestrator
should also adapt to the repo they're in. With RC providing the operations."
The orchestrating agent settled the design the same day in grill G8, under the
owner's delegation ("Maybe worth grilling, you could take over this one too.
Same view as last one.").

## Considered options

- The orchestrating agent runs each repository's scripts itself, knowing its
  labels, script shapes and version: rejected, because that knowledge grows
  with every adopter and release, and the launch it avoids already exists.
- Reading coverage from each repository's factory configuration: rejected,
  because only the factory knows whether a host serves the repository, reads
  its configuration and has paused it.
- A compatibility layer across adopters' releases: rejected, because each
  repository's installed copy already is that repository's procedure.

## Consequences

- An action that was one command now runs inside a launch. Readiness and
  parent readiness already run inside triage's accept-mode launch, so they add
  none.
- Recording an owner decision as a comment on the issue it decides stays the
  orchestrating agent's own act; it is a record, not procedure.
- When a repository's adopted release lacks a stage's hand skill, the stage
  runs by its installed procedure in a launch there and is logged as a factory
  gap naming the repository and release; adoption closes the gap.
- The factory's status reports each repository's coverage, and capacity is
  readable by the agents that launch.
