# Mission: Git ancestry for safe release checks
## Why
Maintain a release script that can determine whether a candidate release commit contains a required baseline commit, without mistaking timestamp order for the commit graph. This makes the release decision explainable and safe to automate.
## Success looks like
- Choose the correct argument order for `git merge-base --is-ancestor` in a real release check.
- Interpret status `0`, `1`, and other non-zero statuses without treating an error as a failed ancestry check.
- Explain that the check follows parent links, rather than commit dates.
## Constraints
- Keep the first lesson under 15 minutes.
- Use official Git documentation as the primary knowledge source.
- The learner is comfortable running basic Git commands.
- Use interactive retrieval practice and concise reference material.
## Out of scope
- Rebasing or any other history modification.
- Release policy decisions beyond whether the candidate contains the required baseline.
