# Let factory triage accept a direct contract it reviewed

Status: accepted (2026-11-16).

This extends [ADR 0030](0030-let-factory-triage-accept-its-own-brief.md). The
factory's triage run may accept a directly authored specification or
implementation ticket that it reviewed and did not write, at the exact body
revision it reviewed. A Canon-owned **factory review attestation** backs that
readiness. It is a comment by the factory's configured triage author that names
the run, the repository, the issue, the exact `sha256:` revision and the body
source the validator's notice names. The issue-contract validator approves the
factory's readiness only after a notice for that revision has named the
attestation. Readiness stays bound to that revision, so an edit to the body
removes it, as for any contract. The attestation authorizes nothing on a
triaged Agent Brief, whose own proofs are unchanged.

Since repo-canon #1111, factory triage of a direct contract writes no Agent
Brief and asks for no `type:` label, because the body is the contract
([ADR 0035](0035-keep-the-implementation-contract-in-the-issue-body.md)).
ADR 0030's exception covered only the brief the factory posted, so a direct
contract the triage run found holding still waited for a person's hand
acceptance. On 2026-11-16 at 19:15 UTC the owner answered "let's follow your
suggestions" to the recommendation "1b, 2c, 3a". Q1 b reads: "Extend ADR 0030.
Factory triage may accept a direct specification or ticket it reviewed and did
not write, at the exact body revision it reviewed. Readiness stays bound to
that revision, and an edit removes it." Repo Canon owns the rule, the triage
skill's factory step and the validator check, and owns the attestation's
format. A host such as Scriptorium
posts the attestation through Canon's installed issue-contract module, waits
for the validator's notice naming that revision, then applies readiness. Canon
releases and is adopted first.

ADR 0030's risk statement still holds: a bad acceptance "costs one implement
run, never a bad merge". The review run's Spec review still reads the contract
against the issue. The run that wrote an issue never accepts it, under the same
writer check that applies to the factory's own brief.

## Considered options

- Accept on the factory author's label alone: rejected, because a bot identity
  supplies no authority, and the label would not name the run or the revision
  it reviewed.
- Reuse the body-mode publication proof: rejected, because that proof
  certifies a published Agent Brief and its preserved intake, not a review of
  an existing body.
- A format each host restates: rejected, because two implementations drift
  ([ADR 0029](0029-make-the-validators-posted-result-the-only-contract-decision.md)).
  Canon's installed module produces and verifies the attestation, and the host
  imports it in one direction only
  ([ADR 0047](0047-read-nothing-scriptorium-owns.md)).

## Consequences

- The Readiness roles rules extend the factory's exception to a direct
  contract. Without a factory triage configuration, readiness still comes only
  from the roles, and a person's acceptance is unchanged.
- A notice that names an attestation publishes the `v4` result format around
  its `v1` or `v2` base, so a host reads the attestation the validator observed
  from the state line alone. Every other result keeps its base format.
- An edited or deleted attestation backs no readiness, and an approval that
  relied on it is removed.
- Until a host posts attestations, the orchestrating agent applies readiness
  after factory triage's independent review finds the revision holding, as the
  owner's interim on 2026-11-16 decides.
