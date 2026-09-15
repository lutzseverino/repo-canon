Resolved [Choose the default Retry window](/tmp/repo-canon-skill-exercises-11/triage-wayfinder/.scratch/shipping-map/issues/02-choose-default-retry-window.md): the default is a 60-minute Retry window.

Eligibility at selection: “Define failure categories” was resolved; “Choose the default Retry window” was open, unclaimed, and its only blocker was resolved. “Choose carrier-specific Retry windows” was open and unclaimed but blocked by the unresolved default-window decision.

Operation order:

1. Read the required skill, tracker, project, triage, domain, and development guidance.
2. Loaded the map and ticket state.
3. First tracker write: claimed “Choose the default Retry window.”
4. Evaluated supplied evidence and recorded the 60-minute resolution.
5. Closed that ticket and added its named context pointer to the map.
6. Removed the duplicate fog entry; left “Choose carrier-specific Retry windows” open.
7. Ran `git diff --check` and `npm test` successfully.
8. Committed: `7f081ec docs(wayfinder): choose default Retry window`.

No dispatch behavior was implemented and no remote was contacted.
