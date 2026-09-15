# Release versioning

Repo Canon uses [Semantic Versioning 2.0.0](https://semver.org/), following the
release convention of the Repository Standards product. The
[versioning decision](../adr/0003-follow-product-release-versioning.md) records
why this scheme was selected. Repo Canon versions identify the standards source;
the supported CLI version is a separate compatibility requirement recorded in
the [source profile](../development/source-profile.md).

## Compatibility for adopters

A breaking standards change makes a previously conforming repository require
new mandatory migration work or an incompatible workflow change to remain
conforming. Adding a required README section that makes existing conforming
repositories fail is breaking, even if their applications still run normally.

Release notes identify breaking requirements and explain their migration.
Published source versions retain their original contents; corrections receive
a new version.

## Before 1.0

Versions beginning with `0` indicate initial development. Repo Canon uses the
following bump convention during this period:

| Change | Example next version |
| --- | --- |
| Compatible fix | `0.1.0` to `0.1.1` |
| Compatible feature | `0.1.0` to `0.2.0` |
| Breaking standards change | `0.1.0` to `0.2.0` |

A middle-number bump can contain either compatible features or breaking changes;
read the release notes before selecting it for adoption.

## From 1.0

Breaking standards changes advance the major version. Compatible features
advance the minor version, and compatible fixes advance the patch version.

## Selecting an adoptable release

The supported CLI requires a published GitHub release with a version such as
`v0.1.0`, without a prerelease suffix or GitHub prerelease designation. An
ordinary `0.x` release remains an initial-development version; publication does
not establish a `1.0` compatibility promise.

Follow [Adopt Repo Canon](adopt-repo-canon.md) to inspect the selected version
and confirm its repository-specific adoption scope.
