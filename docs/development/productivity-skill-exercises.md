# Productivity skill runtime exercises

This record covers the seven pinned productivity skills required by issue #13.
The exercises use disposable, scenario-specific Git repositories and controlled
participants where a skill requires interaction. Fixture creation, inventory
equality, and content inspection are prerequisites; none counts as runtime
evidence.

The exact exercised upstream identity is commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Each repository links its
`.agents/skills` entries to the complete corresponding directory under
`vendor/mattpocock-skills/skills/productivity`. The corrected fixture manifest
records builder SHA-256
`5ac890b4e46ae9865eb3b74f54b3d937857aaec88ba78a1018bab4b848037834`
at Repo Canon commit `3fe2736e39a33a753f13116c1e1224b866c954fb`.
That digest identifies the historical exercise builder; later provenance
fields do not relabel it as the current builder.

## Exercise correction and boundaries

An initial run was reviewed independently before being accepted as completion
evidence. The Spec review found that the fixture-specific root `AGENTS.md`
files did not preserve all shared repository guidance, and that the two
grilling exercises gathered facts in the primary agent rather than using the
pinned skill's required read-only sub-agent. The generator was corrected to
copy the exact shared root `AGENTS.md`, disable commit signing only in
repository-local Git configuration, and move the writing exercise target to
`docs/agents/project.md`. All seven skills were exercised again in fresh
repositories. The corrected run below is the authoritative evidence.

The corrected exercises ran on 14 September 2026 with `codex-cli 0.154.0`,
Node.js `v24.21.0`, Git `2.53.0`, and `gpt-5.6-terra` at high reasoning. The
[session-final index](productivity-skill-session-finals/README.md) retains every
final response and SHA-256. The [runtime artifacts](productivity-skill-runtime/README.md)
retain exact produced files. The [curated transcript](productivity-skill-runtime-transcript.md)
records literal invocations and controlled participant turns. Controlled
participant messages are explicit harness inputs, not claims about a real user,
approver, learner, or external recipient.

### `grill-me`

Session `01a0a1d7-f460-7722-8b9b-b1a36bbc756a` invoked `$grill-me` for an
Incident-card attention policy. The router selected `grilling` and delegated
repository fact-finding to read-only sub-agent `/root/dispatch_facts`. It named
the delegate and reported the returned facts: every card already has an Owner
and last-updated time, the display is a wall display, the first release may use
only those fields and cannot add notifications, and no ranking, threshold, or
visual policy was already settled.

Six controlled rounds then settled the complete reachable frontier: time since
update is the signal; all cards stay visible; attention begins at exactly 15
minutes; needing-attention cards sort oldest first; ties have equal priority;
the display uses explicit `Needs attention` text, elapsed time, and color;
elapsed time also appears below the threshold; reevaluation occurs at minute
cadence and immediately after an update; and Owner remains visible without
affecting rank. The agent summarized the empty frontier, asked for confirmation,
and ended after the participant confirmed. No files changed.

This bounded router run demonstrates selection of the downstream skill,
delegated facts, frontier rounds, recommendations, and the confirmation gate.
It does not validate the product policy or every possible router conversation.

### `grilling`

Session `01a0a1da-ca21-7060-95ea-06eef402b740` directly invoked `$grilling`
for a failed Export-request retry policy. It delegated repository facts to
read-only sub-agent `/root/repo_facts`, then identified the delegate and its
returned facts: archives expire after 24 hours, the queue supports delay and
records attempt count, support can see but cannot replay failures, the first
release cannot add paid infrastructure, and no retry policy or implementation
already exists.

Five controlled rounds settled transient explicit failures as the only retry
class, a six-hour Retry window, duplicate avoidance under uncertainty, three
attempts, customer cancellation, and visible success, cancellation, recovery,
and ambiguity outcomes. A new Export request is permitted only after confirmed
noncompletion; unresolved ambiguity cannot be resubmitted. The agent summarized
the empty frontier and waited for confirmation before ending. No files changed.

This exercise demonstrates the pinned fact delegation and decision-tree loop.
It does not implement or independently approve the resulting design.

### `handoff`

Session `01a0a1dd-e0bf-7602-8bff-21fe7fe20a32` invoked `$handoff` for a next
session that will add percentage-discount boundary tests and review the existing
implementation. The agent read the exact shared and scenario guidance, inspected
the implementation and Git state, and ran `node --test test/quotation.test.mjs`
(1 passed). It wrote the retained [handoff](productivity-skill-runtime/handoff.md)
in the operating-system temporary directory; its SHA-256 is
`800577c1e1ed9657adc771f584ffc81676dc5c5f778cd121a23b8cb9b1ebc9fb`.

The handoff references existing source artifacts, lists remaining boundary
cases and validation, suggests `tdd` and `code-review`, and preserves the
no-commit/no-publication boundary. The repository contained an ignored fake
exercise secret. The agent observed the ignored path but did not read or copy
its content. The handoff was not transferred or published.

### `teach`

Session `01a0a1df-09a3-72b3-8d7c-94dc97b00583` invoked `$teach` with the
vague topic “Git ancestry.” With no learning state present, it first asked for
mission, success evidence, prior comfort, time, source, and safety constraints.
The controlled learner supplied a release-script mission: decide whether a
candidate contains a required baseline with `git merge-base --is-ancestor`,
handle statuses `0`, `1`, and errors safely, use official Git documentation,
and keep the first lesson under 15 minutes without changing history.

The agent created the retained mission, notes, annotated resources, shared CSS,
HTML lesson, and reference sheet. The lesson teaches
`git merge-base --is-ancestor <baseline> <candidate>` and includes three
immediate-feedback retrieval/application controls. Independent Spec review
found that the first lesson revision lacked its reference-sheet link and used
unequal quiz-answer shapes. In the same teaching session, the agent linked the
reference and changed all accepted answers to two words and 18 characters,
then compiled the embedded JavaScript and verified both local links. The
controlled learner had already
answered the transfer from memory with the correct argument order and all three
status classes. The agent gave feedback, created a learning record and glossary
only for demonstrated knowledge, kept the mission unchanged, and assigned a
mixed-topology practice in one to two days. The complete workspace is retained
under [teach](productivity-skill-runtime/teach/).

An exact-head Codex review then found a defect in the explanatory shell
patterns: their comments promised to stop on an operational error, but the
branches did not terminate. A bounded `$teach` correction in the original
session added explicit exits to the lesson and quick reference. The retained
[lesson](productivity-skill-runtime/teach/lessons/0001-release-baseline-guard.html)
has SHA-256
`31f264a0046090db30b8cbd525b0486079c76fbffa223f6943acf64fbda5512a`;
the retained [quick reference](productivity-skill-runtime/teach/reference/release-baseline-guard.html)
has SHA-256
`3f24ccc271c58614e9db1a55b238edef34b7f008eaacfac58f85d77bd502c69a`.
The agent then exercised both extracted patterns against real sibling Git commits
and a real invalid-revision failure. Status `1` remained an ordinary rejection;
status `128` remained an operational error; neither execution reached a sentinel
after the guard. This correction does not replace or retroactively alter the
indexed original session responses.

Official Git documentation was fetched successfully. No graphical opener or
browser exists in the harness, so the HTML button clicks were not exercised;
the live persistent-session transfer loop exercised retrieval and feedback.

### `to-questionnaire`

Session `01a0a1ec-a0a4-7110-abd2-d90feebf930b` invoked
`$to-questionnaire` for missing operational evidence about a launch Retention
window and archive approach. The first exchange asked only for recipient role,
expertise, and relationship. The controlled participant identified the staff
reliability engineer who owns storage capacity, retention operations, restore
procedures, and incident response. The second exchange asked only what needed
to come back. The participant supplied the evidence list, deadline, effort,
and destination.

The agent then created and checked the retained
[questionnaire](productivity-skill-runtime/event-retention-questionnaire.md),
SHA-256
`6fc701db2ee729f7955091806560d5fee9b3e2cd21dc2e6f9e67dfcc1c2c337d`.
It requests source-linked volume and growth, incident/audit, cost, archive,
restore, deletion/legal, recommendation, risk, and uncertainty evidence by
18 September 2026 in about 20 minutes. It was not sent, and no specialist
response is claimed.

### `wait-what`

Session `01a0a1e6-18fb-7993-a529-1da4008b9839` first produced a precise,
implementation-oriented Import status. The controlled operator then invoked
`$wait-what`. The re-pitch preserved the verified counts and glossary terms in
three short paragraphs: 84 of 100 rows were accepted, 16 are malformed, the
Import batch is in Quarantine, no customer data was deleted, and the operator
must correct those rows and submit a new file. No files changed.

The before/after responses allow direct review of the actual re-pitch. This
bounded run has no formal plain-language conformance measurement.

### `writing-for-agents`

Session `01a0a1e6-fd80-7d41-b713-af7bdb60dc35` invoked
`$writing-for-agents` on a deliberately noisy scenario-specific
`docs/agents/project.md`. The exact shared root `AGENTS.md` remained unchanged.
The agent read the full pinned reference and downstream documents, removed
duplicated branches, vague no-ops, and cached validation detail, and left two
explicit pointers: synchronization behavior to `docs/agents/sync.md`, and
supplier fixtures to `docs/agents/fixtures.md`. `git diff --check` passed. The
exact result is retained as
[writing-for-agents-project.md](productivity-skill-runtime/writing-for-agents-project.md),
SHA-256
`1723db18f0c9a021402934de669b426f415ebd2da8509e138503b09aff7e90e5`.

A read-only probe showed the expected `.example` result, but independent Spec
review correctly noted that the root guidance requires the project pointer
before a change, so that prompt was weak routing evidence. Fresh session
`01a0a1f7-014c-7573-b403-d30b670ffdfc` then changed one supplier fixture. It
reported the exact path `AGENTS.md` → `CONTRIBUTING.md` →
`docs/agents/project.md` → shared development/domain guidance → `CONTEXT.md` →
`docs/agents/fixtures.md`, added fictional `Northstar` at
`https://northstar.example`, and passed `npm test` (2/2) plus
`git diff --check`. The exact changed
[test artifact](productivity-skill-runtime/writing-for-agents-probe-test.mjs)
is retained. This single change probe exercises the supplier branch; it does
not statistically establish reliability or probe the synchronization branch.

## Shared prerequisites and limits

- Each corrected fixture's root `AGENTS.md` is byte-for-byte identical to Repo
  Canon's shared root guidance. Scenario-specific constraints live in
  `docs/agents/project.md` and match the fixture facts.
- The manifest records complete-directory SHA-256 values: `grill-me`
  `5a13e157f85835632b132390a162d234822658b6a544f31cc2578280062bd044`,
  `grilling` `0ca4cfe5105d79c6ef6755491492e056c43e88b82666376d8ecd7fac695d96e6`,
  `handoff` `e5a44fccc710f5402deee06beaf5178397885765773375f186aefd179565f23f`,
  `teach` `7e67f13dc27781aad061d1eee61676c39c51d4d7ad6d7dc07ef943653c6e01ff`,
  `to-questionnaire` `915ac22f1133fd4a7899ac6536e704cae57f1104d45745b32193d1572332868f`,
  `wait-what` `3f2e7e2ce8820380c08df1d6f2d8dc6aaefe5c2857d00a7190990c62d4039316`,
  and `writing-for-agents`
  `0071124a923559493bc8924a90fb87bceb048d31ad2ce785fa4281d7c506bfa7`.
- Those skill values use
  `repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1`:
  depth-first traversal, JavaScript `localeCompare` ordering within each
  directory, then slash-normalized relative path, NUL, file bytes, and NUL.
  The current manifest also records SHA-256 for its builder and every copied
  shared-guidance file alongside the source `HEAD`, so dirty source inputs have
  their actual byte identity.
- The fresh repositories had no remotes. Repository-local signing was disabled
  to make fixture commits deterministic in environments with global signing.
- Sessions used danger-full-access only inside identified disposable local
  repositories so skill-authored artifacts could be created. No external
  messages, releases, production adoption, or settings mutations occurred.
- These bounded scenarios establish only the observed paths. They do not prove
  universal behavior across all tasks or harnesses.

## Reproduce the fixture harness

Use Node.js 24 from the Repo Canon root:

```bash
node scripts/create-productivity-skill-fixtures.mjs
npm run test:productivity-skill-fixtures
```

The builder prints a `repo-canon/productivity-skill-fixtures/v1` manifest with
the temporary root, repository heads, scenario-to-skill mapping, source
identities, and complete-directory hashes. `--root <unused-path>` creates the
same repositories at a chosen location. The focused test verifies exact shared
guidance, scenario prerequisites, intact skill links, disabled local signing,
clean initial Git state, an ordinary later commit under hostile global signing,
retained runtime outputs, and the teaching loop.
