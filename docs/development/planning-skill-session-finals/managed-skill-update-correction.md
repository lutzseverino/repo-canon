Corrected and committed the audit: `8f716e2 docs(skills): correct managed update audit`.

- Record: [managed-skill-update-boundary.md](/tmp/repo-canon-skill-exercises-11/adoption-preparation/.scratch/managed-skill-update-boundary.md)
- Fresh candidate mutation used an explicit recorded `apply_patch` command.
- `diff -ru` detected exactly the candidate-only comment; exit status `1`.
- Source digest before/after: `570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b`
- Candidate digest: `13af6e0225c89e4b44d4476b4ca87681219f9d5a49566c5f2d3df173f766ee6d`
- Repo Canon vendored-source diff was empty; candidate was removed.
- Checks passed: `npm run verify-api`, `npm test`, and `git diff --check` (fixture contains zero tests).

Runtime/model: Node `v24.21.0`; Codex, GPT-5-based.

Limitations remain: this verifies only the local boundary and byte comparison; it does not review upstream, validate a standards release, exercise the skill, or authorize/publish a standards update. No remote was contacted.
