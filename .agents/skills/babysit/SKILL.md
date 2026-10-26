---
name: babysit
description: Babysit an opened pull request through checks and review to merge or its prescribed handoff. Use right after opening a pull request, or when asked to babysit or land one.
---

Take the pull request through its authorized delivery. `CONTRIBUTING.md` and the
`github-repository-configuration` rules hold the merge conditions and the
wording rules.

Before requesting or waiting, establish your delivery role from
`CONTRIBUTING.md`'s Merging section and applicable installed rules. If they
prescribe a worker handoff, record it on the open PR and stop. The designated
merging agent resumes here from the handoff, carrying its review requirements
and outstanding findings into the steps below.

The bundled scripts require Node.js 24 or 26. The request and wait read the optional
`.github/pull-request-reviewer.json`, whose schema the
`github-repository-configuration` rules state; without the file, it reports
only checks unless the app-author policy identifies an external review skip.
Both commands read the optional `.github/factory-review-policy.json` under
the same rules. A plain human-login declaration is a configuration error
(exit `1`), as defined by those rules. Its absence keeps configured reviewer
behavior and requires no owner question.

Before the first wait, apply the `github-repository-configuration` rules'
review request rule to the pull request's head, using step 4 to post any
required request. Use `node <this skill's directory>/request.mjs <number>`
from the repository root to apply the app-author policy before that rule.
It posts a required request or reports why none is needed. Exit `0` means
the rule was applied, not that a review occurred; exit `1` follows the same
Credentials/error handling as the wait. Run it again before waiting on a
later or resumed head; add `--fixes-review` when that head fixes a finding
requiring a new request under the rules.

1. Wait with `node <this skill's directory>/wait.mjs <number>`, run in the
   repository root in the foreground until it exits; it waits for the checks
   and the configured reviewer's review of the head, silently. Use a command
   timeout of 600000 ms where supported, and ask for the longest wait each
   time the command yields. The exit code
   says what comes next. Here, "checks passed" also covers a head with no
   check that the `github-repository-configuration` rules count as passed:
   - `0`: checks passed and the configured reviewer reviewed, or no reviewer is configured; go to step 2.
   - `2`: the listed checks failed; go to step 2.
   - `3` or `4`: checks passed and the configured reviewer did not review this head (`3`
     unavailable, `4` for the reason its line gives); go to step 2 and follow
     the `github-repository-configuration` rules for merging without that
     review.
   - `5`: still waiting; run it again.
   - `6`: checks passed and external review was skipped by app-author policy;
     go to step 2 and follow the rules' policy-skip merge outcome requirements.
   - `1`: follow [Credentials](../../../CONTRIBUTING.md#credentials) for a
     permission refusal; otherwise fix the invocation or other platform error and
     run it again.

2. Verify each failing check and review finding against the source, including
   findings that arrive on a policy-skipped pull request. Follow the
   `github-repository-configuration` rules for applicable internal Standards and
   Spec reviews and their merge record.
3. Fix the real findings `CONTRIBUTING.md` does not let you decline, and answer
   every review thread as it requires, following its
   [comment rules](../../../CONTRIBUTING.md#comments).
4. Apply the review request rule to each new head after a fix push. When it
   requires a request, post the review request comment as the
   `github-repository-configuration` rules describe, using `request.mjs` as above
   so the app-author policy takes precedence. After any push or
   re-request, return to step 1.
5. Before each merge attempt, verify merge ownership and any required owner
   approval against the current head under the applicable installed rules.
   When required approval is missing, use the contribution guide's
   owner-question handoff and stop with the PR unmerged. Once the merge
   conditions hold on the latest head, run
   `node <this skill's directory>/merge.mjs <number> <SHA>`, where `<SHA>` is
   the full SHA that starts the wait's latest line. Exit `0` means merged;
   `2` means the head changed, so return to step 1; `3` means it did not merge
   and needs the owner, so hand off with a question under
   [Comments](../../../CONTRIBUTING.md#comments), without retrying the merge;
   `1` means follow
   [Credentials](../../../CONTRIBUTING.md#credentials) for a permission refusal;
   otherwise fix the invocation or other platform error and
   run it again.
6. Stop.
