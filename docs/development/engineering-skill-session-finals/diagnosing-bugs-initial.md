Fixed the Invoice-line mutation in [src/invoice.mjs](/tmp/repo-canon-skill-exercises-12b/debugging/src/invoice.mjs): rendering now sorts a copied array, preserving the public `renderInvoice(lines)` seam and ADR.

Confirmed cause: in-place `Array.sort()` reordered the caller’s Invoice lines.

Validation passed:

- Focused red-capable reproduction now green
- `npm test` passed
- No debug instrumentation remains
- `git diff --check` passed

Commit could not be created because this environment mounts `.git` read-only (`index.lock: Read-only file system`). The intended local-only commit is:

```text
fix(invoice): avoid in-place sort that reorders caller lines
```
