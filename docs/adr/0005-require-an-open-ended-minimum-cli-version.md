# Require an open-ended minimum CLI version

`standards.yaml` declares `requires.repo-standards` as an open-ended minimum,
currently `>=5.0.0`, naming the oldest public Repository Standards CLI this
source was validated against. Repository Standards evaluates that requirement
only when an adopter selects a standards version and never re-validates it
afterwards, so an exact or upper-bounded requirement strands established
adopters in both directions: their pinned CLI cannot select the next standards
version, and a newer CLI cannot read the standards version they already retain.
`v0.2.0` shipped the exact form and had exactly that defect. The cost of the
minimum is that an adopter can run a CLI this source was never tested against;
the `repo-standards/v2` format version carries compatibility above the floor
instead of the author. The alternative of an upper-bounded range was rejected
because it recreates the deadlock at the upper end.

Raising the minimum is therefore not a breaking standards change.
[ADR 0003](0003-follow-product-release-versioning.md) tests compatibility
against the adopting repository's conformance and workflow, and neither moves:
an adopter that does not update its CLI keeps the standards version it already
selected, conforming exactly as before. On its own, such a change is committed
as a `chore` and published as a patch release; a release that also carries
breaking changes is versioned for those.

## Consequences

- [Release versioning](../usage/versioning.md#the-required-cli-version) states
  the requirement's form and bump class for adopters.
- The published [`v0.2.0` release](https://github.com/lutzseverino/repo-canon/releases/tag/v0.2.0)
  keeps its exact requirement and its breaking-change note; this decision
  reverses that classification for later releases rather than rewriting it.
- Widening never lowers the floor. A CLI below the declared minimum is rejected
  exactly as before; what the minimum newly admits is CLI releases above it,
  which this source was not validated against.
- Opinions about when an adopter should update its CLI stay out of the source
  and belong in the agent guidance Repo Canon publishes.
