# GitHub label setup

The GitHub label setup is a repeat-safe Repository Standards fixes operation.
It reads the adopting repository identity from Git remotes, verifies that the
GitHub API resolves the same repository, and reconciles these labels:

| Label                 | Color    | Description                                                                |
| --------------------- | -------- | -------------------------------------------------------------------------- |
| `needs-triage`        | `fbca04` | Requires review or renewed review                                          |
| `needs-info`          | `d4c5f9` | Missing information; the orchestrating agent answers or routes it          |
| `ready-for-agent`     | `0e8a16` | Reviewed and sufficiently specified for agent implementation               |
| `ready-for-human`     | `1d76db` | Reviewed; needs the owner's accounts, credentials or a reserved taste call |
| `wontfix`             | `ffffff` | Will not be actioned                                                       |
| `bug`                 | `d73a4a` | Something isn't working                                                    |
| `enhancement`         | `a2eeef` | New feature or request                                                     |
| `wayfinder:map`       | `5319e7` | Planning map for related work                                              |
| `wayfinder:research`  | `bfd4f2` | Research question in a planning map                                        |
| `wayfinder:prototype` | `bfd4f2` | Prototype question in a planning map                                       |
| `wayfinder:grilling`  | `bfd4f2` | Design decision requiring discussion                                       |
| `wayfinder:task`      | `bfd4f2` | Task in a planning map                                                     |

It provisions no `factory:` label: a factory creates its own state labels from
the repository's factory configuration. Matching labels are left alone. Missing
labels are created freely. A label with a matching case-insensitive name but
different casing, color, or description requires confirmation before updating,
unless the label is still at both of GitHub's
[documented default values](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels#about-default-labels)
for its name: the repository never chose it, so it is updated without
confirmation. Today only `wontfix`, whose default description is "This will not
be worked on", differs from the table. A custom default set by an owner or
organization counts as chosen.
Other labels, existing `factory:` labels included, are never deleted or edited.

## Prerequisites and identity

The operation requires Node.js 24 or 26 as its public-protocol executable, Git 2.18.0
or newer, and GitHub CLI 2.57.0 or newer. `gh` must be authenticated to
`github.com`, and the current account must have write, maintain, or admin
repository access so it can manage labels. The GitHub CLI minimum is retained for reading its current token with
`gh auth token --hostname github.com`. The fix opens one connection through the
vendored Postern 1.2.0 bundle, passes that token as its credential source, and
uses `Access.viewer()` to confirm authentication. A missing token, anonymous
account report, or unauthenticated report blocks with the sign-in guidance.
Repository roles still come from the API response's `permissions` booleans,
so a custom role with a sufficient base role remains accepted.

Every API request uses `Access.request()` or `Access.requestPages()`, including
all pages of the label list. Only the version check and current-token read run
`gh`. The fix and probe each declare the same bundle, license and provenance
note as retained resources; they need no package installation. Credentials
never appear in results, messages, stderr or evidence, even if GitHub echoes one.

All repository-local `github.com` fetch and push remote URLs must identify one
repository. Global and system Git configuration cannot supply or conflict with
that identity. Multiple local remotes may name the same repository, but
different repository identities block setup before any API mutation. The
operation also blocks when the API's canonical `full_name` does not match the
remote-derived owner and repository. Every API call is pinned to `github.com`,
so a `GH_HOST` environment override cannot redirect verification or mutation to
a GitHub Enterprise host.

## Readiness probe

The fix is [remote setup](https://github.com/lutzseverino/repo-standards/blob/v7.2.0/docs/usage/adoption.md#remote-setup).
Its readiness probe, `operations/probe-github-labels.mjs`, runs during
inspection, before anything is written, through the
[probe protocol](https://github.com/lutzseverino/repo-standards/blob/v7.2.0/docs/usage/script-protocol.md#remote-setup-probes).
It runs the fix's own preparation and role check from
`operations/lib/github-operation.mjs`: the tool versions, the remote identity
and GitHub's confirmation of it, authentication, and write, maintain, or admin
access. It returns `ready` when all of them hold, and otherwise `not-ready`
with the message the fix would block with, such as the `gh auth login` command
that signs in. It reads the current gh token and makes only read-only `Access` API calls, never
reads the labels, and changes nothing in the project or on GitHub. An adopter
can defer a remote setup that is not ready; the next adoption or update probes
again and runs the fix once the probe is ready.

When the repository API read fails, the probe and fix map Postern's
`PlatformError.reason` to a stable recovery step without embedding platform
messages: `notFound` asks to confirm repository access; `unauthenticated` asks
to sign in again; `rateLimited` asks to wait for the reset; `forbidden`,
`rejected` and `conflict` ask to retry later. `unavailable` asks to retry later
for HTTP 5xx, and otherwise to investigate the transport failure or timeout
and retry. `invalidResponse` retains the invalid JSON reason. HTTP failures
name the status, and every reason names
`gh api --hostname github.com repos/OWNER/REPO` for full diagnostics, even
when `GH_HOST` names another host. Later reads and mutations report the
credential-redacted platform message and HTTP status, or neutral transport
failure guidance. Every failed read blocks before mutation, and a mutation
failure still names confirmed partial effects.
This keeps changing host, account, and trace details out of the inspection
identity and any recorded reason for deferred remote setup.

## Results and recovery

The operation implements the public
[`repo-standards/operation/v2`](https://github.com/lutzseverino/repo-standards/blob/v7.2.0/docs/usage/script-protocol.md)
boundary with an empty project-content target scope. It returns `changed` only
after final readback confirms all canonical labels and `unchanged` when the
first read already matches. Results use `repo-standards/result/v2`.

When any existing canonical label differs and `overwriteAllowed` is `false`,
the fix returns `confirmation-required` naming every differing label field,
its current value, and the standard's value. A label at GitHub's default values
is not among them. It makes no mutation, including creating missing labels. After the maintainer confirms, `resume --confirmed`
invokes the fix with `overwriteAllowed: true`; it re-reads the remote, applies
the changes, and verifies them. Colour casing alone is treated as equivalent.

Missing prerequisites, identity uncertainty,
insufficient access, API failure, or a readback mismatch returns `blocked`.

A blocked result names confirmed effects and remaining work when a mutation
fails. A retry reads the remote again and applies only missing or conflicting
configuration, which also recovers from an interrupted process. Readback is a
point-in-time verification. The operation supplies no remote freshness,
rollback, or ownership-baseline guarantee.

Authoring tests use a disposable local Git repository and the published
Postern adapter with an injected fetch transport (`test/fixtures/postern-setup.mjs`)
backed by stateful GitHub responses. A small gh fixture answers only version
and token reads. They never call GitHub or change live repository settings:

```sh
node --test test/github-label-setup.test.mjs
```

The operation fixtures run each fix and probe from only its declared
resources. They show `not-ready` for a missing `gh`, an ambiguous remote, no
authentication, and an insufficient role, and `ready` for a sufficient role,
with no project change and no API call other than a read. They also verify
stable repository-read failure reasons across changing transport details, neutral
transport and timeout guidance, HTTP recovery steps, the invalid JSON reason, and
matching blocked messages from both fixes:

```sh
node --test test/github-setup-probes.test.mjs
```
