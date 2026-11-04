# Name labels by family

Every label Repo Canon defines belongs to one family named by its prefix:
`state:` for the one workflow state an open issue carries, naming whom it
waits on (`triage`, `reporter`, `grill`, `owner`, `ready`); `gate:` for owner
gates set before the work; `factory:` for the factory's machine state, which
only the factory sets; `type:` for the category; `priority:` for pickup order
(`high`, `normal`, `low`); and `model:` as before. The owner chose this on
2026-11-03 because `ready-for-human`, `owner-review` and `factory:needs-input`
read alike while one was a state, one a reservation and one a factory marker.
`factory:needs-input` goes away: a run that stops on a question sets the
workflow state for whoever must answer. A person applying `state:triage`, or
opening the issue, triggers factory triage; the validator's own fallback
application never does. Keeping the old names with documented purposes was
rejected because the names, not the documents, are what agents and people
read. The rename is a breaking standards change, shipped with the factory's
run kinds in one switch window.
