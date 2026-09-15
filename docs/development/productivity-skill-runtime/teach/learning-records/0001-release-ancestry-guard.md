# Safely classify a release candidate with ancestry

The learner correctly applied `git merge-base --is-ancestor` with the required baseline first and candidate second, and distinguished `0` (eligible), `1` (ordinary ineligible), and another nonzero status (operational error). Future practice can build on graph reachability rather than commit dates.

## Evidence

Completed retrieval from memory using `git merge-base --is-ancestor v1-base release-42` and accurately classified all three outcome categories.

## Implications

The learner is ready for a spaced, mixed-topology practice before applying the guard to a real release script.
