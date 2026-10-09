# Carry delivery rules in the environment and keep skills short

Every adopting repository carries its delivery rules in its installed
environment: the [contribution guide](../../CONTRIBUTING.md#pull-requests) says
how to open a pull request, an adoption pull request included, and when it may
merge, and the installed `AGENTS.md` adds one line: deliver every change as one
pull request, write its body with `pr`, then `babysit` it until it merges.
Skills stay short and cite the guide. The manual delivery skill is deleted, and
the model-invocable `babysit` skill watches the pull request, settles its
findings, and merges it. The delivery skill had sequenced the guide's rules and
stopped at an opened pull request, so nothing owned the review and merge that
followed, and an agent needed a hand-written prompt to finish a change, as the
[factory specification](https://github.com/lutzseverino/repo-canon/issues/195)
records. An agent started with only `/implement #<n>` must find every rule in
the repository. Two alternatives were rejected: extending the delivery skill
through review and merge, because a longer skill would restate more of the
guide and give the rules two homes; and carrying the rules in each run's
prompt, because a prompt is rewritten per run and reaches only the agents given
it.

## Consequences

- `CONTRIBUTING.md` holds the delivery procedure and the merge conditions, and
  the `AGENTS.md` line is the pointer that reaches them on every change.
- `babysit` is model-invocable, so the `AGENTS.md` line and other skills can
  reach it; its description is always loaded.
- A skill that Repo Canon authors states no rule the guide holds; changing a
  delivery rule is one edit to the guide.
- Adopting repositories lose the delivery skill and gain `babysit` and the new
  guide sections through a Repo Canon release.
