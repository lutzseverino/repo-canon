# Ship the factory with the standard

Every adopting repository carries the factory as exact files in `.sandcastle/`,
which a generic host service runs. The factory takes each ready issue on the
frontier to a pull request that `babysit` merges, and starts each agent with
only `/implement #<n>`, or `/implement-spec #<n>` for an orchestrated run.
Labels choose the run: `run:orchestrated`, or native sub-issues, select an
orchestrator, and a `model:` label selects the model. This replaces the
orchestrator prompts a maintainer wrote and relayed for each change, as the
[factory specification](https://github.com/lutzseverino/repo-canon/issues/195)
records, and it relies on the environment carrying every rule, as
[ADR 0010](0010-carry-delivery-rules-in-the-environment.md) decides. Three
alternatives were rejected: setting up a factory per repository on the host,
because each repository would need its own setup and the behavior would drift
between them; a hand-written orchestrator prompt per change, because it kept
the maintainer between grilling and merge; and a model registry, because a new
model would then need a registry change instead of only its slug.

## Consequences

- Adopting Repo Canon makes a repository a factory with no per-repository
  setup. The factory runs Sandcastle through a pinned `npx`, so a repository
  without JavaScript gains no dependency.
- The decision core is a pure function from a snapshot of the repository and
  the host to decisions, so its rules are tested without GitHub or agents.
- The host sets the default and retry models, the per-provider caps, the usage
  threshold, and the time limit. Repo Canon ships none of them.
- The canonical labels gain `factory:running`, `factory:failed`, and
  `run:orchestrated`. Whoever grants readiness creates a `model:` label on its
  first use.
- Changing the factory's behavior is a Repo Canon release, like any other exact
  file.
