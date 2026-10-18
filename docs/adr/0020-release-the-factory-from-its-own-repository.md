# Release the factory from its own repository

The factory, Scriptorium, moved out of this repository's `factory/` directory
into its own public repository,
[`lutzseverino/scriptorium`](https://github.com/lutzseverino/scriptorium), with
its package at the root, and is released from there. This supersedes the parts
of [ADR 0013](0013-install-the-factory-on-the-host-from-its-own-releases.md)
that kept the factory here: its location, its rejection of a separate
repository, and the trigger it set for moving. Its host-installed releases,
owner-only tags, single process per host and independent release boundary
stand. None of 0013's triggers prompted the move; the owner decided it on
2026-10-17, as the
[separation issue](https://github.com/lutzseverino/repo-canon/issues/506)
records. Sharing the repository made Repo Canon harder to explain to a
newcomer, split one issue tracker and CI between two products, and would have
started factory-owned work, such as the hosting-platform seam, inside the
standards source. The `factory/` history was exported with
`git filter-repo --subdirectory-filter factory` from commit
`80355eb3cd0069070a070fafb28e517ac6f7ce28`, the target of
`scriptorium-v1.0.5`, and its stream continues there from
`scriptorium-v1.0.6`; Scriptorium's own
[ADR 0002](https://github.com/lutzseverino/scriptorium/blob/main/docs/adr/0002-release-scriptorium-from-its-own-repository.md)
records the product side.
Two alternatives were rejected: moving the factory profile with the package,
because the profile installs repository conventions, which
[ADR 0014](0014-name-every-factory-convention-in-configuration.md) and
[ADR 0017](0017-make-the-factory-an-optional-profile.md) keep in Repo Canon;
and waiting for the Node.js 26 work to land first, because nothing under
`factory/` was in flight, so the move cost the least then.

## Consequences

- Repo Canon keeps the `factory` profile, its `.factory/` files and toolchain
  image rules, and the root boundary terms: Factory, Frontier, Readiness, Host
  configuration, Factory configuration, Standard profile, Factory profile and
  Pull request reviewer. The factory's internal language and decisions moved
  with it, so this repository returns to a single glossary context; its
  [ADR 0001](https://github.com/lutzseverino/scriptorium/blob/main/docs/adr/0001-keep-the-package-outside-repo-canon-release-inputs.md),
  which kept the package here, stays there, marked superseded.
- `scriptorium-v1.0.0` through `scriptorium-v1.0.5` and their releases stay in
  this repository at their original objects, under its tag ruleset, and are
  never moved, deleted or republished. No further factory release is published
  here.
- Repo Canon imports no factory code: its conformance tests assert the shipped
  factory configuration against version 1 of the schema, and Scriptorium tests
  its own parser.
- A change spanning both products takes one linked issue in each repository,
  and each product releases its own part.
