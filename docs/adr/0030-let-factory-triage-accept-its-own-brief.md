# Let the factory's triage run accept its own brief

In a factory repository with the triage run kind on, the factory's triage run
writes the Agent Brief and applies readiness itself, as long as it did not
write the issue. The issue-contract validator approves that readiness when the
factory's recorded triage result applied it, so readiness no longer always
needs a person. The independent check moves one step later: the review run's
Spec review reads the brief against the issue as well as the diff against the
brief, and returns a wrong or ambiguous brief to a grill. The owner chose this
on 2026-11-03 for full automation with trusted models; a separate
brief-review agent before readiness was rejected as one more sandbox per issue
for a check the review run already makes, and a bad brief costs one implement
run, never a bad merge. Triage still routes every question of the owner's
intent that the repository's own records cannot answer to a grill, and when
triage is off, readiness still comes from a person. This relaxes the
orchestrating agent's rule that a brief's writer never accepts it, only for
the factory's triage run.
