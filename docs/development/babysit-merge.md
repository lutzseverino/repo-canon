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
Otherwise, it calls `PullRequests.squashMerge` with an expected head and an explicit
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
PR in a state other than `merged`. The skill hands off with a question under
[the contribution guide's comment rules](../../CONTRIBUTING.md#comments),
without retrying the merge. Exit `2` means the head changed, either before the merge
call or when a refused merge is followed by a read showing a different head;
the skill returns to its wait step. Exit `1` reports an invalid invocation or
a platform error, including a merge refusal with an unchanged head. Each platform request has a 45-second timeout.

Run `node --test test/babysit-merge.test.mjs` for the executable fixtures. They
use the same injected Postern fetch transport as the wait tests and cover the explicit message,
verbatim body, head changes, empty bodies, invalid arguments, access errors,
adoption-record bytes and trailing closing references,
merge refusals, merge queue refusal, and successful calls that leave the PR
unmerged. The whole skill directory is installed by its exact skill
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
push activity and inline review-comment facts that the neutral ports do not
expose. Access reads use
the expected head SHA and paginate. A failed prerequisite read fails without a merge. The wait preserves its
activity-read fallback: when the push activity request fails, it uses the
committer date for review timing and keeps the push unrecorded. Without checks,
an unrecorded push continues waiting; it cannot satisfy the five-minute gate.

Access supplement reads reject incomplete or unknown check, workflow, push and
review-comment facts. Check contexts paginate at the immutable head SHA, so a
subsequent PR update cannot replace the checks for the head being considered.
A missing `reviewCommits` capability fails the configured-reviewer wait.
