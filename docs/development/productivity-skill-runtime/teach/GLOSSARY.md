# Git ancestry Glossary

Canonical language for deciding whether a release candidate contains a required commit.

## Terms

**Ancestor**:
A commit reachable by following parent links from another commit.
_Avoid_: Older commit

**Exit status**:
The number returned by a command to report its result. For `git merge-base --is-ancestor`, `0` means true, `1` means false, and any other non-zero value is an error.
_Avoid_: Output code, failure-only code
