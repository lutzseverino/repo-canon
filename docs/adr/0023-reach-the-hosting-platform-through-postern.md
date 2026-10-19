# Reach the hosting platform through Postern

Scriptorium, Repository Standards and Repo Canon's scripts reach the hosting
platform through one independent hosting platform package: public repository
`lutzseverino/postern`, npm package `@lutzseverino/postern`. Each consumer depends
on the package; none depends on another consumer. This keeps the shared platform
boundary out of any one consumer and lets it evolve under its own compatibility
promise. The [settled decisions on #504](https://github.com/lutzseverino/repo-canon/issues/504#issuecomment-6244638871)
are the source of the fifteen decisions below. Postern is the product name for
the repository and package; prose describes it as the hosting platform package.

Implementation waited for the launch work: releases, Node.js 26 and the front
door. The owner removed the outside-adopter item on 2026-10-18, and the gate was
met on 2026-10-19, as [#504](https://github.com/lutzseverino/repo-canon/issues/504)
records. This ADR records the decisions; implementation belongs to separate
tickets.

## Package and ports

1. **Independent releases.** The package has its own SemVer releases and is
   published to npm from its first release. Consumers pin a major version;
   a breaking port change requires a new major.
2. **One port per concept.** The four concepts are issue tracker, pull requests
   (the `PullRequests` port), release source and access. Each port has capability
   flags; an absent flag means the feature is not offered. Errors use a closed
   set of reasons. The package detects the platform from the Git remote. GitHub
   is the only adapter until a second platform is wanted, and every adapter
   must pass the package's contract-test suite.
3. **Adoption order.** Scriptorium adopts first, then Repository Standards, then
   Repo Canon's scripts, so each integration follows the earlier consumer's
   experience.
4. **Vocabulary.** Use hosting platform, or platform for short; avoid forge.
   Pull request remains canonical, with `PullRequests` as the port name;
   avoid change request, while recognizing GitLab's spelling, merge request.
   A platform adapter implements the package's ports for one platform. No port
   method is named `release`.
5. **Relationships.** The issue tracker port returns `parent` and `blockedBy`.
   The adapter reads native links where offered and named body sections
   otherwise; `nativeParent` and `nativeBlockers` identify native support.
   Consumers supply section names as an adapter option with no default. Repo
   Canon and Scriptorium pass `Parent` and `Blocked by`; without the option, a
   platform without native links reports no relationships. The factory core
   never parses an issue body, so interpreting platform relationships stays
   at the adapter boundary.
6. **Shaping targets.** Forgejo shapes the ports. GitLab Free is a second
   shaping target as a design check: every port must have a workable GitLab
   Free implementation, rather than merely reporting absence. The order in
   which the additional adapters are built stays undecided.

## Distribution, setup and configuration

7. **Scripts without installation.** Repo Canon vendors one bundled ESM file
   at an exact version and installs it as an exact file beside the scripts
   that use it, following the `vendor/marked/marked.esm.js` precedent. Every
   version bump is reviewed. The package therefore has zero runtime
   dependencies and builds to a single file, allowing those scripts to run
   without an install step.
8. **Remote setup.** There is no repository-settings port: merge rules differ
   too much across platforms for one interface. Repo Canon retains per-platform
   remote-setup fixes and probes, using the access port only for authentication
   and transport.
9. **Platform choice within profiles.** An adopting repository chooses its
   profile and its platform separately, through a mechanism owned by Repository
   Standards. Per-platform profiles such as `react-github` and `react-gitlab`
   would multiply profiles. Published files stay GitHub-shaped until a second
   adapter exists.
10. **Configuration ownership.** Scriptorium owns its settings. Repo Canon's
    factory profile supplies their defaults, preserving the boundary between
    the product and the conventions this source selects.

## Timing, identity and triggers

11. **Readiness timing.** The port returns the body's last-edit time and the
    link time only where offered, behind `bodyEditTime` and `linkTime`. Where a
    time is absent, the issue-contract trigger invalidates readiness as events
    arrive: editing a ready issue's body removes its readiness; a ticket gaining
    or changing a `Parent` section removes its parent's readiness. On Forgejo,
    a missed event can leave stale readiness in place. This weaker guarantee is
    accepted; a content fingerprint remains a fallback if that risk appears in
    practice, rather than a requirement now.
12. **Platform roles.** The adapter returns the platform's own role names, and
    the host configuration lists accepted roles for each platform. There is no
    neutral role vocabulary. On Forgejo, the factory's token needs admin rights
    on every repository it serves.
13. **Bot identity.** The adapter marks bots where the platform can, behind
    `botMarking`. The host configuration also names accounts that never
    authorize; this list is required on a platform without bot marking. The
    Forgejo adapter always treats `forgejo-actions` as a bot.
14. **Issue-contract trigger.** One platform-neutral validator command reads
    one neutral issue event, translated by the adapter. Adoption installs a
    thin trigger selected by the platform: a GitHub workflow, a Forgejo
    workflow, or a GitLab project webhook to the pipeline trigger URL with a
    service-account token and a scheduled pipeline fallback. The GitLab adapter
    ticket first proves that an issue-event webhook can start a pipeline.
    GitLab Free issue templates are Markdown only, so the validator enforces
    their required sections.

## Public scope and policy boundary

15. **Usable by anybody.** The package is public and MIT-licensed, like its
    three consumers, and assumes no Repo Canon convention. It reports facts
    only: label events with actors and times, roles, edit times and links.
    Readiness, the frontier and authorization remain in Scriptorium. Its ports
    cover what its consumers need; it is not a general API client for every
    platform feature. Outside users receive that same scope under the same
    SemVer promise, without depending on Repo Canon's conventions.

## Consequences

- Platform facts and consumer policy evolve separately. A missing capability
  must remain visible to the consumer, including the accepted weaker timing
  guarantee; a shared interface does not manufacture platform evidence.
- The GitHub tracker seed in
  [ADR 0008](0008-install-skill-setup-files-verbatim-from-upstream-seeds.md)
  becomes the GitHub platform's seed. The issue tracker port's relationships
  replace the GitHub-specific relationships in
  [ADR 0012](0012-run-each-ticket-as-its-own-factory-run.md).
- [ADR 0014](0014-name-every-factory-convention-in-configuration.md) is
  clarified, not reversed: native links where offered and consumer-named body
  sections otherwise are interpreted by the adapter, never the factory core.
- Separate platform choice resolves the profile-multiplication question in
  [ADR 0017](0017-make-the-factory-an-optional-profile.md).
- [ADR 0006](0006-keep-point-in-time-records-with-their-event.md),
  [ADR 0010](0010-carry-delivery-rules-in-the-environment.md) and
  [ADR 0015](0015-configure-the-pull-request-reviewer-as-repository-data.md)
  retain their decisions with platform wording clarified. Under
  [ADR 0007](0007-keep-superseded-adrs.md), amendments retain each record and
  its reasons, marking only superseded portions.
- [ADR 0013](0013-install-the-factory-on-the-host-from-its-own-releases.md)
  stays unchanged: since
  [ADR 0020](0020-release-the-factory-from-its-own-repository.md), its release
  tags concern Scriptorium's own repository. The other products record their
  own decisions; this record implements no adapter, consumer integration,
  package publication, workflow change or host change.
