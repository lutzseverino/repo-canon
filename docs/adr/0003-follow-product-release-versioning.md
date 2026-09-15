# Follow the product's release versioning convention

Use Semantic Versioning for Repo Canon releases to align the standards source
with Repository Standards, the product through which maintainers adopt it.
The owner prefers this consistency after considering Romantic Versioning;
choosing before the first publication gives adopters one interpretation of
future version changes.

Compatibility concerns the adopting repository's conformance and workflow.
New mandatory migration work or incompatible workflow requirements are breaking
standards changes even when the adopting application's runtime is unaffected.
During initial development, features and breaking changes advance the `0.x`
minor version, while compatible fixes advance the patch version. Explicit
breaking-change notes preserve the distinction within those minor releases.

Repository Standards' observed release practice supports this choice:
[1.1.0 added authoring features](https://github.com/lutzseverino/repo-standards/blob/acd84f786343b72813ee5d00d545e0f103891ff5/docs/release.md#authoring-feature-delivery),
and [1.0.1 clarified publication prerequisites and acceptance evidence](https://github.com/lutzseverino/repo-standards/releases/tag/v1.0.1).
The inspected product documentation does not state a comprehensive release-bump
policy; Repo Canon explicitly selects [SemVer 2.0.0](https://semver.org/).
