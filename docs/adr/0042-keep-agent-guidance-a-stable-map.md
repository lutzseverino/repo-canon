# Keep agent guidance a stable map

Status: amends the `AGENTS.md` line of
[ADR 0010](0010-carry-delivery-rules-in-the-environment.md).

`AGENTS.md` is a short, stable map: each line names a moment of work and the
authoritative file to read then, including a start-of-work line that reaches
the installed rules through the Repository Standards skill, for work that
changes no file too. It holds no rule text. A rule goes to the first place
that can hold it: a check, script or hook that refuses the wrong action; else
the installed rules, skill or guide read at the moment it applies, reached
from the map. Nothing relies on a file read once at the start of a long
session, or on free text in a launch. Claude Code and Codex both load
`AGENTS.md` into every session on their own (observed 2026-11-13: Claude Code
2.1.322 and Codex 0.167.2). The owner decided on 2026-11-13: "When I talked about
`AGENTS.md` I thought the way to go would be linking the paths of the
important places instead of moving rules there, `AGENTS.md` should not change
over time, I feel like." This supersedes the 2026-10-17 decision on #518, "No
installed-rules pointer is added to agent guidance".

## Considered options

- Rules written into `AGENTS.md`: rejected, because the file then changes with
  every rule and grows, and every session pays for every rule.
- Emphasis markers such as "IMPORTANT" on rules: rejected, because once many
  rules carry one the marker means nothing; placement and length do the work.
- Leaving installed-rule discovery to the Repository Standards skill's
  description alone: rejected, because a skill description is advisory.

## Consequences

- A conformance check holds the installed `AGENTS.md` to a map: every entry
  links a path, a line cap applies, and no rule prose appears.
- The delegation and session-naming paragraphs leave `AGENTS.md` for the files
  where they bind.
