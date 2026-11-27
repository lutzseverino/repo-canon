# Command outcomes

Read the relevant table when request, wait or merge exits.
All commands run from the repository root with Node.js 24 or 26.
For a startup failure, follow the stop in [SKILL.md](SKILL.md).

## Request

`node <this skill's directory>/request.mjs <number>`; add `--fixes-review`
when fixing a review finding, or the verified `--updated-from` argument from
[branch-update recovery](BRANCH-UPDATE.md).

| Exit | Action |
| --- | --- |
| `0` | Continue to wait; this does not mean a review occurred. |
| `8` | Replace the listed own-head body links with commit-SHA links; rerun request before waiting. |
| `7` | Use wait's owner-handoff action below. |
| `1` | Use wait's error action below. |

## Wait

`node <this skill's directory>/wait.mjs <number>`; wait in the foreground
when its exit cannot resume the session. Use 600000 ms command timeouts where
supported. For a verified unchanged update, use `--updated-from` from recovery.

| Exit | Outcome and action |
| --- | --- |
| `0` | Checks passed; reviewer reviewed or none configured. Continue with findings. |
| `2` | Listed checks failed. Continue with findings. |
| `3`, `4` | Checks passed; reviewer did not review this head (`3`: unavailable; `4`: reason in output). Continue with findings; apply the rules for merging without review and record its absence under `.repo-standards/rules/comments.md#delivery-records`. |
| `5` | Still waiting; rerun wait. |
| `6` | Checks passed; app-author policy skipped external review. Continue with findings; after both internal reviews, read `.repo-standards/rules/comments.md#reviews`, fill every placeholder in the printed full-head template and post it as a PR review. An unfilled template is not completed evidence. |
| `7` | Invalid trusted configuration. Post an owner question under `.repo-standards/rules/comments.md#owner-questions`, naming the diagnostic's destination repository, selected revision, declaration, validation problem and needed correction. Follow installed continuation rules, leave the PR open and stop babysitting; no unchanged-configuration retry or merge. |
| `1` | For permission refusal, follow `CONTRIBUTING.md`'s Credentials section; otherwise fix the invocation or platform error and rerun. |


## Merge

`node <this skill's directory>/merge.mjs <number> <SHA>`; use the full SHA
starting the latest wait outcome.

| Exit | Outcome and action |
| --- | --- |
| `0` | Merged. Record any installed-rule-required outcome under `.repo-standards/rules/comments.md#delivery-records`: delivered head, validation/review results and printed merge commit SHA. |
| `2` | Head changed or current-head validation has not succeeded. Run request and wait again. |
| `3` | Not merged; owner needed, including a `gate:` label on the PR or any closing issue, a closing issue's declared deletion still present, or an edit to a surface another open issue's `Deletes:` names. Leave it open and hand off under `.repo-standards/rules/comments.md#owner-questions`, without retrying merge. |
| `4` | Stale base. Enter [branch-update recovery](BRANCH-UPDATE.md). |
| `5` | Current-head policy-skip review missing/incomplete. Complete both internal reviews, post under `.repo-standards/rules/comments.md#reviews` using wait's full-head template, verify other merge conditions and rerun merge. No owner handoff. |
| `6` | Configured-reviewer threads remain unresolved. Resolve them on the platform, verify the other gates and rerun merge. Replies alone do not resolve threads. |
| `9` | Another open issue/PR has the repository-hold label, or another open PR has the release-hold label. Leave this PR open; retry only after the hold ends. Factory runs end for factory relaunch after the hold; other runs rerun merge after it ends. No owner handoff. |
| `1` | For permission refusal, follow `CONTRIBUTING.md`'s Credentials section; otherwise fix the invocation or platform error and rerun. |
