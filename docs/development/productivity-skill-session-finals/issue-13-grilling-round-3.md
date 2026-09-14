❓ **Q11** - **Retry schedule**: Should the five automatic retries occur after nominal delays of **5 minutes, 30 minutes, 2 hours, 8 hours, and 20 hours**, each with bounded jitter, with no retry scheduled at or beyond the 24-hour Retry-window boundary?

➡️ Recommend **yes**. This gives short outages a quick recovery path while preserving an attempt late enough to cover a longer incident.

---

❓ **Q12** - **Dependency retry guidance**: When a retryable dependency returns a valid `Retry-After` instruction, should it override the nominal next delay, provided the resulting attempt remains inside the Retry window?

➡️ Recommend **yes**. It respects rate limits and reduces the likelihood that retries prolong an upstream incident.

---

❓ **Q13** - **Retryable failure taxonomy**: Should the initial explicit retryable set be: network/connectivity failures, dependency timeouts, dependency `408`, `429` (subject to `Retry-After`), and dependency `5xx` responses; with all other failures terminal unless deliberately added later?

➡️ Recommend **yes**. It is a conservative, auditable starting set consistent with the chosen “unrecognized means terminal” rule.

---

❓ **Q14** - **Completion boundary**: Should an Export request become successfully complete when its archive is durably created, associated with the request, and downloadable—rather than when any subsequent customer notification is sent?

➡️ Recommend **yes**. A notification failure must not rebuild or duplicate an already available archive; it should be handled independently.

---

❓ **Q15** - **Customer-facing terminal feedback**: Should a terminally failed Export request be shown as failed in the existing customer-facing status surface, with one existing-channel notification if such a channel already exists, but no new notification system in the first release?

➡️ Recommend **yes**. Customers need a clear outcome and a path to submit a new request, while the design stays within the infrastructure constraint.

---

❓ **Q16** - **Snapshot retention and audit privacy**: Should the immutable snapshot manifest be deleted as soon as the Export request reaches terminal success or terminal failure, while retaining only non-sensitive operational metadata—request identifier, timestamps, attempt count, classification, and terminal reason—for support visibility?

➡️ Recommend **yes**. The manifest is needed only to retry; support needs diagnosis, not a retained copy of export contents.

---

❓ **Q17** - **Enforcing first-attempt priority**: Should the service reserve a small, fixed share of execution capacity for eligible retries (recommend **20%**) while giving the remaining capacity to first attempts, rather than allowing retries only when no new requests are waiting?

➡️ Recommend **yes**. It preserves the selected priority for new requests without starving recovery during sustained demand.