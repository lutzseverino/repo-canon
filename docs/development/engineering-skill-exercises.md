# Engineering skill exercises

This exercise set runs the nine pinned engineering skills tracked by issue
[#12](https://github.com/lutzseverino/repo-canon/issues/12) against disposable
Git repositories. It is runtime evidence, separate from the inventory and
byte review in [upstream compatibility](upstream-compatibility.md).

## Evidence boundaries

Each exercise uses the vendored skill directory through a repository-scoped
`.agents/skills` symlink. The repositories install the shared `AGENTS.md`,
`CONTRIBUTING.md`, and agent guidance, and add a small domain glossary,
applicable ADR, contributor validation command, and scenario source. The
fixture command reports a SHA-256 digest for every complete skill directory so
the exercised source can be identified independently of the session result.

The exercises use local disposable repositories. They do not publish changes,
adopt the standards source, configure a production repository, or establish
that other pinned skills have run.

## Prepare the repositories

Use Node.js 24 from the Repo Canon root:

```bash
node scripts/create-engineering-skill-fixtures.mjs
```

The command prints a JSON manifest containing the temporary root, repository
paths and Git fixed points, the Repo Canon source commit, the pinned upstream
commit, and complete-directory skill digests. Supplying `--root <path>` creates
the same repositories at an explicit unused path. The fixture test checks this
public interface:

```bash
npm run test:engineering-skill-fixtures
```

## Scenario matrix

| Skill | Disposable repository | Runtime outcome to observe |
| --- | --- | --- |
| `ask-matt` | `routing-review` | Route a hard reported regression through diagnosis and the implementation review flow. |
| `code-review` | `routing-review` | Run independent Standards and Spec axes from the recorded fixed point and find both the mysterious name and missing contract behavior. |
| `codebase-design` | `architecture` | Compare several interfaces for deepening the Order intake module using domain and architecture vocabulary. |
| `diagnosing-bugs` | `debugging` | Build and run a red-capable Invoice-line feedback loop, identify mutation as the cause, fix it, and leave a regression test green. |
| `domain-modeling` | `modeling-research` | Resolve the overloaded Account term against code and the external-authentication ADR, then update the glossary. |
| `improve-codebase-architecture` | `architecture` | Use history, the glossary, and the ADR to produce a visual deepening-candidate report outside the repository. |
| `research` | `modeling-research` | Delegate primary-source research and retain the cited result under `docs/development`. |
| `resolving-merge-conflicts` | `merge-conflict` | Resolve an in-progress conflict by preserving both accepted request intents, run contributor checks, and finish the merge. |
| `tdd` | `tdd` | Implement Invoice-reference behavior in red-green vertical slices at the agreed public seam. |

Concrete invocations, observed results, retained artifacts, and limitations are
recorded after each runtime session completes.
