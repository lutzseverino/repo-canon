Round 2 — newly unblocked policy decisions:

❓ **Q4** - **Eligible failure classes**: Which failures count as narrowly defined transient failures? Choices: only explicitly temporary queue/dependency failures; also temporary capacity/rate-limit failures; any system failure unless known permanent.

➡️ I recommend only failures explicitly marked temporary by the queue or a dependency, including temporary capacity limits only when they carry an explicit retry indication.

---

❓ **Q5** - **Attempt cap**: Within the 6-hour Retry window, should there be a maximum number of automatic recovery attempts? Choices: 3; 5; no fixed cap.

➡️ I recommend 3 attempts. It limits repeated processing of customer data while still allowing recovery from a short-lived fault.

---

❓ **Q6** - **Terminal recovery path**: Once an Export request is final—because it is ineligible, reaches the attempt cap, or its Retry window ends—what recovery should the customer have? Choices: submit a new Export request; contact support; neither.

➡️ I recommend allowing a new Export request. Support cannot replay failures, so resubmission is the only meaningful recovery path.

---

❓ **Q7** - **Cancellation during recovery**: May a customer cancel an Export request while it is inside the Retry window? Choices: yes, cancellation is final; no, automatic recovery continues; only support may cancel.

➡️ I recommend customer cancellation with a final outcome. A pending recovery should not force continued processing after the customer has withdrawn the request.