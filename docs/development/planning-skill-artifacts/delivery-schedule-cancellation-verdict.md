# Delivery schedule cancellation prototype verdict

## Question settled

Can dispatch coordinators understand a three-state Delivery schedule (`draft`,
`confirmed`, `dispatched`) when cancellation is allowed only before dispatch?

## Validated decision

Yes, provided that cancellation is a separate terminal operational outcome,
not a fourth progression stage. A cancelled Delivery schedule retains the last
reached scheduling stage (`draft` or `confirmed`) as history, visibly reports
`cancelled`, and accepts no more coordinator actions. Cancellation from
`dispatched` is rejected without changing the schedule.

## Primary source

Open `src/delivery-schedule-cancellation.prototype.html` directly in a browser.
It contains free play plus guided happy-path, cancellation, and illegal
transition walkthroughs. This throwaway demo is intentionally not production
code and must remain on its prototype branch.
