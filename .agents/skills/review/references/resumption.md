# Resumption

Read this when `round.mjs` reports an existing review of the current head.

- **`held yes`:** delivery already started, as after interruption before step 5
  finished, a later babysit round or a cleared gate. Go to step 5 without
  posting another review.
- **`reviewed yes`, `held no`:** read the review and recorded resolution. An
  unresolved finding still waits for implementation or grill. Without a settled
  contract, retain the contract-finding stop. When a grill settled the contract
  finding without requiring code changes, resume step 2 on this unchanged head;
  resolution alone does not make it hold.

For that reassessment, read the authoritative contract, the whole issue and
its discussion, the PR body's Delivery subsection, every earlier round's
review and the grill decision, including acceptance of any contract revision
that the planning rules require. Recheck both axes against those inputs.

At step 4, name the resolved contract finding in the Spec note, link the
recorded decision and report the actual reassessment. Use
`round.mjs <number> --reassess <file>` to update this account's latest complete
non-holding review of this head, preserving the previous assessment as quoted
history. Retain the head, round number and convergence bound. The common
method's exit handling and finding routes still apply.
