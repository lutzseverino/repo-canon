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
never change bypass settings to make a merge pass. Unavailable, unreadable or
unconfirmed enforcement stops unattended merging, including deferred adoptions.

Access then compares the default branch against the waited head. A stale branch
returns exit `4` for branch-update recovery. The comparison is preflight only:
GitHub's strict required-check enforcement supplies the final guard if the base
moves before the merge request. With enforcement confirmed and preflight fresh,
it calls `PullRequests.squashMerge` with an expected head and an explicit
subject and body. The subject is `<title> (#<number>)`; the body passes verbatim
through the port's JSON transport, preserving quotes, backticks, dollar signs,
line endings, and multiple paragraphs. No shell interprets the metadata.
GitHub's default squash message therefore does not add co-author trailers.
For adoption and update PRs, this includes the byte-preserved adoption record,
any Impact/Migration sections, and a trailing `## Related issue` section with
its closing or partial-work reference.

After a successful merge call, the script reads the PR's `state` through
`PullRequests.pullRequest` and reports success only when it is `merged`.
It then writes the merge result (the squash commit SHA) to stdout, followed by
a newline. Failed or unconfirmed merges write no success output.

Exit `0` means merged. Exit `3` means not merged and needs the owner: either
the base branch requires a merge queue, or a successful merge call left the
PR in a state other than `merged`, or freshness enforcement cannot be confirmed. The skill hands off with a question under
[the contribution guide's comment rules](../../CONTRIBUTING.md#comments),
without retrying the merge. Exit `2` means the head changed, either before the merge
call or when a refused merge is followed by a read showing a different head;
the skill returns to its wait step. Exit `1` reports an invalid invocation or
a platform error outside freshness preflight. Unreadable policy or comparison
results require exit `3` and the owner handoff, retaining the read diagnostic.
A permission refusal ends handling immediately without another
read or merge attempt. Other merge refusals re-read the head and compare the
base, so a base advance returns `4` instead of being mistaken for a changed PR
head. A failed comparison remains an explicit failure. Each platform request
has a 45-second timeout.

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
unmerged. The freshness fixtures model two green PRs sharing one base, a base
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
declarations from the resolved destination's default branch at one pinned commit.
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
PR comments. The following illustrative records use placeholder links and a
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
