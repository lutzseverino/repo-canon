# Route triage by where its uncertainty lies

Triage sorts each intake request by where the answer to its open questions
lives, not by its category label. A code-bound request, whose expected result
is clear and whose remaining questions the code, logs, or a
reproduction can answer, is
researched by a research run that writes its Agent Brief; the orchestrating
agent then reviews that brief independently and accepts it by applying
readiness. An intent-bound request, whose missing answer is the owner's intent,
gets its facts gathered first, then a grilling session with the owner in short
rounds of numbered questions with recommended answers, and its brief is written
from the owner's recorded decisions. One path had served every request: an
agent investigated alone and wrote the brief, so an intent question was
answered by a guess or an option list nobody who held the intent reviewed. The
brief for [#496](https://github.com/lutzseverino/repo-canon/issues/496) chose
a one-hour and a 20-minute fallback that the owner never saw, and the factory
merged them as [#497](https://github.com/lutzseverino/repo-canon/pull/497)
within about 20 minutes. Two alternatives were rejected: having the owner
finish every brief, which the owner first approved and then replaced, the same
day, with independent acceptance of code-bound briefs; and keeping one path
with a stricter brief review, because no review can recover intent the owner
was never asked for.

## Consequences

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md#triage) states the routing and
  acceptance, the GitHub repository configuration rules bind an orchestrating
  agent's readiness to its credentials' role and the revision notice, and the
  factory workflow rules have it choose the model label and keep the factory's
  person-only readiness gate.
- The method restates most of the pinned `triage` procedure, so Repo Canon
  forks the skill, as
  [ADR 0019](0019-fork-a-pinned-skill-when-its-overrides-outgrow-it.md)
  decides; its credits name the upstream commit, and the upstream pin no
  longer holds `triage`.
- Adopters must change how they triage, so the change is a breaking standards
  change under [ADR 0003](0003-follow-product-release-versioning.md).
- An orchestrating agent without credentials that can apply readiness, or
  without the brief's revision notice, hands the brief to the owner; the
  decision grants no permission.
