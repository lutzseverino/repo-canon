# Keep superseded ADRs

An ADR is never deleted. When a later ADR supersedes it, the older ADR stays
with a status line under its title that names and links the ADR superseding it;
every other superseded document is still deleted and its links repaired.
Deleting superseded documents keeps documentation to maintained material, but
applied to ADRs it deleted an adopting repository's decision record, as the
[`v0.4.0` specification](https://github.com/lutzseverino/repo-canon/issues/122)
records, and lost the reasoning behind a reversal that an ADR exists to keep. A
superseded ADR is therefore maintained material: its status line stays current,
and it is not a point-in-time record under
[ADR 0006](0006-keep-point-in-time-records-with-their-event.md). Two
alternatives were rejected: relying on Git history, because a deleted ADR no
longer appears in the index and a reader of the superseding ADR cannot find
what it reversed; and moving superseded ADRs to a separate archive, because it
keeps them under exactly the historical label the documentation rules forbid.

## Consequences

- ADR directories grow with every reversal, and their indexes keep listing
  superseded ADRs.
- The [contribution guide](../../CONTRIBUTING.md#documentation) states the rule
  and its exception to deleting superseded documents.
- It adds no migration work. A repository that deleted a superseded ADR before
  this decision needs no restoration; Git history retains the deleted record.
