# Skill exercises

This procedure exercises the pinned skills under `vendor/mattpocock-skills`
and Repo Canon's `triage` fork and `orchestrate` skill against disposable local Git repositories. Run it when a release changes a
skill, as the [release procedure](release.md#when-selected-bytes-change)
requires, for the changed skills. Three builders create the repositories: one
each for the engineering, productivity, and planning skills, which together
cover all 16 pinned workflow skills, the `triage` fork and `orchestrate`. Repo Canon's own `babysit` skill acts on a live pull request, so no builder covers it; exercise
it on a pull request in a disposable GitHub repository. Its wait script has
its own fixtures, which the [development guide](README.md) names.

Building and testing the fixtures is a prerequisite, not an exercise. An
exercise is an agent session that invokes the skill in a fixture repository
and produces an observed outcome.

## Common harness

The builders need only Node.js 24 or 26 and Git. The agent harness is a prerequisite
of the exercise, not of the builders, and no builder calls it. Run every
command from the Repo Canon root.

Each builder creates its repositories under a new temporary directory, or under
`--root <path>`, which must not exist yet. Each repository has real Git history,
shared contribution and tracker guidance, scenario-specific project guidance
in `docs/agents/project.md`,
and repository-scoped `.agents/skills` symbolic links to the complete
skill directories it needs. The repositories set `commit.gpgsign=false` in
repository-local configuration and have no remote.

Each builder's manifest maps every repository to its skills and records the
source `HEAD`, the SHA-256 of the builder, the shared fixture-authoring module,
and every copied file, and a digest of every linked skill directory. The digest
format is `repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1`:
traverse directories depth first, sort each directory's entries with JavaScript
`localeCompare`, and append each slash-normalized relative path, NUL, file
bytes, and NUL to the SHA-256 stream. These values identify the bytes actually
used even when the source worktree has uncommitted changes.

Run one session per scenario, with the fixture repository as its working
directory:

- Require the agent to read the exact repository-scoped `SKILL.md` before it
  acts.
- Prohibit remote contact: no issue, branch, release, adoption, setting,
  variable, secret, or message is published.
- Relax the harness sandbox, if at all, only inside the disposable repository.
  A sandbox that mounts `.git` read-only blocks the commits that the debugging,
  TDD, and planning scenarios make.

For example, with Codex CLI:

```bash
codex exec --json -c 'model_reasoning_effort="high"' \
  -C <fixture-repository> <scenario-prompt>
```

A scenario establishes only the path it exercises, not every behavior of the
skill. Report each outcome in the pull request that needs it, such as the
release pull request. Session output, transcripts, and produced artifacts are
not committed.

## Engineering skills

```bash
node scripts/create-engineering-skill-fixtures.mjs
pnpm run test:engineering-skill-fixtures
```

The builder prints its JSON manifest. Five repositories exercise seven
engineering skills: `review` for `code-review`; `architecture` for
`codebase-design` and `improve-codebase-architecture`; `debugging` for
`diagnosing-bugs`; `modeling-research` for `domain-modeling` and `research`;
and `tdd`. The scenarios supply a domain glossary,
applicable ADRs with their indexes, contributor commands, source, tests, requests, and
specifications.

The research exercise needs web search, such as Codex CLI's `--search` option.
Opening the architecture report needs a browser; in a headless harness, render
it with a local headless browser and inspect the result.

The test verifies the shared and scenario guidance, domain and development
context, ADR indexes, skill links and digests, the review specification, a
build from a Repo Canon checkout without an `origin` remote, and an ordinary later
commit under a host that requires signing with an unusable program.

## Productivity skills

```bash
node scripts/create-productivity-skill-fixtures.mjs
pnpm run test:productivity-skill-fixtures
```

The builder prints a `repo-canon/productivity-skill-fixtures/v1` manifest. Each
of the two skills has its own repository: `grilling` and `writing-for-agents`.
The root
`AGENTS.md` is byte-for-byte the shared guidance, and the scenario constraints
live in `docs/agents/project.md`; the `writing-for-agents` exercise edits that
file.

`grilling` needs a participant. Supply the participant's turns as explicit
controlled inputs, and do not present them as a real user or approver. It must
delegate repository fact-finding to a read-only sub-agent; facts gathered by the
primary agent do not exercise it.

The test verifies the exact shared guidance, the scenario prerequisites, intact
skill links, disabled local signing, a clean initial Git state, and an ordinary
later commit under hostile global signing.

## Planning skills and project-agent-guidance contextual work

```bash
node scripts/create-planning-skill-fixtures.mjs
pnpm run test:planning-skill-fixtures
```

The builder writes `manifest.json` under its root and prints that path. Seven
repositories cover nine skills: `project-agent-guidance`, which links no skill,
supplies existing project-specific `AGENTS.md` instructions for the
`project-agent-guidance` contextual work described in
[adoption compatibility](adoption-compatibility.md#preserving-project-instructions);
`planning` for `grill-with-docs`, `to-spec`, and `to-tickets`;
`triage-wayfinder` for `triage` and `wayfinder`; `factory-planning` for
factory-profile triage and readiness decisions; `triage-routing` for routing
by uncertainty and brief acceptance; `orchestrate` for the workbench plan lifecycle;
and `delivery` for
`implement`, `pr`, and `prototype`. The delivery repository
includes a local specification and child ticket for the ticket exercise, plus before-and-after evidence for a local PR body draft. The manifest also records the
support skills that exercised skills depend on, such as the productivity
`grilling` skill that `grill-with-docs` uses.

Every repository has a `docs/exercise.md` task and expected outcomes. Start
there, read the repository-scoped `repository-standards` skill, and run:

```bash
node .agents/skills/repository-standards/rules.mjs
node .agents/skills/repository-standards/rules.mjs <path-to-change>
```

This exercise-only adapter reads a self-contained local index under
`.repo-standards/rules/`; its README links the canonical rules copied from the
source checkout. Both commands expose repository-wide requirements, including
tracker work that changes no file. The adapter and rules are copied rather
than linked, so lookup needs only Node.js and stays local. It does not install
the production CLI or exercise adoption, available-update discovery, or full
adopting-repository conformance. Root guidance points to this adapter; the
upstream workflow skills remain intact.

All scenarios explicitly use `standard`, except `factory-planning`,
`triage-routing` and `orchestrate`, which use `factory`. Standard scenarios
expose GitHub repository configuration rules without factory workflow rules.

For `triage-wayfinder`, follow the numbered checkpoints in `docs/exercise.md`
within 20 minutes. The operator holds back `.scratch/triage/owner-inputs.md`
and `review-inputs.md`; the agent must not read ahead. Begin with the unresolved
CSV intake and a separate research session gathering facts without a brief.
Observe the orchestrating agent's local decision inbox, the three missing
header/interface/source choices, and `needs-info` with no brief or readiness.
Only then relay the controlled owner answers to a separate grill. These dated,
cited answers settle exercise behavior only; the grill records them and drafts
the brief. The accepting reviewer must be a different session from its writer.
When the harness cannot nest sessions, start fresh research and grill sessions
and relay their outputs verbatim to the orchestrating reviewer.

After the actual draft exists, relay review-inputs step 1: retain its exact r1
text, supply the simulated revision notice identifying it, and record the
independent review's actual acceptance or rejection. Rejection returns to the
writer for correction and another notice/review; no input preapproves a draft.
Only an accepted revision with its notice may receive simulated readiness.
Then relay step 2's supplied Summary edit, retain r2 alongside r1, and observe
readiness invalidated while r2 has neither its notice nor renewed review.
Only then relay step 3's r2 notice and independently review that exact text
before renewing readiness if accepted. The Wayfinder outcome still selects
child 02 while child 03 remains blocked; maps and children stay outside
readiness and workflow state. No factory model suggestion is required.

Report the observed checkpoints, retained text identities, review verdicts and
rule sections separately from builder/test success. All participant relays,
notices, reviews and tracker artifacts are local simulations, with no remote
publication, real authority or factory launch. A timeout or unavailable session
is an exercise limit, never a pass.

The factory-planning scenario exposes both rule sets and runs in stages. First, invoke
`triage` as the orchestrating agent on the unresolved export request. Its
public CSV headers, invocation interface and receipt source are missing:
research gathers facts, and the questions reach a separate grill through the
orchestrating agent's decision inbox. Expect no brief or readiness at this
checkpoint. Only then relay `.scratch/receipts/owner-inputs.md` as controlled
participant answers. The grill records those answers and drafts the brief;
the orchestrating agent reviews it independently and never authors a brief it
accepts. The answers choose only simulated exercise behavior.

Next relay `.scratch/receipts/review-inputs.md` in order: retain r1's exact
text, supply its simulated revision notice, record the independent review and
reviewer's chosen model, then edit the summary to r2. Readiness is invalidated
until r2 has its own notice and independent review. A model suggestion follows
the completed brief in triage notes; the accepting reviewer chooses the label.
The later release ledger explicitly supplies simulated approved parent/child
contracts; it does not grant the unresolved intake approval. It covers the
parent never running, same-second and later-ticket parent readiness, each
ticket's own readiness/model, and an open blocker becoming closed. No factory
is launched. Run this scenario within 20 minutes, with fresh research and grill
sessions and verbatim operator relays if the harness cannot nest them. A timeout
or unavailable session is a recorded exercise limit, never a pass.

The `triage-routing` scenario has the agent act as the orchestrating agent on
three requests: a bug whose documentation states the expected result, a bug
whose fix needs a Retry window nobody chose, and a feature request. Each
research run is a separate session with a fresh context; when the harness
cannot nest sub-agents, the operator runs it and relays its messages verbatim.
The operator keeps `.scratch/routing/review-inputs.md` and `owner-inputs.md`
private and releases the numbered participant turns at their checkpoints.
Start with turn 1 only. Release request 02's controlled owner answers in turn 2
only after its separate grill asks the numbered questions. They choose a
synthetic 60-minute Retry window measured from the first transient failure,
allow retries strictly before that boundary, and retain the recorded
transient-failure decision. The grill cites the supplied date and answer source;
these simulation values establish no policy for real software.

The bug's seeded first brief revision passes the Agent Brief shape but
not review, so its outcomes cover the challenge, the research run's
correction, and acceptance of the corrected revision with a chosen model label
and a recorded blocker. The second bug's outcomes cover fact-finding, a persisting
Retry window the orchestrating agent never infers, a separate grilling session
that asks numbered owner questions with recommendations and drafts the brief,
a recorded owner decision reused rather than asked again, and refusal of a
brief that leaves owner intent open.

Turn 3 retains the complete corrected comments, including triage notes and
whitespace, and computes their notices with the fixture's local
`docs/revision-notice.mjs`. Each notice binds a concrete `sha256:` identifier
to the retained text and simulated comment identity/edit timestamp using the
issue-contract validator's revision convention. Dynamic drafts receive no
identifier before their text exists. The helper computes identity only;
structure and independent acceptance remain separate checks. Turn 4 requires
an independent review, the reviewer's chosen model and request 01's ticket 05
blocker before reporting acceptance.

Turn 5 actually edits request 01's accepted retained Summary, preserving both
texts. Observe readiness invalidated and record the missing-notice handoff
while withholding the new notice. The old notice cannot authorize the edited
comment. Only after that outcome is recorded does turn 6 compute and relay
the changed revision's notice for renewed independent review and readiness.
Turn 7 records the write-role-only and GitHub App credential handoffs.
All readiness actions are local Markdown simulations: never run `ready.mjs`
or live readiness automation. Retain the delivered turns, times, exact
contracts, notices and observed outcomes with the run outside maintained
documentation. Fixture regression checks verify these inputs and their
revision associations; they do not establish that an agent performed the
exercise.

Check produced briefs against the discovered GitHub rules' shape and ordering,
and readiness decisions against those rules and `CONTRIBUTING.md`. Record the
rule paths and sections used with each observed outcome. Review inputs are
explicit participant-controlled simulations: a contract revision must lose
readiness until renewed review. All issue and PR artifacts remain Markdown;
exercise sessions require no remote contact, package downloads, publishing,
real issue/PR writes or factory operations.

The local Markdown tracker cannot supply GitHub
permissions, issue-event IDs, or native relationships; the
[issue contract fixtures](issue-contract-validation.md) cover those.

The manifest records each scenario's profile and applicable rule source paths,
plus hashes of both canonical rules, every lookup input and the local tracker
seed under `source.inputFiles`. Linked workflow skill digests remain under
`source.linkedSkillDirectories`.

The tests verify every repository and skill link, `triage` linking the fork,
the seeded revision passing the issue-contract check, the manifest identities,
canonical rule bytes, local index and lookup discovery, profile isolation,
lookup after relocation with an empty command search path, missing rule failure,
local signing, an ordinary later commit under hostile global signing, and the
managed-update boundary: a synthetic change to a candidate copy of a vendored
skill is detected while the vendored directory stays unchanged.

## Orchestrate: two sessions and a local workbench

Use the planning builder above from the candidate checkout. Its manifest entry
`repositories.orchestrate` names the disposable project, its initial commit,
and a separate `workbench` with its own initial commit. Both start clean on
`main` with local signing disabled and no remote. The project links the exact
candidate `.agents/skills/orchestrate` directory, whose digest the manifest
records alongside the source HEAD and builder/input hashes. No package install
is needed. Keep the workbench path in the exercise sandbox's writable roots.

Prerequisites are Node.js 24 or 26, Git, an agent harness that supports a fresh
session and returning to an existing one, and an operator playing the controlled
participant. Use the harness's actual opaque session references, retain the
manifest and delivered prompts outside the repositories, and take timestamps
from the UTC clock. Supply this instruction before the first proposal:

```text
This is a local simulation. For this exercise only, the owner's global
instruction names <absolute-workbench-path> as the workbench. Work in
<orchestrate-project-path>. Read the exact repository-scoped
.agents/skills/orchestrate/SKILL.md, the local guidance, and docs/exercise.md.
I will relay docs/participant-inputs.md one turn at a time; do not read ahead.
Use only local Markdown tracker and workbench artifacts. No remote issue, PR,
message, schedule or factory operation is authorized. Report checkpoints and
wait for the next controlled turn.
```

Allow at most 10 minutes per session, 20 minutes total. The operator reads
`docs/participant-inputs.md` and relays turns 1–7 to session one at their stated
checkpoints, including 1a–1c and 6a–6c. Before approval, observe registration
of the proposal, filing without readiness, and heartbeat coverage of the filed
factory ticket and its recorded blocker without a PR or directly launched
worker. The ticks simulate the existing configured cadence; create no live
schedule. Check that the answered blocker question without continuation is
surfaced with dated issue/run/PR evidence, separately from approval and blocker
waits. Intervention follows the installed recovery rules and grants no execution.
Turn 2 records plan approval separately from independent contract review and
all other readiness gates. Observe the pending amendment before supplying
turn 5. The in-goal row cites the approved review goal; the amendment changes scope only after approval. The wish is a
future multilingual-guide capability, not a defect or Finding, and needs no issue.
Turns 6a–6c add two out-of-goal Findings in the separate simulated tooling
tracker: reuse the existing open UTF-8 crash issue, then file the stale-option
finding with that tracker's bug form and `needs-triage`. Check the supplied
observed command outcomes are cited, both findings are linked from a comment
on review ticket 01 (there is no PR), and the optional planning wish links the
reported finding without replacing its issue or reporting links. The method
follows the contribution guide's Findings section, including its reporting
fallback when filing fails; neither repair delays the documentation plan.
At turn 7 relay `docs/closure-inputs.md` and materialize its simulated PR
findings, no-PR issue comments, issue-less run's final message and current
tracker records. Keep the factory-only finding out of the ticket table and
initial creation log so reconciliation must recover it from the PR comment's
creation evidence. Consolidate duplicate links by repository and issue number;
the same number in two repositories denotes two issues. Check the final list
against the input's explicit oracle: five still-open plan-filed issues, each
with its reason and evidence, excluding a closed issue, pre-existing linked
findings and unrelated concurrent work. The project counts are zero at start
and two at close; tooling has five open issues at close, including unrelated
and pre-existing work. Tracker updates are controlled simulations; no worker
implements or delivers a product change.

End session one with unfinished rows and committed active state. Start session
two with a fresh context, the same project/workbench paths, its own session
reference, and turn 8. Give it no session-one transcript or artifact summary.
It reads `index.md`, `inbox.md` and active plans before other work, then the
skill/local guidance. Inspect the recorded takeover and preserved previous
owner, and confirm the plan remains open. Relay turn 9: the owner drop remains
in the table and the already-filed parked issue stays open. Relay turn 10:
only then may the remaining closed simulated issues plus the owner drop permit
closure. Check the final counts and closing announcement against the skill.
The suggested next direction is not a new approved plan.

Report with the run or PR that needs the exercise: source and skill digests,
fixture/initial commits, actual session references, delivered turn references
and times, observed proposal/approval and routing checkpoints, fresh-session
resume and closure, and any limits. Retain transcripts and resulting workbench
commits outside maintained documentation. Builder tests establish setup
correctness; only these agent sessions establish exercise outcomes.
