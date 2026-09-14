# 01: Accept Intake batches through the public endpoint

**What to build:** Operators and API clients can submit up to 100 Parcel declarations as JSON to `POST /parcel-intake-batches` and receive a `201` response with the accepted declaration count when the Intake batch is valid. The public endpoint reports every ordinary declaration error together, including in-batch duplicate Carrier references, so a rejected Intake batch accepts no Parcel declarations. It preserves the existing single-Parcel `acceptParcel()` behaviour and does not change authentication or rate-limit policy.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `POST /parcel-intake-batches` accepts `{ parcels: [{ carrierReference, destinationPostalCode }] }` with no more than 100 Parcel declarations and returns `201` with `{ accepted: number }` for a valid Intake batch.
- [ ] An invalid Intake batch returns one `422` response containing every declaration error as `{ index, field, code }`, with zero-based declaration indexes, rather than stopping at the first error; no Parcel declaration from that batch is accepted.
- [ ] In-batch duplicate Carrier references are rejected with `duplicate_reference` after trimming values while retaining case, including the distinct-casing boundary.
- [ ] Existing `acceptParcel()` behaviour and the existing authentication and rate-limit policy remain unchanged, verified at their public or established test seams.
