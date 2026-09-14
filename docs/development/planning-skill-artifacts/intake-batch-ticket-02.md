# 02: Commit Intake batches atomically under data-store conflicts

**What to build:** Once the public Intake batch endpoint is available, valid Intake batches are committed to the data store as one transaction. A concurrent Carrier-reference unique-constraint conflict is returned through the same public endpoint as the established `422` declaration-error response, and the failed Intake batch creates no Parcels, preserving the atomic Intake batch decision.

**Blocked by:** 01: Accept Intake batches through the public endpoint.

**Status:** ready-for-agent

- [ ] After the endpoint has completed ordinary validation, it commits all resulting Parcels once in a single data-store transaction and retains the `201` accepted-count response for success.
- [ ] A Carrier-reference unique-constraint conflict caused by concurrent Intake batches is translated into the same `422` response shape of `{ index, field, code }` used for ordinary declaration failures.
- [ ] Public-endpoint tests verify atomic rollback: a failed transaction creates no Parcels, including when a concurrent request causes the unique conflict.
- [ ] Public-endpoint tests exercise concurrent Intake batches and show that the successful and failed requests have the required atomic outcomes without changing the existing endpoint contract.
