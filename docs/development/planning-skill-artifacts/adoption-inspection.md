# AGENTS adoption inspection

Inspected prepared commit
`c0cc7080d30ca45010cafbf09defdc99e6ad6fd1` before replacing the root
`AGENTS.md` with `candidate/AGENTS.md`.

## Outcome

**Ready to adopt.** Every path referenced by the candidate exists in the
prepared commit and supplies the guidance named by the candidate.

| Candidate reference | Inspection outcome |
| --- | --- |
| `CONTRIBUTING.md` | Present; contribution workflow, validation, Conventional Commit, and pull-request rules are discoverable. |
| `docs/agents/project.md` | Present; preserves the local-only scope, Parcel terminology, opaque identifier decision, identifier-ADR requirement, and API verification requirement. |
| `docs/development/README.md` | Present; specifies Node.js 24, `npm test`, `git diff --check`, and the no-remote constraint. |
| `docs/agents/issue-tracker.md` | Present; specifies issue, implementation-contract, dependency, and pull-request workflows. |
| `docs/agents/triage-labels.md` | Present; specifies workflow-state, category, and Wayfinder label meanings. |
| `docs/agents/domain.md` | Present; requires reading `CONTEXT.md` and applicable ADRs and using canonical domain language. |

The pre-adoption root instructions were reconciled into `project.md` rather
than discarded. No contradiction was found: the candidate delegates to the
same contribution, development, tracker, triage, and domain guidance, while
`project.md` retains the project-specific rules it did not itself state.
