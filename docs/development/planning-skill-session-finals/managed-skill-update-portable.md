Committed the portable audit correction:

`77adf04 docs(skills): use Node in update audit`

The audit now records a Node built-in `fs` mutation command and says the final rerun supersedes both earlier incomplete transcripts.

Observed rerun outcomes:

- Source digest before/after: `570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b`
- Candidate digest: `13af6e0225c89e4b44d4476b4ca87681219f9d5a49566c5f2d3df173f766ee6d`
- Recursive candidate diff: expected exit `1`, one synthetic comment hunk
- Vendored source diff: clean
- Candidate: removed

Checks passed: `npm run verify-api`, `npm test`, and `git diff --check` under Node `v24.21.0`. No remote contact or managed-skill modification occurred.
