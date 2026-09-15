The Import batch (one uploaded file) contained exactly 100 rows:

- 84 rows were accepted by the parser.
- 16 rows were malformed, causing the entire Import batch to enter **Quarantine** for operator review.
- Processing is therefore not in a completed/accepted state; it is awaiting remediation in Quarantine.
- No customer data was deleted—this outcome is data-safe.
- Remediation: correct the 16 malformed rows, then submit a new file to create a new Import batch. The current batch is not to be resumed in place.

Source: [docs/status.md](/tmp/repo-canon-productivity-runtime-issue-13-v2/wait-what/docs/status.md:3).