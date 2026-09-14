# GitHub label setup

The GitHub label setup is a repeat-safe Repository Standards fixes operation.
It reads the adopting repository identity from Git remotes, verifies that the
GitHub API resolves the same repository, and reconciles these labels:

| Label | Color | Description |
| --- | --- | --- |
| `needs-triage` | `fbca04` | Requires review or renewed review |
| `needs-info` | `d4c5f9` | Waiting for information needed to evaluate the request |
| `ready-for-agent` | `0e8a16` | Reviewed and sufficiently specified for agent implementation |
| `ready-for-human` | `1d76db` | Reviewed and requires human implementation |
| `wontfix` | `ffffff` | Will not be actioned |
| `bug` | `d73a4a` | Something isn't working |
| `enhancement` | `a2eeef` | New feature or request |
| `wayfinder:map` | `5319e7` | Planning map for related work |
| `wayfinder:research` | `bfd4f2` | Research question in a planning map |
| `wayfinder:prototype` | `bfd4f2` | Prototype question in a planning map |
| `wayfinder:grilling` | `bfd4f2` | Design decision requiring discussion |
| `wayfinder:task` | `bfd4f2` | Task in a planning map |

Matching labels are left alone. Missing labels are created, and labels with a
matching case-insensitive name but different casing, color, or description are
updated. Other labels are never deleted or edited.

## Prerequisites and identity

The operation requires Node.js 24 as its public-protocol executable, Git 2.18.0
or newer, and GitHub CLI 2.48.0 or newer. `gh` must be authenticated to
`github.com`, and the current account must have triage, write, maintain, or
admin repository access so it can manage labels. The GitHub CLI minimum supplies
the paginated `--slurp` API output used to inspect every existing label.

All `github.com` fetch and push remote URLs must identify one repository.
Multiple remotes may name that same repository, but different repository
identities block setup before any API mutation. The operation also blocks when
the API's canonical `full_name` does not match the remote-derived owner and
repository.

## Results and recovery

The operation implements the public
[`repo-standards/operation/v1`](https://github.com/lutzseverino/repo-standards/blob/v1.2.1/docs/script-protocol.md)
boundary with an empty project-content target scope. It returns `changed` only
after final readback confirms all canonical labels and `unchanged` when the
first read already matches. Missing prerequisites, identity uncertainty,
insufficient access, API failure, or a readback mismatch returns `blocked`.

A blocked result names confirmed effects and remaining work when a mutation
fails. A retry reads the remote again and applies only missing or conflicting
configuration, which also recovers from an interrupted process. Readback is a
point-in-time verification. The operation supplies no remote freshness,
rollback, or ownership-baseline guarantee.

Authoring tests use a disposable local Git repository and a stateful GitHub CLI
fixture. They never call GitHub or change live repository settings:

```sh
node --test test/github-label-setup.test.mjs
```
