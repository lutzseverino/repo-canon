# Review a contract

Read the published brief as a reviewer who did not write it. Check it against the issue and the code yourself, not against the research run's own summary:

- **Evidence**: each claim the brief rests on traces to a code path, a reproduction, or the issue. Spot-check the one the change depends on. Verify every required input under [Available inputs](AGENT-BRIEF.md#available-inputs); reject a private-workbench reference in place of copied decision content.
- **Scope**: desired behavior is what the request asks for; nothing the request needs is dropped, nothing beyond it is added, and out of scope names the adjacent work an agent might reach for. Work that must be shown on a live system carries or splits its live evidence as [AGENT-BRIEF.md](AGENT-BRIEF.md#live-evidence-and-split-tickets) says.
- **Acceptance criteria**: each is concrete, testable, and independently verifiable, and together they cover the edge cases the request and the code expose.
- **Dependencies**: work that must land first is named, so it can be recorded as a blocker.
- **Seams**: assess the writer's result under `codebase-design`'s [Ownership check](../codebase-design/OWNERSHIP.md), including its honesty, Value owner, consumers, reversibility and cost read.
- **Open questions**: none remain, including missing required inputs. Route unavailable material as [Route questions](ORCHESTRATING.md#route-questions) says. An open intent question means the request is intent-bound; switch paths.

Passing the issue-contract check proves the shape, never that the brief holds. When it does not hold, send the research run the specific corrections; it edits the brief, and you review the new revision from the top.
