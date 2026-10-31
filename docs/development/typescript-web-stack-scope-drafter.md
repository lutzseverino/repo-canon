# TypeScript web stack scope drafters

Inspection runs the Astro and Vite discovery entry points against a copy of
kept repository files. Each accepts a `repo-standards/discovery/v1` request
and emits one `repo-standards/scope/v2` declaration entry: candidates with
paths, decisions, reasons and kept evidence, unresolved questions, and
`noScope: true` when no Project is included. They never write the repository.

All three stack drafters share Project/workspace enumeration and conservative
maintained-root evidence. An independently maintained web root is assessed
alongside members; shared-only roots supply facts. Standalone and catalog-only
roots remain Projects. Existing fixture/vendor exclusions and unreadable YAML
questions are preserved.

Web classification reads local manifests, configuration, descriptions, READMEs
and sources. Astro configuration plus dependency evidences a Site; Vite and
React require semantic App evidence from descriptions or browser routing and
state sources. This is a proposal, with remaining semantics assessed before
confirmation. A Vite-built Site remains outside every stack; ambiguous web
candidates are excluded with an unresolved question rather than sent to Node.

Workspace consumers establish shared packages, including framework-less ones.
Non-web consumers keep a package outside the web-only category. Only in-stack
web consumers choose a stack, with Astro winning when both apply; no-stack
Sites do not compete. No known in-stack consumers keeps a web package
unresolved. The draft proposes only Projects whose checked facts match;
existing differing Projects are excluded with named corrections for separate
migration. Adoption must assess the rest of the rules before confirming scope.

Run `node --test test/typescript-web-stack.test.mjs` for Sites, Apps, shared
holders and non-UI packages, mixed consumers, no-stack Sites, uncertain
membership, roots, catalogs and retained resources. The
[Node drafter](typescript-node-stack-scope-drafter.md) uses the same helper to
exclude web membership. Scope proposals must keep all three stacks disjoint.
