# Keep the implementation contract in the issue body

Every implementation contract lives in its issue's body. Triage writes a
request's Agent Brief over the body and keeps the reporter's text verbatim
under an "Original request" heading; the platform keeps the body's edit
history. Contracts had two homes, the body of a directly authored ticket and
the latest Agent Brief comment of a triaged request, and agents bound to the
wrong one (repo-canon #866, a homelab #345 binding error). One home that people
and agents read first removes the choice. The owner settled it in grill G2 of
2026-11-06. Rejected: always a comment, which leaves every ticket's body a stub
and keeps the reader searching comments for the current revision.

## Prepared-mode selection amendment

The owner approved the content-selection alignment on 2026-11-26 at 19:18 UTC,
20:13 UTC and 20:33:16 UTC in
[#1252](https://github.com/lutzseverino/repo-canon/issues/1252). Before explicit
body-mode activation, a structurally recognized direct specification/ticket
body takes precedence, even when malformed; otherwise the newest Agent Brief
comment by any author is selected, otherwise the body. Recognition precedes
required-section validation, so correction never silently selects another
contract. Category labels are classification only, never selection, kind,
revision, validity or readiness inputs. This amends
[ADR 0029](0029-make-the-validators-posted-result-the-only-contract-decision.md)'s
category-dependent rule without moving its single interpreter.

Direct-body precedence preserves the intent of this ADR and
[ADR 0053](0053-let-factory-triage-accept-a-direct-contract-it-reviewed.md): an
older brief beside a later direct ticket cannot take the ticket's place.
Rejected: newest brief unconditionally, which revives superseded briefs;
body/comment timestamp contests, which add ordering ambiguity; and a validity
fallback, which hides malformed selected contracts. Any-author selection keeps
the hand triage route and adopters without a factory. An edited brief stays
selected at a new authenticated source version requiring fresh notice and
review, without inherited factory self-acceptance; factory identity determines
authority, never selection.

The body-mode cutoff remains authoritative: exact unchanged inventoried legacy
eligibility, authenticated intake/edit history, migration and retirement holds,
one verbatim Original request and non-resurrection all remain. Prepared
precedence cannot escape those states. Unchanged selected sources retain their
hashes, while an actual selected-source/edit transition ends the v1 approval
permanently, including edit-and-restore, same-second edits and deletion, even
when restoration repeats the v1 content hash.
Missing authenticated edit proof confers no factory authority. The separate
v5 grant and stop-model work in #1251 is not part of this amendment.
