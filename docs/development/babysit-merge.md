# Babysit merge script

The `babysit` skill runs `.agents/skills/babysit/merge.mjs` after its wait and
review steps establish the merge conditions in
[the contribution guide](../../CONTRIBUTING.md#merging).

Run `node .agents/skills/babysit/merge.mjs <number> <head SHA>` from the
repository root, passing the full SHA reported by the wait script. The merge
script reads the current PR title, body, and head through `gh pr view`, then
calls `gh pr merge` with `--squash`, `--match-head-commit`, and an explicit
subject and body. The subject is `<title> (#<number>)`; the body passes verbatim
through stdin with `--body-file -`, preserving quotes, backticks, dollar signs,
line endings, and multiple paragraphs. No shell interprets the metadata.
GitHub's default squash message therefore does not add co-author trailers.

Exit `0` means merged. Exit `2` means the head changed, either before the merge
call or when a refused merge is followed by a read showing a different head;
the skill returns to its wait step. Exit `1` reports an invalid invocation or
a `gh` error, including a merge refusal with an unchanged head. Each `gh` call
has a 45-second timeout.

Run `node --test test/babysit-merge.test.mjs` for the executable fixtures. They
use the same fake `gh` as the wait tests and cover the explicit message,
verbatim body, head changes, empty bodies, invalid arguments, access errors,
and merge refusals. The whole skill directory is installed by its exact skill
declaration, including both scripts and the reviewer module.
