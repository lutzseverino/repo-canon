---
name: review
description: Review an implemented draft pull request as an agent that did not write it, fix small findings or hand it back, then mark it ready and babysit it to merge. Use when a draft PR waits on review, or when asked to review and land one.
---

A prompt or brief naming this skill is its invocation.

Run as an independent reviewer who wrote none of the change; otherwise stop
and request a fresh agent. The installed `github-repository-configuration`
rules' Review of an implemented pull request section owns review policy;
`factory-workflow` owns gate stops. This skill supplies the method.

From the repository root, run
`node <this skill's directory>/round.mjs <number>` with Node.js 24 or 26 and
the supplied GitHub CLI credential. Add `--issue <n>` for a non-closing linked
issue. It prints `head`, `round`, `reviewed`, `held`, `draft`, closing `issues`
and owner `gates` for the running account's standing reviews. `held` means
that account's latest review holds on the current head.

| Exit | Recovery                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `1`  | Invocation/platform error, including oversized reads: follow Credentials for permission refusals; otherwise fix and rerun.          |
| `2`  | `--post`/`--reassess`: correct the incomplete/current-head review file and retry. `--ready`: return to step 1; review has not held. |
| `3`  | `--post`: this head already has a review. `--reassess`: no eligible review. Reread the round; retain an already holding review.     |

1. **Read the round.** Run `round.mjs`. For `held yes` or `reviewed yes`, read
   [Resumption](references/resumption.md) before continuing. Otherwise read the
   authoritative contract under `CONTRIBUTING.md`, the whole issue/discussion,
   the PR's Delivery handoff, every earlier review and grill decision, including
   required acceptance of revised contracts. Without a settled contract, retain
   the contract-finding stop. A PR without an
   issue uses its decision-bearing body. Done with head, round, contract and issue.
2. **Review.** Check out the head in your own checkout. Run `code-review` from
   the PR base branch's merge-base with the contract as spec. Apply
   `codebase-design`'s Ownership check through Standards against that contract.
   Give Spec the additional task of checking the contract against its issue
   and recorded decisions for contradictions, omissions, inventions or ambiguity;
   without an issue, omit that check. Verify every finding against source,
   dropping invalid ones with reasons. Route defects outside the change's
   responsibility through planning's Findings as Filed rows. Sort remaining
   findings as **contract**, **larger** or **small** under review policy. Done
   when every finding is dropped or sorted.
3. **Fix small findings** only without contract/larger findings; otherwise
   carry all findings unchanged. Without fixes retain the head. Commit fixes
   on the PR branch, run required development checks and push. Rerun
   `round.mjs` for the review's head. At `self-reported`, without contract/larger
   findings, run [Self-reported reruns](references/self-reported-reruns.md);
   failure becomes a larger finding. Done when only fixes separate the heads
   and checks pass.
4. **Post the review.** Read `.repo-standards/rules/comments.md#reviews`.
   Record actual Standards/Spec outcomes, a row per open/fixed/filed finding and the
   printed round/head; a holding round's lead records the merge. Post a new
   head with `round.mjs <number> --post <file>`; for same-head reassessment,
   use [Resumption](references/resumption.md)'s recording method. Handle exits above.
   - **Holds:** step 5.
   - **Larger, round 1:** leave draft; end with hand-back and review link for
     `implement` on this PR.
   - **Larger, later round:** leave draft; end failed, explaining nonconvergence.
   - **Contract:** read `.repo-standards/rules/comments.md#owner-questions`,
     post the grill question, move the issue to `state:grill`, leave draft
     and stop under planning's owner-question handoff.
5. **Deliver.** Run `round.mjs <number> --ready`, then `babysit`. Post its
   internal rounds through `round.mjs --post` as in step 4. At `self-reported`,
   read [Self-reported reruns](references/self-reported-reruns.md) before waiting on each head without this run's
   reruns, including fixes/branch updates; repeat metadata after title/body
   edits. A failure is a failed check for babysit's wait and steps 2–4.
   Before each merge attempt rerun `round.mjs`. A gate stops at ready-to-merge
   under factory rules: leave open, move its issue to `state:owner` and end
   reporting the gate.

## Reads

Paths are relative to the repository root.

- `.repo-standards/rules/planning.md`: planning policy. If absent, use
  `CONTRIBUTING.md`; without both, report the gap and stop the dependent step.
- `CONTRIBUTING.md`: contracts, Credentials, delivery and development checks.
  If absent, use the issue body, run documented checks and ask the owner in one
  PR comment about requirements left to the guide.
- `.repo-standards/rules/comments.md`: posting shapes. If absent, use
  `round.mjs`'s review shape and one comment per question.
- The installed `github-repository-configuration` and `factory-workflow` rules,
  and those `babysit` names: looked up by `repository-standards`. When the review section is missing,
  hold only with no open finding, hand back others once and fail the second
  round; without factory rules, gates stop delivery as step 5 says.
- The `code-review` skill: both axes. If absent, review the merge-base diff against
  documented standards and the contract yourself, keeping the axes apart.
- The `babysit` skill: delivery and `round.mjs` imports. If absent, stop: the command
  needs it.
- The `implement` skill: hand-backs. If absent, report the review link and stop.
- `.github/required-checks.json` at the pinned trusted default-branch commit:
  check location. If missing or unreadable, run no reruns; babysit refuses
  delivery until corrected.
- `vendor/repo-canon/validate.mjs` and `vendor/repo-canon/sandbox-image.mjs`:
  rerun entry points. If the validator is missing at `self-reported`, stop and report that reruns need it;
  if the image entry point is missing, skip that step.
- The `codebase-design` skill: Ownership check. If absent, report through planning's
  Findings, or in the handoff without planning or the guide; retain the contract.
