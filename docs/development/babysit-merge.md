# Babysit merge script

The `babysit` skill runs `.agents/skills/babysit/merge.mjs` after its wait and
review steps establish the merge conditions in
[the contribution guide](../../CONTRIBUTING.md#merging) and the
`github-repository-configuration` rules.

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

After a successful merge call, the script reads the PR's `state` through
`PullRequests.pullRequest` and reports success only when it is `MERGED`.

Exit `0` means merged. Exit `3` means not merged and needs the owner: either
the base branch requires a merge queue, or a successful merge call left the
PR in a state other than `MERGED`. The skill hands off with a question under
[the contribution guide's comment rules](../../CONTRIBUTING.md#comments),
without retrying the merge. Exit `2` means the head changed, either before the merge
call or when a refused merge is followed by a read showing a different head;
the skill returns to its wait step. Exit `1` reports an invalid invocation or
a `gh` error, including a merge refusal with an unchanged head. Each platform request has a 45-second timeout.

Run `node --test test/babysit-merge.test.mjs` for the executable fixtures. They
use the same injected Postern fetch transport as the wait tests and cover the explicit message,
verbatim body, head changes, empty bodies, invalid arguments, access errors,
merge refusals, merge queue refusal, and successful calls that leave the PR
unmerged. The whole skill directory is installed by its exact skill
declaration, including its scripts and the `reviewer.mjs` and
`pull-request-reviewer.mjs` modules.

The scripts read the currently authenticated GitHub CLI credential with
`gh auth token --hostname github.com` and pass it to the exact
[Postern bundle](../../vendor/postern/README.md). No credential is printed.
PullRequests owns PR reads, reviews, queue checks and merge writes; Access
retains GitHub check links, workflow attempt times, push activity and inline
review-comment facts that the neutral ports do not expose. Access reads use
the expected head SHA and paginate. A failed read fails without a merge.
