# Factory workflow adoption guidance

Confirm an intentionally empty scope for `factory-workflow`: no content paths
or directories. Adoption installs its rules for the whole repository.

## App-author policy opt-in

Read the previous adoption record before the run changes it. Ask only when
the selected profile is factory and the previous adoption record did not
already select factory. A first adoption and a switch from standard to factory
both ask; routine updates of existing factory adopters do not ask again.
Standard-only runs never receive this factory-specific question.

Ask the repository's maintainer: "After this adoption is delivered, do you want
to install the optional app-author review policy? If yes, which app identity
does this repository name as its author?" Explain that matching app-authored
PRs skip external review requests and reviewer waits while retaining required
checks, internal Standards and Spec reviews, merge authorization and handling
of findings that arrive. Record the answer with the run. Preserve any existing
deliberate policy unchanged; this question never replaces it or silently opts
the repository in.

On no, leave the policy absent if absent. On yes, after the adoption run
completes and its adoption PR is delivered, install the repository-named
configuration in a separate commit, outside the adoption commit and adoption
PR. Use the version-1 schema in the
[app-author policy rules](../rules/github-repository-configuration.md#factory-app-author-review-policy)
and validate it with the read-only `factory-review-policy` check. The repository
supplies the app identity: do not copy an identity from this source or another
repository, choose a preset or perform a remote account lookup. Missing or
invalid identity is not authorization to install a policy. Existing policies
remain untouched; invalid or unreadable configuration fails explicitly under
the rules and never authorizes a skip.

This opt-in is post-run repository configuration, not a file declaration or
adoption output. Adoption neither creates nor edits the policy file or
`.github/pull-request-reviewer.json`. Policy absence remains supported.

## Workflow reconciliation

When updating from a release that kept factory policy in `CONTRIBUTING.md`,
review the installed `factory-workflow` rules as the new home of parent
readiness, model selection, state labels, owner handoff and recovery, stop
notes, and the factory consequence of leaving an issue open after merge.
The exact contribution guide is replaced by adoption; preserve useful
repository-specific instructions through `project-agent-guidance` rather than
copying factory policy back into it.

Assess `factory-workflow` as `satisfied` once the installed rules and the
repository's tracker workflow agree, citing the reviewed workflow and any
reconciliation. A repository with no current tracker activity can cite that
absence and the installed rules. If an unresolved workflow conflict prevents
conformance, assess it as `blocked` and explain the conflict. Confirm scope
validity after fixes and again after contextual work: it stays empty because
the declaration governs work, not project content.
