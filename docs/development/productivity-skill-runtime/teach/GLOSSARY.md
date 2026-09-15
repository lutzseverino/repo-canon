# Git ancestry glossary

Terms the learner has demonstrated in the release-baseline mission.

## Terms

**Ancestor**:
A commit reachable by following parent links from another commit.
_Avoid_: Older commit

**Ancestry guard**:
A release decision that tests whether a required baseline is an ancestor of a candidate commit.
_Avoid_: Date check, timestamp check

**Exit status**:
The code a command returns to classify its result; for the ancestry guard, `0` permits, `1` rejects normally, and another nonzero value is an operational error.
_Avoid_: Error code
