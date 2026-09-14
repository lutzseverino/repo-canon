❓ **Q5** - **Snapshot preservation**: How should the original accepted-request snapshot be retained for the Retry window: store an immutable export manifest/payload in service-owned state at acceptance, or rely on a versioned source-data snapshot reference?

➡️ Recommend **an immutable manifest in service-owned state**. It makes the retry self-contained and avoids relying on source systems retaining historical versions for 24 hours.

---

❓ **Q6** - **Failure classification**: Should retryability be decided from explicit, structured failure categories maintained by the Export service, with unrecognized failures treated as terminal until classified?

➡️ Recommend **yes**. Conservative handling prevents accidental retry loops; transient categories can include dependency unavailability, rate limiting, and temporary network/server failures.

---

❓ **Q7** - **Retry cadence and attempt budget**: Within the 24-hour Retry window, should attempts use capped exponential backoff with jitter and a hard maximum attempt count?

➡️ Recommend **yes: capped exponential backoff with jitter, maximum 6 total attempts**. It rapidly recovers brief failures while avoiding synchronized retry spikes and excessive work. The exact delays can follow once you select the cap.

---

❓ **Q8** - **Duplicate-attempt protection**: Should the system enforce one active attempt per Export request and make archive creation/delivery idempotent by that request’s stable identifier?

➡️ Recommend **yes**. Queue delivery can be duplicated, so without a lease/fencing mechanism and an idempotent completion record, the same request could create or deliver multiple archives.

---

❓ **Q9** - **Queue fairness**: When capacity is constrained, should first attempts for newly accepted Export requests take priority over automatic retries?

➡️ Recommend **yes**. Retries should recover failures without allowing an outage backlog to block new customer requests.

---

❓ **Q10** - **Terminal outcome**: After a non-retryable failure, the maximum attempt count, or Retry-window expiry, should the Export request be recorded as terminally failed and require the customer to submit a new Export request if they still need one?

➡️ Recommend **yes**. It fits the constraint that support can view failures but cannot replay them, gives the lifecycle a definite end, and avoids creating an unbounded recovery channel.