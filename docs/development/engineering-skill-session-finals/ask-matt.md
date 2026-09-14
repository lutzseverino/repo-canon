Route: `/diagnosing-bugs` → `/implement` (driving `/tdd`) → `/code-review`.

Start with `/diagnosing-bugs`: this is an intermittent regression with no trusted cause. Establish one reliably failing reproduction before theorising, then carry its regression test and confirmed cause forward.

Before implementation, ensure the bug has an agreed issue/acceptance criteria; use `/triage` only if this maintainer report is still raw intake. At the diagnosis → implementation boundary, **continue in the same session**: implementation needs the diagnostic reasoning as a primary source, so no `/handoff`, `/clear`, or compaction is warranted.

`/implement` makes the fix test-first and then hands the resulting diff to `/code-review` before committing/shipping. The pinned review flow requires a fixed comparison point and the bug issue/spec; it runs separate Standards and Spec reviews in parallel, reports both axes independently, and any findings return to implementation before shipping.

`/setup-matt-pocock-skills` remains a prerequisite if it has not already been run. No repository changes were made.
