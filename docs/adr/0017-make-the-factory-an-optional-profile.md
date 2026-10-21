# Make the factory an optional profile

Status: its hosting-platform profile-multiplication assumption is superseded
by [ADR 0023](0023-reach-the-hosting-platform-through-postern.md), and its
project-stack consequence is amended by
[ADR 0024](0024-scope-each-stack-to-the-projects-that-use-it.md); the two profiles and their purpose stand.

Repo Canon offers two profiles: the standard profile, which every adopting
repository can select, and the factory profile, which adds the factory's
repository files, `.factory/config.json`, `.factory/Dockerfile`, and the
sandbox image workflow, for a repository that a factory serves. The factory is
a host-installed product of its own, as
[ADR 0013](0013-install-the-factory-on-the-host-from-its-own-releases.md)
decides, yet the
[factory boundary specification](https://github.com/lutzseverino/repo-canon/issues/334)
still gave every adopting repository its configuration and a toolchain image to
write and keep. Repository Standards profiles do not combine, so an optional
part is a second whole profile. Two alternatives were rejected: installing the
factory's files in every adopting repository, because a repository with no
factory then carries configuration nothing reads and an adoption step it
cannot use; and an add-on mechanism in Repository Standards, because one
optional part does not justify combining profiles.

## Consequences

- The `complete` profile becomes `standard`; with no outside adopters to
  migrate, the rename needs no compatibility path.
- The split ships in the breaking release that removes `.sandcastle/`, with
  the skill removals of
  [ADR 0018](0018-install-only-workflow-skills.md), so adopters cross one
  breaking change rather than several.
- Rules that only a factory needs, such as re-applying a parent's readiness
  and model labels, leave `CONTRIBUTING.md` for the factory profile's rules
  once installed rules exist.
- The original concern that a second optional dimension would multiply whole
  profiles is resolved for hosting platforms by [ADR 0023](0023-reach-the-hosting-platform-through-postern.md): an adopting
  repository chooses the platform separately inside each profile, through
  Repository Standards. [ADR 0024](0024-scope-each-stack-to-the-projects-that-use-it.md)
  resolves the project-stack dimension: stacks are discovered declarations
  scoped per Project, so they need no profile composition. Published files remain GitHub-shaped until a second
  adapter exists.
