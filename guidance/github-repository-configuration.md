# GitHub repository configuration guidance

Configure the adopting repository's canonical issue labels, enable squash
merging, disable merge commits and rebase merging, and use the pull request
title and body for the squash commit. Preserve unrelated labels, rules, checks,
and repository settings.

Requiring the stable `PR metadata` check is a plan-gated requirement: require
it on the default branch wherever GitHub offers branch protection or rulesets
for the repository. On a private repository whose plan offers neither, the
requirement is unavailable, and the next adoption or update requires the check
once GitHub offers it. GitHub runs the PR metadata validation workflow only from
the default branch, so require the check once the workflow is on the default
branch; until then the requirement is deferred, and the next adoption or update
after the workflow merges requires it.

The repeat-safe operations infer one unambiguous github.com repository from Git
remotes, require authenticated access and the needed permissions, apply only
missing settings, and read the result back. Review blocked and partial results
before retrying. Operation evidence describes the state at execution time; it
does not provide remote freshness, rollback, or an ownership baseline.

The optional repository-owned `.github/pull-request-reviewer.json` configures
pull request review waits, as [`babysit`](../.agents/skills/babysit/SKILL.md)
documents. Its read-only check passes without the file and validates the schema
when present. The declaration owns no reviewer file or preset. Choose a
reviewer, or leave it absent, according to the repository's own setup.

## Installed workflow runners

Every installed job reads `vars.REPO_CANON_RUNS_ON`. Unset or empty selects
`ubuntu-latest`; a public repository normally leaves it unset. A private
repository that needs its own runners can set it to a JSON array of runner
label strings, for example `["self-hosted", "homelab"]`. The array must be
non-empty and contain only non-empty strings. A runner must carry every listed
label. Set the variable only when the repository has matching runners.
A repository's own workflows may read the same variable too.

An organization-level variable of the same name also reaches these jobs, and
a repository-level value takes precedence. The installed jobs use no
environments. Assess the repository's visibility and the repository-level
variable as unset, valid with its labels, or invalid, following the
[discovery guidance](../discovery/github-repository-configuration.md).
Disclose uncertainty about an organization-level value the run cannot read.
Never rely on invalid values falling back: malformed JSON or an unusable
`runs-on` value makes every installed job fail during GitHub's evaluation,
before any steps run. The expression does not validate the value's schema:
parsed falsy JSON such as `false`, `0`, `null`, or `""` also selects the hosted
default, but the assessment still reports those values as invalid.

The runners need `git`, `bash`, and network access for Node.js setup through
`actions/setup-node`. The factory profile's sandbox-image job also needs a
`docker` CLI with a daemon that can run `docker build`. A job with no matching
online runner waits in the queue for up to 24 hours and then fails.
Issue-contract feedback, and therefore readiness review, waits for those
runners too.

The sandbox-image job executes pull request workflow and Dockerfile content,
including content from forks. For repositories accepting untrusted pull
requests, keep the hosted default or select isolated, ephemeral self-hosted
runners with no secrets or sensitive network access. This applies to private
and internal repository forks too. A read-only workflow token does not prevent
untrusted code from compromising a persistent runner and later jobs. Every
runner matching the variable's labels must be suitable for that workload;
runner isolation is a host provisioning responsibility. See GitHub's
[self-hosted runner security guidance](https://docs.github.com/en/actions/reference/security/secure-use#hardening-for-self-hosted-runners).

If the self-hosted runners are unavailable, return to GitHub-hosted runners by
deleting the variable or setting it to `["ubuntu-latest"]`, without editing
installed files. Deleting a repository-level variable exposes an inherited
organization-level value if one exists; set `["ubuntu-latest"]` to override
that value. A runner on another machine carrying the same labels takes the jobs
with no change at all. Changing the variable selects runners for new jobs;
cancel and rerun a job already queued on unavailable labels.

The adoption or update run reports this setting but never sets, changes, or
deletes the variable. Setting it without matching runners would strand every
installed job. The assessment changes nothing remotely.
