# Keep the contribution guide for contributors, and process in planning and delivery rules

Status: supersedes the guide-as-delivery-home part of
[ADR 0010](0010-carry-delivery-rules-in-the-environment.md) and amends
[ADR 0016](0016-keep-requirements-in-installed-rules.md).

`CONTRIBUTING.md` says how to contribute, in role words, for a person or an
agent alike: issues, setup, validation, commits, opening a pull request and
what review and merge need. The process the maintainer's agents or the factory
run lives in two installed rules files worded by role: the planning rules
(triage and its inference test, grills and their publication, readiness,
owner questions, findings routing) and the delivery rules (implementation
contracts, worker handoff, adoption pull requests, merging, agents on the
maintainer's account, credentials). The guide points each role there. A role
rule binds through the rules; how one setup fills a role is method, in the
skills. On 2026-11-13 the guide was 372 lines, about 70 of them for
contributors, installed in eight repositories. The owner asked on 2026-11-09:
"Is text like this appropriate for `CONTRIBUTING.md`? How does this make any
sense if you're not using agents?", and on 2026-11-13: "Maybe we're overusing
`CONTRIBUTING.md`. What's the real purpose of this file? Are we following
that?" and "They should be usable without the contributing file, no? I need a
solution that simplifies the paths". This refines the owner's 2026-10-25
decision "The triage and readiness rules stay in `CONTRIBUTING.md`; the skill
is only the method": the rules still bind as installed rules, and the skill
stays method.

## Considered options

- Keeping the process in the guide, reworded by role: rejected, because the
  guide would still grow with every process change, against ADR 0016's
  reason, and a contributor would still read process they never run.

## Consequences

- One step has one owner in one place: the grill session publishes its
  specification and tickets, with or without an orchestrating agent; the
  maintainer decides the split; a reviewer who did not write a contract
  accepts it.
- The planning rules say which role sets which workflow state and when, and
  point to the GitHub repository configuration rules for label meanings;
  where a script performs a label step, the rules state its outcome and name
  the script.
- Skills read the planning and delivery rules, with a fallback only for a
  repository that has not adopted them.
- No installed file names or requires a private planning repository, and a
  check covers every installed file.
