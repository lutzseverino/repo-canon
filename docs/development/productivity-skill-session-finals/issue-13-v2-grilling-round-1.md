Read-only fact delegate: `/root/repo_facts`.

Returned facts: an Export request produces one downloadable archive; archives expire after 24 hours; the queue supports delayed delivery and records attempts; support can view failures but cannot replay them; first release cannot add paid infrastructure. No code or existing retry policy exists. Key policy gaps include retry eligibility, retry-window length, duplicate-delivery stance, user notifications, and final-failure handling.

Design tree root: **first-release failed Export request recovery policy**.

❓ **Q1** - **Automatic recovery scope**: Should the first release retry failed Export requests automatically at all? The existing support path is visibility only, so choosing “no automatic retry” means a failure has no recovery route in this release.

Choices: automatic retries for narrowly defined transient failures; automatic retries for every failure; no automatic retries.

➡️ I recommend automatic retries only for narrowly defined transient failures. It provides recovery without endlessly repeating permanent or customer-actionable failures.

---

❓ **Q2** - **Retry window**: What maximum period after an Export request fails may automatic recovery continue? It must fit within the archive’s 24-hour lifetime.

Choices: 1 hour; 6 hours; up to 24 hours.

➡️ I recommend a 6-hour Retry window: enough time for a brief service disruption to clear, while leaving substantial useful archive lifetime and limiting prolonged uncertainty.

---

❓ **Q3** - **Customer outcome on uncertainty**: If it cannot be determined whether a failed attempt already produced an archive, which customer outcome should the policy favor?

Choices: avoid duplicate archives even if recovery is skipped; favor recovery even if a duplicate archive is possible; require a human decision.

➡️ I recommend avoiding duplicate archives. For customer data, an extra archive is a confusing—and potentially sensitive—outcome; recovery should be conservative when completion is uncertain.