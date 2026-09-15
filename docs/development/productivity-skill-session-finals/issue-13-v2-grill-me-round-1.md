Read-only fact-finding was completed by `/root/dispatch_facts` (no files changed). It found:

- Every Incident card has an Owner and a last-updated time.
- This is a wall display; the first release must use only those fields and cannot add notifications.
- No existing policy defines attention ranking, thresholds, ties, or visual treatment.

❓ **Q1** - **Meaning of “needs attention first”**: What should be the primary signal that one active Incident card deserves operator attention before another?

- Time since its last update (a card becomes more urgent as it goes stale)
- Owner-based interpretation (for example, group or prioritize by Owner)
- A combination of both

➡️ I recommend **time since last update**. It is objective, universally available, and makes the wall display immediately actionable without inventing information about Owner workload or incident severity.
