# Lead every message with its outcome

Every message an agent posts under Repo Canon's rules (an Agent Brief, a review,
a pull-request body's delivery record, an owner question, a findings note) and
the issue-contract workflow's own feedback start with a **lead line**: a status
marker, the state or verdict in bold, and who must act only when a person must.
The AI disclosure moves from the first line to a footer that also carries the
run facts. Evidence and notes are collapsed behind a summary line that states
the facts a decision needs; anything a person must act on or may veto stays
visible. A message links to text that exists elsewhere instead of copying it.
A review is a verdict line and, when there are findings, one findings table;
the implementing worker's handoff is the pull-request body's delivery record,
and the final review round replaces the merge record. Length limits are written
rules; the parsers that already read a message check its shape.

On 2026-11-13 the owner found the factory's messages "a bit complicated, maybe
too long. Not helpful for humans skimming or even agents", and asked that
reviews come "in a specific format, always being as visible as possible, brief
and easy to understand". Measured that day: #881's triage result was 7,631
characters with everything open, every comment and review on PR #1000 opened
with the disclaimer, and the owner decision #796 needed sat at the bottom of a
collapsed block. In the grill that followed, the owner approved mockups of the
run comment, a triage result and a pull-request review, then answered the
remaining questions with "Agreed to all" and "Agreed".

## Considered options

- Disclosure first, lead line second: rejected, because notification and email
  previews show only the first line.
- Folding the disclosure into the lead line: rejected, because the lead line
  then carries a fixed phrase on every message.
- Review verdicts in an axis table: rejected, because GitHub cannot widen a
  Markdown table and a passing round's notes are boilerplate; the findings
  table already says why a round fails.
- Limits enforced by blocking checks: rejected, because a run would fail over
  one long sentence; only shapes a parser already reads are checked.

## Consequences

- The issue-contract validator and the review reader accept both the old and
  the new shapes for one release, preserving compatibility with earlier
  messages during the transition. Adopters must run the Repo Canon release
  containing #1034 before the Scriptorium release containing
  [scriptorium#199](https://github.com/lutzseverino/scriptorium/issues/199)
  reaches their host: the earlier validator rejects the new footer frame.
- Fences and HTML comments no longer void a whole review; the reader parses
  the verdict line, the findings table and the footer's head.
- Status markers come from one fixed set and always sit beside a word, so a
  plain-text reader loses nothing; they never sit beside a checkbox.
- Mermaid stays out of comments; pull-request bodies keep it.
