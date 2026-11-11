# Babysit merge script

The `babysit` skill runs `.agents/skills/babysit/merge.mjs` after its wait and
review steps establish the merge conditions in
[the contribution guide](../../CONTRIBUTING.md#merging) and the
`github-repository-configuration` rules.

The caller establishes merge ownership and any required owner approval of the
current head before invoking the script, following the contribution guide and
applicable installed rules. The script's expected-head check preserves that decision against a head change;
it does not establish authorization itself. After a head change, the caller
re-establishes approval as well as check and review conditions before retrying.

Run `node .agents/skills/babysit/merge.mjs <number> <head SHA>` from the
repository root, passing the full SHA reported by the wait script. The merge
script reads the current PR title, body, and head through Postern's `PullRequests.pullRequest`, then checks
`PullRequests.mergesThroughQueue`. If the base
branch requires a merge queue, it stops before calling `PullRequests.squashMerge`: a queue
cannot apply the explicit squash message the contribution guide requires.
Before the queue check, it independently resolves both trusted review
declarations through `trustedReviewConfiguration()` at one pinned destination
default-branch commit and matches the platform PR author against that policy.
This applies even to direct invocation without a prior wait. For a matching
app author, Access reads the PR's reviews and requires a submitted review of the
current head in the shape of the installed
[comment rules' Reviews section](../../rules/comments.md#reviews) before any
merge write. Conversation comments, pending reviews and the earlier outcome
record without `Fixed:` and `Findings:` do not count. Proposed local or PR-branch
configuration and caller claims about a previous wait cannot bypass this check.
Nonmatching and absent policies keep their existing applicability.

Wait exit `6` prints that review's template for the full current head. Follow
the shared internal-review workflow in the `github-repository-configuration`
rules and replace every placeholder with actual results before posting it as a
pull request review. The parser in `review-outcome.mjs` requires the `Head:`,
`Standards:`, `Spec:`, `Fixed:` and `Findings:` plain text fields, each once in
the same review. The head must be the full current SHA. `Findings:` is `None`
or is empty and followed by list items that each start with a `path:line`
location. Empty fields, unfilled angle/bracket/brace prompt values, TODO/TBD
placeholder values, and fenced or HTML-comment examples do not count. The
review documents completed internal reviews; it grants no merge authorization
and does not settle review findings by itself.

Before merging, Access reads the destination's default branch and verifies the
PR targets it. It reads all active branch rules, including inherited rulesets,
and confirms a nonempty strict required-check rule whose matching ruleset detail
explicitly reports `current_user_can_bypass: "never"`. The policy read and merge
use the same authenticated connection, so this evidence concerns the merging
credential. A hidden global bypass list or one containing other actors is
compatible with that evidence; an empty list alone is insufficient. Every other
or missing caller-bypass value leaves that ruleset unconfirmed. Otherwise it
reads classic protection, requiring nonempty strict checks enforced for admins
too. These are read-only policy checks; setup and delivery
never change bypass settings to make a merge pass.

Both merge paths independently require `.github/required-checks.json` from the
same pinned trusted snapshot as reviewer configuration. The shared
`required-checks.mjs` reader also backs the read-only adoption check and wait.
It validates `version: 1` and a nonempty list of exact check names. Missing,
invalid and unreadable declarations refuse delivery with the path and trusted
revision when known. Correct the trusted default branch through the applicable
owner procedure and invoke again; a local or PR-branch file cannot repair it,
and no bootstrap bypass exists. The standard never installs repository names.

Merge reads paginated current-head check runs, commit statuses and workflow
attempts. Every declared name needs positive success: absence, pending, failure,
cancellation, timeout, skipped and neutral are insufficient. Older heads and
earlier attempts cannot satisfy newer pending/failed evidence. Existing waits
on observed checks and workflow attempts remain. Wait shares the same
interpretation and cannot report success after a no-check timeout.

With a configured reviewer, merge independently paginates the complete thread
set, including outdated threads, and requires every thread that reviewer opened
to be resolved. Replies, acknowledgements and completed reviews cannot resolve
threads. Incomplete or unreadable check/thread evidence fails closed. No reviewer
adds no thread requirement; app-author policy cannot waive configured threads.

Only recognized plan-limit 403 responses for both classic protection and
rulesets on a private repository permit merging-agent freshness verification.
That path retains its default-branch PR metadata workflow-presence check.
After all slow gates on either path, immediately before expected-head merging,
verify the unchanged head, live default destination and current default-tip
ancestry. Missing evidence, ordinary permission refusals and deferred setup
grant no exception. Another writer can advance the base after the final check:
the owner accepts this residual concurrent-base race only on the proven
plan-limited path. Strict non-bypassable GitHub enforcement supplies an additional
atomic guard wherever available. A stale base returns exit `4` for branch-update
recovery; a changed head returns `2` for new evidence.

The expected-head squash call sends the subject `<title> (#<number>)` and the
current body verbatim through JSON transport, preserving quotes, backticks,
dollar signs, line endings and paragraphs. No shell interprets metadata and
GitHub's default squash message cannot add co-author trailers.

Immediately before the merge write, Access reads `.scriptorium/config.json` at
the same destination default-branch SHA selected by
`trustedReviewConfiguration()`. A missing file or `labels.releaseHold` key
adds no check. With a configured label, it paginates open labelled issues,
keeps only PRs, and excludes the PR being merged. Other open labelled PRs
cause exit `9`, naming them with no merge write. Closed PRs, issues and the
labelled PR itself cannot hold that merge. Proposed branch or local
configuration never overrides the pinned default-branch configuration.
Unreadable or invalid factory configuration or PR-list reads follow freshness
failure handling: exit `3` needs the owner, while a permission refusal returns
`1` and stops immediately.

On exit `9`, leave the PR open and do not retry yet. In a factory run, end the
run so the factory can relaunch merging after the hold ends. Otherwise rerun
merge after the hold ends, keeping every other gate enforced. This result is
not an owner handoff and is distinct from every wait and merge outcome.

After a successful merge call, the script reads the PR's `state` through
`PullRequests.pullRequest` and reports success only when it is `merged`.
It then writes the merge result (the squash commit SHA) to stdout, followed by
a newline. Failed or unconfirmed merges write no success output.

Exit `0` means merged. Exit `3` means not merged and needs the owner: either
the base branch requires a merge queue, or a successful merge call left the
PR in a state other than `merged`, or neither freshness enforcement nor the proven private-plan path can be confirmed, or required-check/reviewer-thread evidence cannot be established. The skill hands off with a question under
[the comment rules' owner questions](../../rules/comments.md#owner-questions),
without retrying the merge. Exit `2` means current-head validation has not succeeded, or the head changed
before the merge call or after a refused merge;
the skill returns to its wait step. Exit `1` reports an invalid invocation or
a platform error outside freshness preflight, including unreadable trusted review
configuration. Invalid trusted review declarations return `3` with the selected
revision, affected file, validation problem and required correction for the owner;
they permit neither merging nor an unchanged-configuration retry.
Unreadable freshness policy or comparison
results require exit `3` and the owner handoff, retaining the read diagnostic.
A permission refusal ends handling immediately without another
read or merge attempt. Other merge refusals re-read the head and compare the
base, so a base advance returns `4` instead of being mistaken for a changed PR
head. A failed comparison remains an explicit failure. Each platform request
has a 45-second timeout.

Exit `5` means a policy-skipped PR lacks a complete review of the current head.
It makes no merge write and identifies the head, the comment rules' Reviews
section and the trusted configuration snapshot. Complete both internal reviews,
post the review using the wait's template, and rerun after verifying the remaining merge conditions. This retry
is distinct from the owner handoff, head-change and stale-base exits.

Exit `6` means configured-reviewer threads remain unresolved, naming their IDs
and trusted revision. Resolve them on the platform and rerun with all other
gates enforced; a reply alone cannot clear them.

For exit `4`, the skill permits one branch-update recovery per invocation,
preserving all work and PR context before rebasing or replaying only the PR's
changes onto the refreshed default branch. It validates the integrated change,
refreshes and inspects history and diff before pushing, then applies review
policy, checks, applicable reviews and merge authorization to the replacement
head. Old checks never qualify that head. A second stale-base result, uncertain
ownership or conflicting reconstruction goes to the owner rather than an
unbounded loop. The skill carries the complete recovery instructions.

Run `node --test test/babysit-merge.test.mjs` for the executable fixtures. They
use the same injected Postern fetch transport as the wait tests and cover the explicit message,
verbatim body, head changes, empty bodies, invalid arguments, access errors,
adoption-record bytes and trailing closing references,
merge refusals, merge queue refusal, and successful calls that leave the PR
unmerged. Outcome fixtures cover direct and installed invocation, missing,
stale, abbreviated, incomplete and placeholder evidence, policy changes since
wait, proposed local policy, invalid/unreadable trusted declarations, and all
remaining gates after a complete record. Release-hold fixtures cover installed
execution, multiple holds, self-exemption, closed PRs, label removal, issues,
absent configuration and keys, pinned configuration despite proposed local
changes or a moving default branch, and unreadable or invalid reads. The freshness fixtures model two green PRs sharing one base, a base
advance after preflight refused at the platform boundary, replacement heads
with pending or failed checks, classic and ruleset enforcement, explicit caller
non-bypass evidence with absent, empty or nonempty global lists, other or missing
caller-bypass values, missing or nonmatching details, non-strict or missing
required checks, and permission-refusal termination. These injected GitHub responses exercise the published
adapter; they do not establish live settings or a live GitHub integration test. The whole skill directory is installed by its exact skill
declaration, including its scripts and the `platform.mjs`, `reviewer.mjs` and
`pull-request-reviewer.mjs` modules. The bundle, license and provenance are
separate exact file declarations at `vendor/postern/`, shared with the
validators. Installed-layout fixtures execute the wait and merge without npm.

The request and wait commands' `--repo` argument selects an explicit repository.
Otherwise all three scripts resolve the repository from `GH_REPO`, then the
default repository configured by `gh repo set-default`, then the `origin`
remote URL when no default is configured. They read that default with
`gh repo set-default --view`; a failed lookup stops the command without
falling back to another repository. Request and wait select both trusted review
declarations from the resolved destination's default branch at one pinned commit;
merge independently selects a fresh snapshot on every invocation as well.
Run `node --test test/babysit-destination.test.mjs` for installed-command fixtures
covering selection precedence, trusted reads, request and merge writes, lookup
and credential failures, and the expected-head gate with a configured default.

The scripts read the currently authenticated GitHub CLI credential with
`gh auth token --hostname github.com` and pass it to the exact
[Postern bundle](../../vendor/postern/README.md). No credential is printed.
PullRequests owns PR reads, reviews, queue checks and merge writes; Access
retains conversation comments, GitHub check links, workflow attempt times,
push activity, inline review-comment facts, branch policy and comparisons that the neutral ports do not
expose. Access reads use
the expected head SHA and paginate. A failed prerequisite read fails without a merge. The wait preserves its
activity-read fallback: when the push activity request fails, it uses the
committer date for review timing and keeps the push unrecorded. Without checks,
an unrecorded push continues waiting; it cannot satisfy the five-minute gate.

Access supplement reads reject incomplete or unknown check, workflow, push and
review-comment facts. Check contexts paginate at the immutable head SHA, so a
subsequent PR update cannot replace the checks for the head being considered.
A missing `reviewCommits` capability fails the configured-reviewer wait.

## Adoption owner-review example

For a designated adoption PR, the caller follows the installed
`github-repository-configuration` rules' Designated owner review gate using
the [delivery records](../../rules/comments.md#delivery-records) the comment
rules describe. The following illustrative records use placeholder links and a
sample head; they introduce no required approval syntax.

Designation PR comment:

```markdown
> _This was generated by AI._

Owner review is required by the authoritative implementation contract:
https://github.com/example/repository/issues/123#issuecomment-456.
```

After verifying the owner's explicit approval of the current head, the caller
records it in an approval PR comment:

```markdown
> _This was generated by AI._

Owner approval source: https://github.com/example/repository/pull/12#issuecomment-789.
Approved current head: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.
```

The caller reads these comments again after handoff or resumed delivery.
The PR body stays byte-identical to its adoption record and permitted additions
under [the contribution guide](../../CONTRIBUTING.md#adoption-pull-requests).
A later head needs renewed explicit owner approval and a comment recording its
source and new SHA before the authorized merging agent proceeds.
