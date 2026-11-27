---
name: babysit
description: Babysit an opened pull request through checks and review to merge or its prescribed handoff. Use right after opening a pull request, or when asked to babysit or land one.
---

A prompt or brief naming this skill is its invocation.

Take the PR through authorized delivery under `CONTRIBUTING.md` and the
installed `github-repository-configuration` merge rules. Before each post,
read the applicable section of the installed comment rules.

## Start

Establish merge ownership from the guide and installed rules before requesting
or waiting. Record a prescribed worker handoff in the PR body's Delivery
subsection and stop; the designated merging agent resumes with its reviews
and outstanding findings. For an owner-question pause, follow installed
continuation rules first. An authorized stopped-run continuation enters
[branch-update recovery](BRANCH-UPDATE.md), carrying its handoff context and
retaining the waiting marker as installed rules direct.

Use Node.js 24 or 26, Git 2.38 or newer, and the authenticated GitHub CLI.
Install this entire skill directory, including its shipped [runtime](runtime/LICENSE) and
license notices; no npm install or adoption is needed for command startup.
If a command cannot start, stop and report the startup error, the PR and full
head SHA left untouched, and the remedy: repair the runtime, then rerun.
There is no alternate merge path.

## Deliver

1. From the repository root, run
   `node <this skill's directory>/request.mjs <number>` before the first wait
   and each later or resumed head. Add `--fixes-review` when the head fixes a
   finding that requires a new request under the installed rules. On any
   nonzero exit, read the request [exit actions](COMMANDS.md#request)
   and complete its action before proceeding.
2. Run `node <this skill's directory>/wait.mjs <number>` and wait for its
   exit, in the foreground whenever its exit cannot resume the session, with
   600000 ms command timeouts where supported. Read the wait
   [exit actions](COMMANDS.md#wait); perform the action for the actual outcome.
3. Verify failing checks and review findings against the source, including
   findings arriving after a policy skip. Apply the installed rules' internal
   Standards and Spec reviews, recording actual outcomes under the comment
   rules' Reviews section. Fix findings the guide does not let you decline;
   answer every review thread under Review-thread replies. After a push or
   re-request, return to request and wait.
4. Before merging, re-establish merge ownership and any designated owner
   approval for the current head. Read the authoritative implementation
   contract, worker handoff and PR comments holding designation provenance
   and approval. Apply the GitHub rules' Designated owner review gate;
   record approval under Delivery records. Missing required approval means
   the owner-question handoff with the PR unmerged.
5. Once merge conditions hold, run
   `node <this skill's directory>/merge.mjs <number> <SHA>` with the full SHA
   starting wait's latest outcome. Read the merge [exit actions](COMMANDS.md#merge)
   and complete its action. Record any installed-rule-required merge outcome
   under Delivery records, then stop.

## Reads

Paths are relative to the repository root.

- `.repo-standards/rules/planning.md`: planning policy. When absent, use
  `CONTRIBUTING.md`; if both are absent, report the missing policy and stop
  the dependent step.
- `CONTRIBUTING.md`: merge, validation, findings and credential requirements.
  When missing, carry out the steps and the commands' own checks as written,
  and hand off to the owner in one PR comment any rule left to the guide.
- `.repo-standards/rules/comments.md`: sections named above and by exit
  actions. When missing, keep the handoff in the PR body's Evidence, each
  other record or question in one comment, and reviews in wait's printed shape.
- The installed rules, including the `github-repository-configuration` rules,
  looked up through the `repository-standards` skill: merge eligibility,
  review configuration, request policy, branch updates and continuation.
  When missing, commands stand; no installed rule adds handoff or owner
  approval and the guide sets merge rules.
- `.github/required-checks.json`: trusted required checks and location.
  Missing, invalid or unreadable stops delivery for default-branch correction.
- `.github/pull-request-reviewer.json` and `.github/factory-review-policy.json`:
  optional trusted declarations. When absent, no reviewer or no policy exemption,
  respectively.
- `.github/workflows/pr-metadata.yml`: read at `github` for the proven
  private-plan path; missing there requires the owner. Other locations omit it.
- `.scriptorium/config.json`: hold labels; an absent file or key adds no hold.
- `.agents/skills/` and `rules/`: declared-deletion surfaces at head and base;
  missing at both is reported unchecked.
- `.repo-standards/runtime/`: adoption-summary verification runtime; when
  missing, no link receives the summary exemption.
- `vendor/`: canonical command dependencies in adopted installations. When
  absent, the shipped runtime supplies them; missing runtime stops at Start.
