The frontier is empty. Shared understanding:

`Accepted → immediate attempt → success | scheduled retry | terminal failure`

- Each Export request captures an immutable original snapshot manifest in service-owned state.
- The Retry window is 24 hours from acceptance. A successful archive expires 24 hours after its creation.
- Retry only explicit transient failures: network/connectivity errors, dependency timeouts, and dependency `408`, `429`, or `5xx`. Unknown failures are terminal.
- There are at most six total attempts: one immediate attempt, then fixed offsets from acceptance at 5m, 30m, 2h, 8h, and 20h, with bounded jitter.
- Valid `Retry-After` replaces the next pending retry, skipping passed offsets; later offsets remain anchored to acceptance. No attempt runs at or after the 24-hour boundary.
- Only one attempt may be active per Export request; archive creation/delivery is idempotent by stable request identifier.
- New requests receive 80% of execution capacity; eligible retries receive 20%.
- Success means a durable, downloadable archive exists. Notification failures do not recreate it.
- Terminal failures are visible in the existing customer status surface, may use an existing notification channel, and require a new Export request. Support can inspect non-sensitive metadata but cannot replay.
- Delete the snapshot manifest at terminal success or failure; retain only non-sensitive audit metadata.
- The first release uses only the existing queue and service-owned state—no new paid infrastructure.
- Exact jitter formula, notification copy, and metric thresholds remain implementation details.

Please confirm this is the intended complete design. I will not implement anything.