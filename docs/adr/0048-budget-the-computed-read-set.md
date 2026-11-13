# Budget the computed read set, not files' lines

Status: accepted (2026-11-13).

What an agent must read is measured in bytes over its **read set**, computed
from an entry-point skill (`orchestrate`, `factory`, `triage`, `implement`,
`review`) through each skill's own Reads section, over the skills and rules it
names. A change may not grow an entry point's read set beyond the base
branch's unless its pull request names why. This replaces the line caps on
`orchestrate`'s files and the contribution guide's word budget; `AGENTS.md`
keeps its own cap (ADR 0042), and `orchestrate`'s wait script keeps its size
criterion. The orchestrating agent's records are checked by its own records
module: the plan-row schema and a byte budget over the records a pass reads.

The owner agreed on 2026-11-13 ("Agreed to all"), after measurements showed the
capped files holding their line counts while their words grew 17 % and the
text moved into other rules and the workbench records, where nothing measured
it.

## Considered options

- Tighter line caps: rejected, because they push text into longer lines and
  unmeasured files.
- A stored budget number: rejected, because every shrinking change would edit
  it; the base branch is the baseline.
