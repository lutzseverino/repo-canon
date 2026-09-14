Facts checked: the queue can delay delivery and track attempts; support cannot replay failures; archives expire 24 hours after creation; no paid infrastructure is allowed. No existing retry policy exists.

❓ **Q1** - **Automatic-retry eligibility**: Should automatic retries be limited to failures plausibly caused by transient infrastructure/dependency conditions, while validation, authorization, malformed requests, and other deterministic failures become terminal immediately?

➡️ Recommend **transient failures only**. Retrying known-bad Export requests wastes capacity and conceals actionable failures.

---

❓ **Q2** - **Data snapshot semantics**: When an Export request is retried, should its archive represent data as it stood when the request was accepted, or data current when the retry runs?

➡️ Recommend **the original accepted-request snapshot**. It makes retries semantically stable and prevents a delayed retry from silently exporting a different dataset.

---

❓ **Q3** - **Retry-window boundary**: Should the Retry window end 24 hours after the original Export request was accepted, regardless of when attempts occur?

➡️ Recommend **yes: 24 hours from acceptance**. This bounds delay and data staleness. The archive’s separate 24-hour expiry should begin once a successful archive is created, preserving the full download period.

---

❓ **Q4** - **First-release state boundary**: May the design require only the existing queue’s delayed delivery and attempt count, plus application state already owned by this service—without introducing any new infrastructure?

➡️ Recommend **yes**. It satisfies the cost constraint and keeps recovery mechanics colocated with the Export request lifecycle.

