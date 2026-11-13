# Own pull-request text checks and retire others before adoption

Repo Canon's pull-request metadata contract is the only policy for
pull-request text (title, body and branch name) in an adopting repository.
Before adopting, the run finds every required check that validates that text
and stops until a separate repository-policy pull request removes it, as it
already does for repository-chosen required-check names. Checks are found by
what they validate, never by name: a workflow that also does other work loses
only its pull-request text rules, a check the run cannot inspect stops
adoption with an owner question, and a wrapper that only delegates to the
installed validator is Canon's policy and stays. The preserved-settings rule
therefore no longer covers pull-request text checks; every other check, rule
and setting stays as the repository has it. On 2026-10-31
minecraft-stream-guard-site kept a legacy check demanding `Closes #N` and its
own headings: the adoption pull request passed on an adoption-only exemption,
and then every ordinary Canon pull request failed it, about 2 h 15 min lost on
one row. polity caught the same conflict only because its run happened to look.
The owner decided in the 2026-11-12 grill of #795: "RC dictates this,
`minecraft-stream-guard-site` should follow. If it had old requirements, they
should've been removed on adoption." and, on scope and route, "agreed to all
then".

## Considered options

- A compatibility assessment that keeps compatible checks with a reason:
  rejected, because a legacy check is frozen while Canon's contract changes
  with each release, so compatibility today does not hold at the next one.
- Removing the checks inside the adoption run: rejected, because the
  adoption tool, in the separate Repository Standards repository, would have
  to delete files it does not own, and a legacy check run from base code still
  judges the adoption pull request itself.
- Automatic migration of conflicting checks: rejected, because it needs
  authority over every adopter's own workflows and protected settings.

## Consequences

- A repository keeps no pull-request text rules of its own; an extra it wants
  becomes a change request to Repo Canon.
- Between the prerequisite's merge and the `PR metadata` check becoming
  required, pull-request text is unenforced, the deferral a first adoption
  already accepts.
- Release notes for the release that ships this call out the narrowed
  preserved-settings rule.
