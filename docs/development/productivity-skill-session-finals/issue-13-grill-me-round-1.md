Repository facts: the wall display has only each Incident card’s Owner and last-updated time available; first release cannot add notifications.

❓ **Q1** - **Attention-first rule**: Which condition should put an Incident card first?

- **Unowned first, then staleness:** any card with no Owner is ahead of owned cards; within each group, the least recently updated card is first.
- **Staleness only:** the least recently updated card is first, regardless of Owner.
- **Unowned only:** only cards without an Owner are identified as needing first attention; update time is informational.

➡️ I recommend **unowned first, then staleness**. An absent Owner means no responder is accountable for the next action; last-updated time then identifies the likeliest stalled card without needing unavailable severity or impact data.

---