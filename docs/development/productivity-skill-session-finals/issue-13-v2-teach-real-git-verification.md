Both corrected patterns passed with real Git:

| Case | Git status | Guard exit | Sentinel reached |
| --- | ---: | ---: | --- |
| Sibling commits: ordinary rejection | 1 | 1 | No |
| Invalid revision: operational failure | 128 | 128 | No |

I initialized a temporary repository, created an empty tree using `git mktree`, then used `git commit-tree` to create a root and two commits sharing that parent. `git merge-base` confirmed their common root.

For each case, I ran `git merge-base --is-ancestor "$baseline" "$candidate"` directly, then executed each HTML document’s extracted guard using `sh`, followed by `printf 'SENTINEL_REACHED\n'`.

Status 1 correctly rejected the candidate; status 128 preserved the operational failure and stopped execution.

The disposable repository was removed. No teaching-workspace files or history were changed.