# GitHub PR integration setup

The GitHub PR integration setup is a repeat-safe Repository Standards fixes
operation. It requires the stable `PR metadata` check from the
[pull request metadata workflow](pr-metadata-validation.md) on the default
branch and configures these repository merge settings:

| Setting | Required value |
| --- | --- |
| Squash merging | Enabled |
| Merge commits | Disabled |
| Rebase merging | Disabled |
| Squash commit title | Pull request title |
| Squash commit message | Pull request description |

The operation first reads repository settings, classic required status checks,
and repository rulesets. When classic required status checks already protect
the default branch, it adds `PR metadata` to that list without replacing the
adopter's checks. Otherwise it creates or reconciles a dedicated
`Repo Canon required PR checks` ruleset. Reconciliation keeps other check
names, rules, branch includes, bypass actors, and strict-check policy in that
ruleset while making it active and applicable to the default branch. Other
rulesets and branch policy remain untouched.

The classic-protection read distinguishes GitHub's documented response states
before choosing an enforcement location:

| Branch protection response | Required-check action | Readback |
| --- | --- | --- |
| `404 Branch not protected` | Use the dedicated ruleset | Confirm an active ruleset applies to the default branch and requires `PR metadata` |
| `200` with no `required_status_checks` policy | Preserve the other classic protections and use the dedicated ruleset | Confirm the same ruleset enforcement |
| `200` with `required_status_checks` | Add `PR metadata` to the existing classic contexts | Re-read branch protection and confirm the context |
| Any other `404` or unreadable response | Return `blocked` without mutation | None; the operation cannot safely distinguish absence from inaccessible state |

Ruleset readback checks active enforcement, branch applicability, exclusions,
and the required-check rule together. An inactive or non-applicable managed
ruleset is reconciled before settings are changed.

Repository settings are updated with only the five fields in the table, so
settings such as automatic merging, branch deletion, security features, and
repository visibility retain their current values. The configured title and
message defaults remain editable in GitHub's merge flow. Reviewers must verify
that the final squash subject and body still preserve the reviewed pull request
title, description, issue references, and any breaking-change explanation.

## Prerequisites and identity

The operation requires Node.js 24, Git 2.18.0 or newer, and GitHub CLI 2.57.0
or newer. `gh` must have an authenticated active account for `github.com`, and
that account must have admin access to edit branch or ruleset policy and
repository merge settings. The `PR metadata validation` workflow must be
installed so the required check can report a result. GitHub may require the
check to run once before its name can be selected.

All repository-local `github.com` fetch and push remote URLs must identify one
repository. Global and system Git configuration cannot supply or conflict with
that identity. The operation verifies that the API's canonical `full_name`
matches the remote-derived owner and repository, uses the API-reported default
branch, and pins every API request to `github.com` even when `GH_HOST` names an
enterprise server.

## Results and recovery

The operation implements the public
[`repo-standards/operation/v1`](https://github.com/lutzseverino/repo-standards/blob/v1.2.1/docs/script-protocol.md)
boundary with an empty project-content target scope. It returns `changed` only
after a final readback confirms required-check enforcement and every merge
setting. It returns `unchanged` when the first read already matches.

Missing or incompatible tools, uncertain identity, authentication failure,
insufficient permission, an unreadable rule configuration, an API failure, or
a readback mismatch returns `blocked`. A mutation failure names confirmed
partial effects and the work that remains. Each retry reads current remote
state and performs only missing changes, including after process interruption.
Readback is point-in-time evidence: the operation supplies no freshness,
rollback, or remote ownership-baseline guarantee.

Authoring fixtures use a temporary local Git repository and a stateful GitHub
CLI replacement. They exercise classic branch protection, repository rulesets,
merge settings, identity, permissions, partial effects, readback, retry, and
unchanged repetition without contacting GitHub or mutating live settings:

```sh
npm run test:github-pr-integration
```
