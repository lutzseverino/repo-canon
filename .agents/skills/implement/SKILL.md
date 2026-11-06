---
name: implement
description: "Implement a spec or ticket to a draft pull request, or address review findings on its existing pull request."
---

A prompt or brief naming this skill is its invocation.

Before editing, read `CONTRIBUTING.md` for the repository's branch and
validation requirements. Implement the work described in the spec or tickets.
When the input is review findings on an existing pull request, read the
findings and continue on that pull request's branch.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the repository's
required validation on the final commit.

For new work, commit and push the branch, write the body with `pr`, and open
one **draft** pull request as `CONTRIBUTING.md` directs. For review findings,
commit and push the fixes to the same pull request and leave it a draft;
before replying to findings, read the installed `comments` rules' Review-thread
replies section and answer there as it directs. Report the pull request,
head and validation outcomes, then stop. Leave review, marking ready,
babysitting and merging to the separate agent running `review`; do not run a
self-review.

## Reads

Paths are relative to the repository root.

- `CONTRIBUTING.md`: branch, validation and pull request requirements. When
  it is missing, work on a branch dedicated to the change, run the available
  checks, and open a draft pull request with `pr` as above.
- `.repo-standards/rules/comments.md`: how to reply to review findings.
  When it is missing, follow the contribution guide's comment requirements;
  without either source, report the fixes in the handoff.
