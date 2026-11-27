# Cap each skill file and ship its command runtime

Status: accepted (2026-11-27); implementation is tracked by
[skill-ceiling](https://github.com/lutzseverino/repo-canon/issues/1285) and its
blocked trims. This amends [ADR 0048](0048-budget-the-computed-read-set.md) and
[ADR 0028](0028-own-every-workflow-skill-reconciled-with-its-upstream-base.md).

The read-set byte ratchet did not stop skills growing, and its five entry
points left some owned skills unmeasured. A line cap had already encouraged
longer lines and movement into unmeasured files. Add a per-file word guard
alongside the byte ratchet, restoring in words the hard skill-text check
dropped with [#898](https://github.com/lutzseverino/repo-canon/issues/898) on
2026-11-19, extend that ratchet to every owned skill as its
own entry point, and describe bundled commands through their interfaces
rather than repeating their implementation. References disclose material only
on real branches; splitting a file is not a way to hide total growth.

Each Markdown file in an owned skill directory, including references but
excluding credits and licences, has a ceiling of the greater of 1,000 words
or the floor of 120 percent of the same-path file's words in its recorded,
vendored upstream base. Without that upstream file the ceiling is 1,000.
Count whitespace-separated tokens in the raw file. Upstream reconciliation
reports ceiling changes.
The ceiling runs in the existing read-set gate, has no reason-line override,
and starts with the eleven historical over-ceiling files and
`orchestrate/references/templates.md` as its twelfth shrink-only exception
under the [2026-11-27 decision](https://github.com/lutzseverino/repo-canon/issues/1285#issuecomment-7219486683).
The [exception record](../../scripts/skill-word-exceptions.json) freezes the
verified allowance for each file at the introduction base. Each file is bounded
by its frozen allowance and its base-branch count. Remove its exception when the
file becomes compliant or is deleted. Entries can only be removed after
introduction.
The byte ratchet retains its existing `Read set:` reason rule. Script output
also reports the `orchestrate` read set against a plan's pinned base,
replacing a manual retrospective comparison without dropping the requirement
that it end smaller.

ADR 0028's standalone promise, that an owned skill "can be installed and used
without adopting Repo Canon", is amended to **installed with the runtime its
commands need**. A standalone skill installation ships that runtime; the
installation mechanism belongs to implementation. If its bundled commands
still cannot start, the skill stops and reports the startup error, the PR and
head it left untouched, and the remedy: repair the runtime, then rerun.
There is no alternate merge path. Skills describe a bundled script only by
its command, exit codes and the agent's next step. This replaces the by-hand
fallback, whose existence required prose copies of script internals.

Every trim records each removed sentence's fate: enforced by script or test,
retained in its one rule home and pointed at, or deleted as a no-op or
sediment. Exit tables and genuine judgement clauses stay. Behavioural
coverage and exercise outcomes are preserved; assertions encoding only file
placement may change with review.

Owner, 2026-11-27T10:4xZ, in the skill-size grill: "Agreed to all", approving
Q1–Q5's guard, enforcement, interface-only script descriptions and sentence
fates. Owner, 2026-11-27T10:5xZ: "Agreed to all", approving Q6–Q9's complete
scope and check-first shrink-only sequence, with inferences 1–4, among them
this ADR and the per-file counting scope. Owner, 2026-11-27T11:0xZ:
"Agreed to all", approving Q10–Q12 and inferences 5–8: fixed-base reporting,
the all-skills ratchet, the runtime promise, base-branch shrink-only
comparison, vendored upstream counts and reviewed placement-only test changes.
At final approval, owner, 2026-11-27T11:0xZ: "Agreed to all", approving the
ticket outline, the plan 19 amendment and ADR publication. These decisions choose the
1,000/120-percent guardrail; it is not an upstream requirement.
