Implemented Invoice reference formatting and invalid-sequence rejection.

- Added public-seam tests for formatting, zero, negative, and fractional sequences.
- `npm test` passes.
- `git diff --check` passes.

Changed [invoice-reference.mjs](/tmp/repo-canon-skill-exercises-12b/tdd/src/invoice-reference.mjs) and added [invoice-reference.test.mjs](/tmp/repo-canon-skill-exercises-12b/tdd/test/invoice-reference.test.mjs).

I could not create the requested commit: `.git` is mounted read-only, so Git cannot create `.git/index.lock`. Intended commit: `feat(invoice): format Invoice references`.
