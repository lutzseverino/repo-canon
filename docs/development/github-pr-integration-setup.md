# GitHub PR integration setup

The GitHub PR integration setup is a repeat-safe Repository Standards fixes
operation. It requires the stable `PR metadata` check from the
[pull request metadata workflow](pr-metadata-validation.md) on the default
branch wherever GitHub offers branch protection or rulesets for the repository
and the default branch carries that workflow, and configures these repository
merge settings:

| Setting               | Required value           |
| --------------------- | ------------------------ |
| Squash merging        | Enabled                  |
| Merge commits         | Disabled                 |
| Rebase merging        | Disabled                 |
| Squash commit title   | Pull request title       |
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

| Branch protection response                         | Required-check action                                                | Readback                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `404 Branch not protected`                         | Use the dedicated ruleset                                            | Confirm an active ruleset applies to the default branch and requires `PR metadata` |
| `200` with no `required_status_checks` policy      | Preserve the other classic protections and use the dedicated ruleset | Confirm the same ruleset enforcement                                               |
| `200` with `required_status_checks`                | Add `PR metadata` to the existing classic contexts                   | Re-read branch protection and confirm the context                                  |
| `403` plan limit on both reads, private repository | Make no protection or ruleset change; reconcile only merge settings  | Re-read merge settings only                                                        |
| Any other `404` or unreadable response             | Return `blocked` without mutation                                    | None; the operation cannot safely distinguish absence from inaccessible state      |

Requiring `PR metadata` is a plan-gated requirement. GitHub offers neither
classic protection nor rulesets on a private repository on some plans, and
answers both reads with HTTP 403 and a message of the form
`Upgrade to GitHub … or make this repository public`, naming Pro for personal
accounts and Team for organisations. The requirement is unavailable only when
the repository is private and both the protection read and the rulesets read
return that response. Any other 403, the plan-limit response on a public
repository or on only one of the two reads, or a reworded message returns
`blocked`.

Where the requirement is available, the operation then reads whether the
default branch on GitHub carries the workflow at its installed path,
`.github/workflows/pr-metadata.yml`, through the repository contents API. The
workflow triggers on `pull_request_target`, which GitHub runs only from a
workflow file on the default branch, so until the file is there `PR metadata`
never reports and a required check would hold every pull request, including
the adoption pull request that installs the workflow. GitHub's `Not Found` 404
response means the workflow is absent and defers the requirement; any other
failed read returns `blocked` with GitHub's error text and no mutation. The
Actions workflow list is not used, because GitHub keeps listing a workflow
after its file leaves the default branch.

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
repository merge settings. The `PR metadata validation` workflow must be on the
default branch before the operation requires the check, so that the check can
report a result.

All repository-local `github.com` fetch and push remote URLs must identify one
repository. Global and system Git configuration cannot supply or conflict with
that identity. The operation verifies that the API's canonical `full_name`
matches the remote-derived owner and repository, uses the API-reported default
branch, and pins every API request to `github.com` even when `GH_HOST` names an
enterprise server.

## Results and recovery

The operation implements the public
[`repo-standards/operation/v1`](https://github.com/lutzseverino/repo-standards/blob/v4.0.0/docs/usage/script-protocol.md)
boundary with an empty project-content target scope. It returns `changed` only
after a final readback confirms required-check enforcement and every merge
setting. It returns `unchanged` when the first read already matches.

When the `PR metadata` requirement is unavailable, the operation applies only
missing merge settings and reads them back, returning `changed` when it updated
them and `unchanged` when they already matched. Its message says the
integration matches what GitHub offers the repository, names the unavailable
requirement and its reason, and asks to upgrade the plan or make the repository
public; the next adoption or update then requires the check as usual.

When the default branch does not carry the workflow, requiring `PR metadata` is
deferred. The operation creates no ruleset, adds no classic required check, and
leaves existing branch protection and rulesets as they are, including an
inactive managed ruleset. It applies only missing merge settings and reads them
back, returning `changed` when it updated them and `unchanged` when they
already matched, so the adoption completes. Its message says the integration
applies squash-only integration, PR-title subjects, and PR-body messages,
names the deferred requirement and the default branch that lacks the workflow,
and asks to merge the adoption. Once the adoption pull request merges and the
workflow is on the default branch, the next adoption or update, including one
with an unchanged selection, requires the check as usual.

Missing or incompatible tools, uncertain identity, authentication failure,
insufficient permission, an unreadable rule configuration, an API failure, or
a readback mismatch returns `blocked`, with GitHub's error text from `gh`
when the failure came from an API call. A mutation failure names confirmed
partial effects and the work that remains. Each retry reads current remote
state and performs only missing changes, including after process interruption.
Readback is point-in-time evidence: the operation supplies no freshness,
rollback, or remote ownership-baseline guarantee.

Authoring fixtures use a temporary local Git repository and a stateful GitHub
CLI replacement. They exercise classic branch protection, repository rulesets,
merge settings, the plan-limit response on either read, a workflow that is
present, absent, or unreadable on the default branch, identity, permissions,
partial effects, readback, retry, and unchanged repetition without contacting
GitHub or mutating live settings:

```sh
npm run test:github-pr-integration
```
