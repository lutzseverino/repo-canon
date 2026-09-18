# Decide Parcel retry policy

## Destination

A reviewed decision record defining retry eligibility and the Retry window for failed Parcel dispatches.

## Notes

Use the Parcel operations glossary and local tracker. Planning only; do not implement dispatch behavior.

## Decisions so far

- Define failure categories: transient carrier failures may be retried; validation failures may not.
- Choose the default Retry window: use a 60-minute default so normal carrier incidents can clear without manual replay.

## Not yet specified


## Out of scope

- Building retry execution.
