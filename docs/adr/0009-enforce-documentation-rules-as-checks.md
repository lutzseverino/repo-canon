# Enforce documentation rules as checks

The documentation check enforces four documentation rules that were previously
contextual: the index entry form (a one-sentence purpose, then one
`[Title](path): description` item per entry), one index per document, the
development guide's order (purpose, Setup and validation, index), and scope
coverage (every document under a documentation root is in the confirmed scope,
unless another declaration owns it). The authoring notes had kept these rules
contextual, and the adopting repositories drifted apart where the check was
silent, as the
[`v0.4.0` specification](https://github.com/lutzseverino/repo-canon/issues/122)
records. The rules are defined once, in the shared documentation model, so that
the check and a scope drafted from the same model cannot disagree. Each failure
names the file and the rule it breaks. Two alternatives were rejected: keeping
the rules contextual and relying on review, because review had not kept the
repositories alike; and a separate check per rule, because each would walk the
tree and infer roots and indexes again.

## Consequences

- This is a breaking standards change: a repository that conformed before can
  now fail the documentation check, and must bring its indexes, development
  guide, and documentation scope in line with the
  [contribution guide](../../CONTRIBUTING.md#documentation) to conform again.
- The installed agents index cites the optional `project.md` in context rather
  than listing it, and the one-index rule accepts that citation.
- Scope coverage counts a document that another active declaration owns, such
  as an installed exact file under `docs/agents`, as covered, because the
  operation request names every active declaration and a path cannot belong to
  two declarations.
- Scope coverage and the index rules cover Markdown documents. Other files
  under a documentation root, such as images, still belong in the confirmed
  scope by the discovery guidance, but the check does not require it.
- The check still does not judge whether a purpose or description is accurate
  or useful, or where records are kept.
