Status: ready-for-agent

## Problem Statement

Operators cannot submit multiple Parcel declarations as a single Intake batch
through the public HTTP interface. They need a JSON-based batch capability that
reports every declaration error together, prevents duplicate Carrier references
within the submission, and either accepts the entire Intake batch or creates no
Parcels.

## Solution

Provide a public `POST /parcel-intake-batches` endpoint that accepts an Intake
batch as JSON. It validates every Parcel declaration, returns all declaration
errors in one `422` response when the Intake batch cannot be accepted, and
creates all resulting Parcels in one transaction when it can. A successful
request returns `201` with the accepted declaration count. This capability
preserves the existing single-Parcel behavior, authentication policy, and
rate-limit policy.

## User Stories

1. As an operator, I want to submit up to 100 Parcel declarations in one JSON Intake batch, so that I can request intake for related Parcels together.
2. As an API client, I want to send an Intake batch to `POST /parcel-intake-batches`, so that the batch capability is available through the public HTTP interface.
3. As an operator, I want each Parcel declaration to contain a Carrier reference and Destination postal code, so that the service receives the required intake information.
4. As an operator, I want every invalid Parcel declaration to be reported in one response, so that I can correct the complete Intake batch without repeated trial-and-error submissions.
5. As an API client, I want each validation error to identify a zero-based declaration index, field, and code, so that I can associate an error with the submitted Parcel declaration.
6. As an operator, I want duplicate Carrier references in one Intake batch to reject the whole batch, so that the same Parcel is not accepted twice in that submission.
7. As an operator, I want Carrier references compared after trimming while retaining case, so that accidental surrounding whitespace does not bypass duplicate detection and distinct casing remains distinct.
8. As an operator, I want a rejected Intake batch to create no Parcels, so that I never need to reconcile a partial acceptance.
9. As an API client, I want a valid Intake batch to be accepted in one transaction, so that all submitted Parcel declarations have one atomic outcome.
10. As an API client, I want a successful Intake batch response to be `201` with `{ accepted: number }`, so that I can confirm how many Parcel declarations were accepted.
11. As an operator, I want a concurrent Carrier-reference uniqueness conflict to return the same `422` declaration-error shape, so that conflicts are handled consistently with ordinary validation failures.
12. As an existing single-Parcel client, I want `acceptParcel()` behavior to remain unchanged, so that adopting Intake batches does not break current integrations.
13. As an authenticated and rate-limited client, I want the existing authentication and rate-limit policy to continue applying unchanged, so that Intake batches do not alter operational access controls.
14. As an operator, I want to use the HTTP Intake batch capability without waiting for an operator-facing summary, so that the first release provides API value independently.

## Implementation Decisions

- The first releasable slice is the public HTTP capability to accept and validate an Intake batch; an operator-facing summary is a later, independent slice.
- The endpoint is `POST /parcel-intake-batches` and accepts JSON shaped as `{ parcels: [{ carrierReference, destinationPostalCode }] }`.
- An Intake batch contains no more than 100 Parcel declarations.
- The service validates every submitted Parcel declaration before attempting Parcel creation. It does not stop processing after the first validation failure.
- A validation failure returns `422` and includes every error in the form `{ index, field, code }`, where `index` is the declaration's zero-based position. In-batch duplicate Carrier-reference errors use the `duplicate_reference` code.
- Duplicate Carrier references are evaluated from their trimmed values and are case-sensitive.
- After successful validation, resulting Parcels are committed once in a single transaction and the endpoint returns `201` with `{ accepted: number }`; `accepted` is the number of accepted Parcel declarations.
- A data-store unique-constraint conflict caused by concurrent requests is translated into the same `422` declaration-error response shape. The failed transaction creates no Parcels.
- The atomic behavior refines and remains consistent with ADR 0001: an Intake batch is accepted in full or rejected without creating any Parcels.
- Existing `acceptParcel()` behavior is unchanged. Existing authentication and rate-limit policy are unchanged.
- No prototype is required because the public API shape is already understood.

## Testing Decisions

- Test externally observable HTTP behavior rather than internal validation or transaction implementation details.
- Use the public `POST /parcel-intake-batches` contract as the primary and highest test seam.
- Cover valid JSON Intake batches up to the 100-declaration limit and assert the `201` response and accepted count.
- Cover invalid Intake batches with errors across multiple Parcel declarations and fields; assert one `422` response contains all `{ index, field, code }` errors and that no Parcels are created.
- Cover duplicate Carrier references whose trimmed values match, including the case-sensitive comparison boundary, and assert `duplicate_reference` errors reject the entire Intake batch.
- Cover a concurrent data-store unique-constraint conflict and assert it becomes the same `422` declaration-error shape with no Parcels created by the failed Intake batch.
- Cover preservation of the existing single-Parcel `acceptParcel()` behavior and unchanged authentication and rate-limit policy at their existing test seams.
- There is no existing HTTP, validation, authentication, rate-limit, persistence, or test contract in the current implementation; establish these tests at the public HTTP seam rather than coupling them to the current `acceptParcel()` implementation.

## Out of Scope

- Replacing or changing the existing single-Parcel `acceptParcel()` behavior.
- Any non-JSON Intake batch representation.
- Partial Intake batch acceptance or creating only valid Parcels from a rejected Intake batch.
- An operator-facing summary in the first release, or making that later capability a prerequisite for API use.
- Changes to authentication or rate-limit policy.
- Implementation tickets or implementation work.

## Further Notes

- “Every row error” in the originating discussion means every validation error
  associated with every Parcel declaration; the JSON contract is not
  row-oriented.
- `ready-for-agent` records that this specification has been reviewed and is
  sufficiently specified for agent implementation. It does not dispatch work
  or remove any implementation blockers.
