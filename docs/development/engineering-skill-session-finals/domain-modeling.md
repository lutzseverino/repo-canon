Updated [CONTEXT.md](/tmp/repo-canon-skill-exercises-12b/modeling-research/CONTEXT.md:7) as a glossary only:

- **Authentication Identity** — externally owned, represented by stable subject ID.
- **Billing Party** — person or organization legally and financially responsible for a subscription.

This matches the Subscription code’s separate `subject` and `legalName` values and ADR 0001’s external-authentication boundary. No new ADR is warranted: this records existing terminology rather than a new, hard-to-reverse trade-off or architectural decision.

Validation passed with Node 24: `npm test` (1/1 passing). No implementation behavior changed.
