Committed locally: `4c83243 fix(invoice): avoid in-place sort that reorders caller lines`

Confirmed:
- Public `renderInvoice(lines)` reproduction passes and preserves caller line order.
- `npm test` passes on Node `v24.21.0`.
- No debug instrumentation remains.
- Working tree is clean.
