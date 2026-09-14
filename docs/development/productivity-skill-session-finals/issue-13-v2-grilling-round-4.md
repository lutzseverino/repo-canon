Round 4 — the frontier is not empty: ambiguity needs a resolution rule, and a cancellable recovery needs a visible state.

❓ **Q11** - **Unresolvable ambiguous outcome**: If support cannot determine whether an Export request completed, should the request remain ineligible for resubmission permanently, or should a later exception be allowed?

Choices: permanently no resubmission; allow resubmission after the 24-hour archive lifetime; allow support to approve an exception.

➡️ I recommend no resubmission when completion remains unresolvable. This consistently preserves the accepted no-duplicate policy; support may investigate but does not replay the request.

---

❓ **Q12** - **Recovery-in-progress visibility**: While an eligible failure remains inside the Retry window, should the customer be told that recovery is underway, or should it appear simply unfinished until a final outcome?

➡️ I recommend exposing a recovery-in-progress state. It makes the available cancellation right meaningful and sets clear expectations without prescribing any UI copy.