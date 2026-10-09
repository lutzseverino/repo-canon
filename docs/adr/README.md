# Architecture decisions

This directory records, in numbered brief entries, the decisions whose reversal
has meaningful cost, whose rationale would otherwise be surprising, and which
involve real alternatives.

- [Manage shared skills through standards releases](0001-manage-shared-skills-through-standards-releases.md):
  the source owns pinned snapshots of the upstream skills and distributes their
  updates through its releases.
- [Squash reviewed changes into the default branch](0002-squash-reviewed-changes.md):
  Conventional Commit titles and squash merges that keep the reviewed title and
  description as the final message.
- [Follow the product's release versioning convention](0003-follow-product-release-versioning.md):
  Semantic Versioning, with compatibility judged by the adopting repository's
  conformance and workflow.
- [Adopt published releases of this source](0004-adopt-published-releases-of-this-source.md):
  Repo Canon adopts its own standards from a published release through the
  public CLI, never from its working tree.
- [Require an open-ended minimum CLI version](0005-require-an-open-ended-minimum-cli-version.md):
  the required CLI names the oldest validated version with no upper bound.
- [Keep point-in-time records with the event they record](0006-keep-point-in-time-records-with-their-event.md):
  documentation holds maintained material only, and records stay with their
  pull request, release, or CI run.
- [Keep superseded ADRs](0007-keep-superseded-adrs.md): a superseded ADR stays,
  marked with the ADR that supersedes it, while other superseded documents are
  deleted.
- [Install skill setup files verbatim from upstream seeds](0008-install-skill-setup-files-verbatim-from-upstream-seeds.md):
  the issue tracker, triage label, and domain configurations are the vendored
  upstream setup seeds, installed byte for byte.
- [Enforce documentation rules as checks](0009-enforce-documentation-rules-as-checks.md):
  the documentation check enforces the index entry form, one index per
  document, the development guide's order, and scope coverage.
- [Carry delivery rules in the environment and keep skills short](0010-carry-delivery-rules-in-the-environment.md):
  the contribution guide and one `AGENTS.md` line carry delivery, the delivery
  skill is deleted, and the short `babysit` skill takes a pull request to its
  merge.
