# Historical proposal: resolve project-specific contextual scope before adoption

Status: superseded by the delivered product contract. Product
[#41](https://github.com/lutzseverino/repo-standards/issues/41) and delivery
[#50](https://github.com/lutzseverino/repo-standards/issues/50) are complete;
the owner's [acceptance reconciliation](https://github.com/lutzseverino/repo-standards/issues/41#issuecomment-5664401656)
records final 1.2.1 acceptance. Use [adoption compatibility](adoption-compatibility.md)
for Repo Canon's supported v2 mapping and remaining source responsibilities.

The original proposal and CLI 1.1.0 experiment results follow as historical
design context. Their present-tense limitations describe that earlier product;
they do not assign new product design or block Repo Canon implementation.

## Problem Statement

A reusable standards source cannot currently govern project READMEs in
arbitrary monorepo layouts. It also cannot reorganize arbitrary existing
documentation while exact declarations own shared files inside the same docs
tree. The author format requires explicit disjoint targets, rejects glob/root
targets, and treats an exact descendant as conflicting with contextual parent
scope. Contextual assessment enforces those same limits.

The author has explicitly chosen location-independent project discovery and
exact shared configuration. Narrowing coverage or changing ownership would
alter the accepted standards rather than implement them.

## Solution

Add a product-owned way to resolve an author's contextual intent into concrete
adopting-project targets before confirmation. Keep exact ownership and reserved
storage protected while representing documentation sources and destinations.

The precise author-format and public-interface changes require product design;
this specification does not add fields to repo-standards/v1 or permit custom
author adoption hooks. Any contract change must be explicit and versioned
through the product's normal issue and implementation workflow.

## User Stories

- An author can publish one source that covers maintained project READMEs
  without encoding adopting repositories' directory layouts.
- An adopter can review the actual affected paths before any contextual work
  is authorized.
- An adopter can reorganize old documentation into the agreed categories
  while preserving exact shared configuration and unrelated content.
- An existing adopter using explicit disjoint targets retains current behavior.

## Acceptance criteria

- The same source and profile cover maintained projects at unfamiliar paths
  such as clients/mobile and tools/compiler, including a project whose README
  must be created. Fixtures, generated output, and organizational directories
  are not treated as projects merely because they contain a README.
- Inspection reports the concrete contextual scope and its protected exact
  content before confirmation. It remains read-only and runs no author code.
- Documentation can move from docs/how-to and docs/architecture.md to agreed
  destinations while exact docs/agents configuration remains byte-identical.
- Evidence accounts for removed, created, and edited paths. Out-of-scope work
  is rejected, including newly discovered targets not bound to confirmation.
- Changes affecting scope resolution invalidate stale confirmation. Changes
  between contextual assessment and completion retain the existing freshness
  requirements.
- Reserved state, Git metadata, symlinks, profile exclusions, exact-content
  integrity, and unrelated project files retain their protections.
- Existing explicit-target sources and profile resolution continue to work.
- The public installed CLI demonstrates these outcomes on supported platforms.

## Testing Decisions

Use the installed CLI against real temporary Git repositories. Include multiple
layouts under the same source, old documentation categories, exact descendants,
missing project READMEs, false-positive fixture directories, stale scope,
attempted out-of-scope writes, and successful contextual evidence.

The current public CLI 1.1.0 was exercised in disposable source fixtures:

| Case | Observed result |
| --- | --- |
| Glob README target | Exit 1, UNSAFE_PATH |
| Repository-root directory target | Exit 1, UNSAFE_PATH |
| Contextual docs plus exact docs/agents file | Exit 1, TARGET_OVERLAP |
| Explicit disjoint known locations | Exit 0, valid true |

These results demonstrate the present limitation and the supported explicit
case. They are not tests of the proposed feature or of the personal source.

## Out of Scope

Personal-standard policy changes, automatic project commits, integrated AGENTS
preparation, remote-state ownership or rollback, arbitrary author adoption
hooks, weakening existing protections, and publication of the personal source.

## Historical blocker

At proposal time, no implementation ticket existed and the product-owned scope
interface and architecture-contract change still required approval. That
dependency is now satisfied by the product issues linked above.

## Further Notes

See [adoption compatibility](adoption-compatibility.md) for source references
and the separately chosen preparation and GitHub-setup routes.
