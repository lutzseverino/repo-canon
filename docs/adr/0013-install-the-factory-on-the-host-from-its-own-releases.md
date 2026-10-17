# Install the factory on the host from its own releases

Status: its location in this repository's `factory/` directory, its rejection
of a separate repository, and its trigger for moving are superseded by
[ADR 0020](0020-release-the-factory-from-its-own-repository.md).

The factory is a product of its own, named Scriptorium, kept in this
repository's `factory/` directory and released there under its own version numbers as
`scriptorium-vX.Y.Z` tags. A host installs one major, updates to its newest
release on its own, and runs a single factory process that serves all the
repositories its host configuration lists. A repository carries only its factory
configuration and its sandbox Dockerfile in `.factory/`. Shipping the factory
as exact files with the standard, as
[ADR 0011](0011-ship-the-factory-with-the-standard.md) decided, made every
factory fix a Repo Canon release and one adoption pull request per adopting
repository: 6 of the 11 releases after the factory shipped changed it, and
21 adoption commits landed in about 47 hours. It also let each repository run
its own factory version, and gave each repository's instance the host's full
provider caps, as the
[factory boundary specification](https://github.com/lutzseverino/repo-canon/issues/334)
records. Four alternatives were rejected: a separate repository now,
because the factory has no user outside the owner's repositories and a
repository, release train and cross-repository coordination cost one
maintainer more than they return; publishing to a package registry, because a
tag the host checks out needs no infrastructure; pinning an exact version on
the host, because every fix would then wait for a host change, where fixes
used to reach the host unattended; and one factory process per repository,
because caps and usage gates bound a subscription, not a repository.

## Consequences

- A factory fix is a factory release, and Repo Canon releases carry only
  standard changes. A breaking factory release is a new major, which the host
  adopts deliberately.
- Only the owner creates or updates `scriptorium-v*` tags, under a repository
  ruleset; agents never tag. A tag decides what code the host runs, so whoever
  could push one could run code on the host.
- The factory owns its clones, worktrees, logs, sandbox images and credential
  delivery in its own state directory, and the host keeps only its service
  setup, the credential files and the host configuration.
- The factory builds its own agent layer on top of the repository's toolchain
  image, so agent CLI versions follow the factory release, and Repo Canon no
  longer ships a sandbox base.
- The factory no longer adopts standards updates. It ran them only to update
  itself, and doing so taught it the Repository Standards CLI's reports and
  Repo Canon's adoption rules. Agent sessions adopt updates as direct changes.
- Moving the factory to its own repository waits for a trigger: a user outside
  the owner's repositories, factory changes still driving most Repo Canon
  releases, or vendor terms that change what a self-hosted factory may hold.
