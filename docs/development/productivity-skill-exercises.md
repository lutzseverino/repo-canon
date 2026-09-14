# Productivity skill runtime exercises

This record covers the seven pinned productivity skills required by issue #13.
The exercises use disposable, scenario-specific Git repositories and controlled
participants where a skill requires user decisions. They do not treat fixture
creation, inventory equality, or content review as runtime evidence.

The exact exercised upstream identity is commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Each repository links its
`.agents/skills` entries to the complete corresponding directory under
`vendor/mattpocock-skills/skills/productivity`; the fixture manifest records a
SHA-256 for each directory, the builder, and the Repo Canon commit used to
create it.

## Runtime evidence

The exercises ran on 14 September 2026 with `codex-cli 0.154.0`, Node.js
`v24.21.0`, and Git `2.53.0`. Sessions used `gpt-5.6-terra` at high reasoning
except one `grill-me` continuation that resumed as `gpt-6-astra` because the
model flag was accidentally omitted; the following and final turns returned to
the intended model. All work stayed inside the generated local repositories or
the operating-system temporary directory. Those repositories have no remotes.

The [session-final index](productivity-skill-session-finals/README.md) records
each persistent session ID, turn, exact final-response SHA-256, and retained
file. The [runtime artifacts](productivity-skill-runtime/README.md) preserve the
files produced or changed by the skills. The [curated transcript](productivity-skill-runtime-transcript.md)
records the literal invocations and controlled participant turns. The controlled participant messages
quoted below were supplied by the exercise operator; they are test inputs, not
claims about a real user or external recipient.

### `grill-me`

Session `01a0a1bf-4907-7ee1-a44a-247b91dc5939` invoked `$grill-me` for a
dispatch-board decision. The router explicitly announced that it was using
`grilling`, read the linked full `grilling` skill, inspected the local wall
display constraints, and asked the current decision frontier with a
recommendation. The controlled participant chose unowned Incident cards first,
then oldest update time, supplied an identifier tie-break, and chose a textual
priority marker. The agent declared the frontier empty, summarized all settled
branches, requested confirmation, and ended only after explicit confirmation.
Both repository status and the session report showed no file changes.

This is one bounded router exercise. It establishes that this harness can
follow `grill-me` into the selected `grilling` skill and complete its
confirmation boundary; it does not establish every possible router or design
conversation. One continuation used the wrong runtime model as noted above,
without changing the invoked skill bytes or repository state.

### `grilling`

Session `01a0a1c0-e7dd-7810-aead-c76fa8696578` directly invoked `$grilling`
to stress-test automatic retries for failed Export requests. The agent found
the 24-hour archive expiry, existing delayed queue and attempt counter, absent
support replay, and no-new-paid-infrastructure constraint itself. It then used
six participant rounds: the first frontier settled retry eligibility, snapshot
semantics, the Retry window, and allowed infrastructure; later frontiers
settled only decisions unlocked by those answers, including classification,
attempt budget, idempotency, fairness, fixed offsets, and `Retry-After`
interaction. The last response recorded the complete design tree and asked for
confirmation before action. The participant confirmed, and no files changed.

The exercise demonstrates fact gathering, recommendations, frontier ordering,
dependent rounds, an empty-frontier summary, and the explicit confirmation
gate. It does not validate the resulting product design or implement it.

### `handoff`

Session `01a0a1c5-194d-7281-a614-12b2ba770cf6` invoked `$handoff` with the next
session focused on boundary tests and review of a Quotation discount. The agent
read the implementation contract and current files, ran the focused test
(1 passed), checked Git state, and wrote a 1,609-byte handoff under
`/tmp/percentage-discount-handoff.aAWHsr/HANDOFF.md`. The retained
[handoff](productivity-skill-runtime/handoff.md), SHA-256
`539bc4827b3c3d3507077b8f33aae1eb817b75930fdcd5e83205d10338352b24`,
references source artifacts rather than copying them, lists remaining work and
validation, includes `tdd` and `code-review` under Suggested skills, and states
the no-commit/no-publication boundary.

The repository contained an ignored fake exercise secret. The agent observed
the ignored path but did not read or reproduce its content; a follow-up search
verified that the handoff directory contained only `HANDOFF.md`. The exercise
did not transfer the handoff to another agent, test a real secret, or publish
anything.

### `teach`

Session `01a0a1c8-f739-7101-a088-a41770431ca2` invoked `$teach` with the vague
topic “Git ancestry.” With no `MISSION.md`, the agent first asked the controlled
learner for the concrete release decision, success evidence, prior comfort,
time limit, and exclusions. After the learner answered, it used the official
Git `git-merge-base` documentation as its primary source and created a mission,
annotated resources, notes, a reusable stylesheet, a reference sheet, a
10-minute HTML lesson, and a learning record for stated prior knowledge.

The lesson teaches the public `git merge-base --is-ancestor <baseline>
<candidate>` seam, separates status `1` from command errors, and contains two
button-based immediate-feedback exercises plus a transfer prompt. The
controlled learner answered the transfer prompt from memory. The agent gave a
precision correction (all statuses other than `0` and `1`, rather than only
`2`, are errors), created a glossary only after demonstrated use, wrote a second
learning record with the evidence, left the mission unchanged, and scheduled
spaced practice for 16 September. The complete retained teaching workspace is
under [teach](productivity-skill-runtime/teach/).

The first large patch failed validation and the agent recovered by applying
smaller changes. Two later validation commands also needed correction before
`git diff --check`, embedded JavaScript syntax, and local-link checks passed.
No graphical opener or browser exists in the harness, so the lesson was not
opened and its button clicks were not exercised; the live learner feedback loop
used the lesson's transfer prompt through the persistent session instead.

### `to-questionnaire`

Session `01a0a1c6-3c75-7843-b79f-832092d309cf` invoked `$to-questionnaire` for
an Event-retention decision. Its first response incorrectly asked for a subject
fact (daily Event volume), violating “grill the send, not the subject.” The
exercise controller did not invent an answer or count that turn as success. It
identified the violation, directed the agent to the pinned file, and restarted
step 1. The agent then asked one exchange for the recipient's role, expertise,
and relationship; after that answer, it asked one exchange for the exact facts
and decisions needed back.

Using the participant's recipient, deadline, effort, destination, and required
input list, the agent created and checked the retained 2,410-byte
[Event-retention questionnaire](productivity-skill-runtime/event-retention-questionnaire.md),
SHA-256
`c860383bad3c52afd5f88eb8dea4b071ae119b9605eb0f7991a6f82aaca8fd10`.
It has purpose/from/to/use metadata, context, answer instructions, separate
most-important-first questions with answer stubs, selective rationale, and the
catch-all. The search verified coverage of every requested decision input.

This records both the initial instruction-following defect and successful
recovery. The questionnaire was not sent to a real reliability engineer and no
answers from such a person are claimed.

### `wait-what`

Session `01a0a1c7-b047-7823-9b72-7391ab779d75` first produced an
implementation-oriented status for a quarantined import. The controlled
operator then invoked `$wait-what`, saying the explanation had not landed. The
new response added the necessary context, used the glossary's **Import batch**
and **Quarantine** terms, used short sentences and direct verbs, stated that no
customer data was deleted, and gave three ordered recovery actions. It also
clarified that automatic retry would not occur. No files changed.

The before and after responses are retained so review can compare the actual
re-pitch. This bounded exercise did not run a formal ASD-STE100 conformance
checker; the observation is a manual review of the response against the skill's
plain-language and ubiquitous-language directions.

### `writing-for-agents`

Session `01a0a1c8-3773-78e1-b95e-f4ccbd51eda7` invoked
`$writing-for-agents` on a deliberately noisy fixture `AGENTS.md`. The agent
read the full pinned reference, removed vague no-ops and three duplicate/cache
pointers, and produced one six-line pointer containing exactly the two real
branches. `git diff --check` passed. The exact result is retained as
[writing-for-agents-AGENTS.md](productivity-skill-runtime/writing-for-agents-AGENTS.md),
SHA-256
`4e776d42be735cf78a07c961f151e4e4143472830be166ae4f772105f3908def`.

A fresh probe session, `01a0a1c8-afba-7b13-8b15-36c82a719ae5`, requested a
supplier fixture without naming either downstream document. The new pointer
caused the agent to read `docs/agents/project.md`, then
`docs/agents/fixtures.md`, and propose a fictional supplier on the reserved
`.example` domain. Its broad `rg` command also named a nonexistent `README.md`
and exited 2 after returning all needed matches; the agent still based its
answer on the correct files. This one probe shows the supplier-fixture branch;
it does not statistically establish pointer reliability or probe the separate
synchronization-behavior branch.

## Shared prerequisites and limits

- The complete pinned directories were present through repository-scoped
  symlinks, with no edits to upstream bytes. The generated manifest recorded
  these SHA-256 values: `grill-me`
  `5a13e157f85835632b132390a162d234822658b6a544f31cc2578280062bd044`,
  `grilling`
  `0ca4cfe5105d79c6ef6755491492e056c43e88b82666376d8ecd7fac695d96e6`,
  `handoff`
  `e5a44fccc710f5402deee06beaf5178397885765773375f186aefd179565f23f`,
  `teach`
  `7e67f13dc27781aad061d1eee61676c39c51d4d7ad6d7dc07ef943653c6e01ff`,
  `to-questionnaire`
  `915ac22f1133fd4a7899ac6536e704cae57f1104d45745b32193d1572332868f`,
  `wait-what`
  `3f2e7e2ce8820380c08df1d6f2d8dc6aaefe5c2857d00a7190990c62d4039316`,
  and `writing-for-agents`
  `0071124a923559493bc8924a90fb87bceb048d31ad2ce785fa4281d7c506bfa7`.
- The builder SHA-256 was
  `a85bdce314e9221026c456bbb7415a5d9e95cafa6de9b14f6696613c938e5564`
  at exercise commit `c931a1d30e9ccb930f1d3cd731925c253deb860a`.
- Persistent Codex sessions supplied the required interaction boundary. The
  exercise operator transparently played the controlled participant. No real
  user approval, recipient response, or external interaction is claimed.
- The Codex sessions used danger-full-access only inside identified disposable
  local repositories so skill-authored files could be created. No repository
  had a remote, and no external messages, releases, adoption, or settings
  mutations occurred.
- These bounded scenarios establish the observed paths only. They do not prove
  universal usability, production adoption, or behavior in every supported
  harness.

## Reproduce the fixture harness

Use Node.js 24 from the Repo Canon root:

```bash
node scripts/create-productivity-skill-fixtures.mjs
npm run test:productivity-skill-fixtures
```

The builder prints a `repo-canon/productivity-skill-fixtures/v1` manifest with
the temporary root, repository heads, scenario-to-skill mapping, source
identities, and complete-directory hashes. `--root <unused-path>` creates the
same repositories at a chosen location. The focused test verifies that every
repository has its scenario-specific guidance, domain language, development
instructions, required facts, intact skill links, and a clean initial Git
state.
