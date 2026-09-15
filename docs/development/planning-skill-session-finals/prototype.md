Completed.

- Prototype branch: `prototype/delivery-schedule-cancellation-state`
  - Commit: `3f9ea86d00c1dd5b01df327dd2bc27417357b913`
- Main tracker-pointer commit: `df40b545cc9b53792d5f5741ea2ab9099b38c32d`
- Decision recorded in [the local tracker](/tmp/repo-canon-skill-exercises-11/delivery/.scratch/delivery/issues/02-delivery-schedule-cancellation-model.md).

Answer: coordinators can understand the three scheduling stages if cancellation is a separate terminal operational outcome. A cancelled schedule retains its last `draft`/`confirmed` stage as history, visibly reports “cancelled,” and allows no further actions; cancellation after dispatch is rejected.

The HTML prototype is isolated on the throwaway branch and includes free play plus happy-path, cancellation, and illegal-transition walkthroughs. `main` excludes the HTML. Static HTML/inline-JS checks, `git diff --check`, and existing `npm test` all passed. No remote was contacted.
