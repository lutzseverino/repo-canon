# Read nothing Scriptorium owns

Status: accepted (2026-11-13); amends
[ADR 0033](0033-give-every-value-one-value-owner.md): Scriptorium, not Repo
Canon, supplies the schema and check of the repository model policy it reads.

Repo Canon's scripts and rules read no format Scriptorium owns. The merge and
readiness commands use the standard labels Repo Canon itself provisions
instead of reading Scriptorium's configuration, and the issue-contract
validator reads a contract from its own sections and ignores the factory's
frame. Scriptorium owns the formats of its configuration, its repository model
policy and its result footer; Repo Canon owns the lead line, the status
markers and the issue contract. Repo Canon keeps only its rule for choosing a
model (fit first, then narrower, then cheaper) and links Scriptorium's
documentation for resolution and diversity. Where Scriptorium needs Repo
Canon's contract protocol, it imports the issue-contract module Repo Canon
installs in a repository that adopts Repo Canon, in that one direction only.

The owner agreed on 2026-11-13: "Agreed to all", after "Be strategic,
long-term thinking, as always. And don't couple projects." (2026-11-12).
Copying another project's format had kept the coupling (two parsers, two
contract texts, lockstep merge and release orders) without a seam a test could
cross.

## Considered options

- One Repo Canon reader module for Scriptorium's configuration, tested against
  its schema: rejected, because it keeps Repo Canon parsing a format it does
  not own.
- Each owner publishing a module the other vendors: rejected, because Repo
  Canon's scripts need only label names Repo Canon already defines, and
  vendoring in both directions would make a cycle.

## Consequences

- The deferred seam "Scriptorium configuration reads" and its markers go with
  the readers.
- Repo Canon's structural contract for the repository model policy, and its
  reader and check, are deleted; Scriptorium validates the file it reads.
