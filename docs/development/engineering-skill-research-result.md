# Git ancestry checks

`git merge-base --is-ancestor A B` checks whether commit `A` is an ancestor of
commit `B`. [Git's `git-merge-base` manual](https://git-scm.com/docs/git-merge-base#_operation_modes)

| Exit status | Meaning |
| --- | --- |
| `0` | Yes: `A` is an ancestor of `B`. [Git's `git-merge-base` manual](https://git-scm.com/docs/git-merge-base#_operation_modes) |
| `1` | No: `A` is not an ancestor of `B`. [Git's `git-merge-base` manual](https://git-scm.com/docs/git-merge-base#_operation_modes) |
| Any non-zero status other than `1` | An operational error; the manual does not assign one specific error code. [Git's `git-merge-base` manual](https://git-scm.com/docs/git-merge-base#_operation_modes) |
