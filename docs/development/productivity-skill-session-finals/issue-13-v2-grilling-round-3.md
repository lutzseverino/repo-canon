Round 3 — two policy edges remain where the accepted choices meet uncertainty:

❓ **Q8** - **New request after ambiguous completion**: Q6 permits a new Export request after a terminal failure, but Q3 rejects duplicate archives when it is uncertain whether the earlier request completed. Should resubmission be allowed when that uncertainty remains?

Choices: disallow resubmission until completion can be determined; allow it and accept possible duplicates; require support review first.

➡️ I recommend disallowing resubmission while completion is uncertain. Q6 then applies to failures confirmed not to have produced an archive.

---

❓ **Q9** - **Cancellation versus completed outcome**: If cancellation arrives while recovery is underway, but the Export request has already completed, what should prevail?

Choices: preserve the completed archive; cancellation removes the completed outcome; treat this as uncertain and withhold the archive.

➡️ I recommend preserving a completed archive when completion occurred before cancellation; otherwise cancellation is final. This honors cancellation without retroactively discarding a completed customer result.

---

❓ **Q10** - **Outcome visibility**: Which final outcomes must be made clear to the customer: success only; success and unrecoverable failure; success, unrecoverable failure, and cancellation?

➡️ I recommend all three final outcomes. The self-service recovery path is only usable if the customer can distinguish a confirmed non-completion from an ambiguous one.