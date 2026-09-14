The policy frontier is empty. Shared first-release policy:

- Automatically retry only explicitly temporary queue/dependency failures.
- Retry for up to 6 hours after failure, with at most 3 attempts.
- Avoid duplicate archives whenever completion is uncertain.
- After a confirmed non-completion, the customer may submit a new Export request.
- If completion remains uncertain, no resubmission is allowed.
- Customers may cancel during recovery; cancellation is final unless completion happened first.
- Customers can distinguish recovery-in-progress, success, unrecoverable failure, and cancellation.

This respects the known first-release constraints: 24-hour archive lifetime, no support replay, and no new paid infrastructure.

Please confirm this is the complete shared understanding. No files have been changed.