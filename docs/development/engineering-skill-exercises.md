# Engineering skill runtime exercises

Issue [#12](https://github.com/lutzseverino/repo-canon/issues/12) required
runtime exercises of the nine remaining pinned engineering skills. On 14
September 2026, each skill ran against one of six disposable Git repositories
created by `scripts/create-engineering-skill-fixtures.mjs`. These are observed
results from Codex sessions, not an inventory check or a claim that a skill
file exists.

The [curated runtime transcript](engineering-skill-runtime-transcript.md)
retains every session's final response and its SHA-256 digest. The
[architecture report](engineering-skill-architecture-report.html) and
[research result](engineering-skill-research-result.md) retain the two durable
artifacts produced by those skills.

## Evidence boundaries

The fixtures installed the shared `AGENTS.md`, `CONTRIBUTING.md`, and agent
guidance, plus scenario-specific project guidance, a domain glossary,
applicable ADRs, contributor commands, source, tests, requests, and
specifications. Each repository exposed only the relevant vendored skill
directories through repository-scoped `.agents/skills` symlinks.

The sessions ran with Codex CLI 0.154.0, model `gpt-5.6-terra`, high reasoning,
Node.js 24.21.0, and Git 2.53.0. The invocation shape was:

```bash
codex exec --json -m gpt-5.6-terra \
  -c 'model_reasoning_effort="high"' \
  -C <disposable-repository> <scenario-prompt>
```

The research exercise also passed `--search`. Every prompt required the agent
to read the exact repository-scoped `SKILL.md` before acting. The sessions did
not publish changes, contact an issue tracker, adopt Repo Canon in another
repository, configure production, or create a release.

The authoritative fixture root was
`/tmp/repo-canon-skill-exercises-12b`. Its worktree `HEAD` was
`69765e22b20b226f33cd95b84a87511e24e16c33`, while the builder also contained
an uncommitted correction that replaced Repo Canon's project guidance with the
scenario-specific guidance used by every authoritative session. The resulting
runtime builder had SHA-256
`bdad304ebd987297f1d7c3b6604c71808db49d9cc2ca09afbabe900a38fcf478`.

The current builder retains that scenario-guidance correction and adds
manifest self-identification, optional-remote handling, and ADR directory
indexes. Its SHA-256 is
`388b4ddecba226449cdd36322417b9e3b0a42d376cc7ce12a235828e16800b19`.
Applying the [retained reverse patch](engineering-skill-runtime-builder.patch)
to the current builder reconstructs the exact runtime bytes:

```bash
cp scripts/create-engineering-skill-fixtures.mjs /tmp/runtime-builder.mjs
patch /tmp/runtime-builder.mjs \
  < docs/development/engineering-skill-runtime-builder.patch
sha256sum /tmp/runtime-builder.mjs
```

The additional retained harness behavior does not alter the skill bytes or the
substantive scenario source used during the exercises.

## Exercised skill identity

The vendored source records upstream commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Each digest below covers the
complete skill directory: sorted relative path, NUL byte, file bytes, and NUL
byte, hashed with SHA-256.

| Skill | Complete-directory SHA-256 |
| --- | --- |
| `ask-matt` | `0261a2abbd43cc5bb391878106cda2eb7c4eabdde9ba5701b51d831f6e98f658` |
| `code-review` | `12daafb9c4f77deb3c3303dc2e6f8a3c2a0ff7928fc004af959ba18b8bd38068` |
| `codebase-design` | `9f457cc65ef2d70eb5b8a44a4dae2b139840078b6596a67ee8c4e95f5a0e6f5c` |
| `diagnosing-bugs` | `bcdaec9e1033901c396437fcb102161d8ad3cd87632007aaf270b19e03e70117` |
| `domain-modeling` | `2bc3bb0a64ea9c6f5c3bcf78fc17f0fcdc7c062edc547ef006441de0b576d248` |
| `improve-codebase-architecture` | `86f5e0413fa5b42b8e954858a09ce5a73187c61169f1b3b199bc79416fd78086` |
| `research` | `75b7f9bbd7ccff6755a006f8b25d319a46ecbf6bd4b4c3323965ed9cb65e78ff` |
| `resolving-merge-conflicts` | `310fa72a34cddd1dd1a9790f9ebc17bf2c83caeae5cdf87e2485be8b1abec90e` |
| `tdd` | `28b5e430968370f51b03b88b4b4a046286192733d2f45bd5b8049e16f45fd234` |

## Observed results

### `ask-matt`

Session `01a0a19a-0387-7151-b78f-0d644f6ef0fa` received an intermittent
Ledger regression report. It selected `/diagnosing-bugs`, followed by
`/implement` driving `/tdd`, then `/code-review`. It reserved `/triage` for
raw intake and explicitly preserved the diagnosis-to-implementation context.
This exercised routing only; the downstream behaviors ran separately below.
The fixture stayed unchanged.

### `code-review`

Session `01a0a19a-034c-7f13-8b1a-cfa19352cace` reviewed
`a76179c03e10557ab63bd26b96932f6dd9613a24..f75b4085387f1c9f8822e511f82a991051cfb88d`
in `routing-review`. It spawned independent Standards and Spec agents in
parallel and waited for both. Standards reported one judgment call, the
mysterious `x` variable, and no documented-standard violation. Spec reported
missing pending totals, invalid-state rejection, and their tests; it also
identified the implemented pending result as wrong and found no scope creep.
`npm test` passed. The fixture stayed unchanged.

The Spec report described the missing pending behavior both as an unmet
requirement and as implemented-but-wrong. The retained result preserves this
overlap instead of normalizing the reported count after the fact.

### `codebase-design`

Session `01a0a19a-03af-7d03-94df-418c28d1eddb` read the Ordering glossary and
currency ADR, then spawned three independent design explorations. It compared
a minimal `acceptOrder(text)` seam, a configurable preparation catalog, and a
common-caller-first seam. The recommendation combined the minimal and
common-caller designs because one interface hid parsing, validation, and
normalization with the best present-day locality. It also found that the ADR
requires ISO membership while the fixture only uppercases arbitrary strings.
This was design analysis; it intentionally made no source change.

### `improve-codebase-architecture`

Session `01a0a19a-03c7-7441-aa74-5dc8824458be` read Git history, the glossary,
the ADR, and the source with a delegated codebase walk. Its initial 10,138-byte
report showed two before/after candidates and recommended deepening Order
intake at `acceptOrder`. The attempt to open it failed because `xdg-open` was
not installed.

A Chromium render then exposed a real overlap between the first Mermaid graph
and its following prose. A continuation produced the corrected 9,852-byte
[visual report](engineering-skill-architecture-report.html), SHA-256
`bc78f65f4e9d2e32965f5c47cf56a59f7c2477d2506f9fb000e9386353f9e270`.
Verification session `01a0a1b9-7aa0-72e1-b545-b1e8b3cbc9ed` recorded that the
default sandbox prevented Chromium startup. Completion session
`01a0a1ba-a291-73d3-b735-efe1ab5044a9` used sandbox bypass only for the local
headless browser. It produced a 375,968-byte PNG with SHA-256
`c1cce255fde0035e3a87db9aed7dede7eac3feeb7c3b17292f857cb1e2ca1a4e`,
found one rendered Mermaid SVG, and measured the Candidate 01 visual grid
ending at y=798 before its detail grid began at y=822. An operator also
inspected the PNG and confirmed the two complete candidates rendered without
overlap. The screenshot remained a disposable local verification artifact;
the corrected HTML is retained. The fixture stayed clean.

### `diagnosing-bugs`

Sessions `01a0a19d-193a-75e2-85cf-9538607448d5` and
`01a0a19f-e2ce-7022-91b2-833c95133fdd` exercised the complete diagnosis loop
in `debugging`. The agent ran the failing suite, reproduced the failure at the
public seam with two descending Invoice lines, ranked four falsifiable
hypotheses, and trapped the array sort to confirm mutation. It changed
`lines.sort(...)` to `[...lines].sort(...)`, then passed the focused
reproduction, `npm test`, and `git diff --check`. The local fixture commit is
`4c832431f70530087ec69699dba07e92c79ff495` with subject
`fix(invoice): avoid in-place sort that reorders caller lines`.

### `domain-modeling`

Session `01a0a19d-1971-7273-b0a3-8a70e7c6839a` reconciled the overloaded
Account term with Subscription code and the external-authentication ADR. It
updated the fixture glossary to define **Authentication Identity**, owned by
the external provider and represented by a subject, and **Billing Party**, the
party legally and financially responsible for a subscription. `npm test`
passed 1/1. It correctly declined a new ADR because the edit recorded existing
terminology rather than a new hard-to-reverse decision.

### `research`

Session `01a0a19f-1a83-7950-8c6a-87d6db4e25de` used web search and a
background agent while the main agent read repository guidance. It researched
one bounded question: the official semantics and exit statuses of
`git merge-base --is-ancestor A B`. The 717-byte
[retained note](engineering-skill-research-result.md), SHA-256
`8fde955a4bec91a3a51a23d3cbe3c77b027f2b28077a102dfd8959404abcb52d`,
cites the Git manual for each finding. `git diff --check` passed, and the agent
left the domain-modeling change untouched. This single question does not
establish every possible research workflow.

### `resolving-merge-conflicts`

Sessions `01a0a19d-19d3-7260-ba87-9ca79ec51e23` and
`01a0a19f-e308-75e1-9a4e-7eedde735731` started from an actual in-progress
conflict between current commit
`d974aa0678c23426178575790619efa3e92b9c40` and incoming commit
`2959c138090c966e4364b83c3dddf5ee8bf86bf6`. The agent read both accepted
request documents and preserved both behaviors: trim and reject empty Order
references, and lowercase and allowlist Order statuses. `npm test` passed 5/5,
`git diff --check` passed, and merge commit
`c983c234242ac697f410edce503696364df692b5` retained both parents. The fixture
ended clean and outside a merge.

### `tdd`

Sessions `01a0a19d-199a-7373-a8c5-0db527abc4f6` and
`01a0a19f-e2f1-7721-8758-cc6a74a2ef9e` implemented the agreed public seam
`formatInvoiceReference(sequence)`. Four vertical slices each demonstrated a
focused exit-1 red test before the minimum implementation for formatting 7 as
`INV-0007`, then rejecting zero, negative, and fractional input. The final
focused test, full fixture suite, and `git diff --check` passed. Local commit
`55b159060f2a26ef5115b42503876711ca88c29a` has subject
`feat(invoice): format Invoice references`.

## Runtime limitations

The default workspace-write sandbox allowed all source and test work but
mounted `.git` metadata read-only. The diagnosing, conflict-resolution, and TDD
sessions therefore could not create their requested commits after behavioral
validation. A second high-reasoning session for each scenario used
`--dangerously-bypass-approvals-and-sandbox` only inside its disposable local
fixture, repeated validation, wrote the local commit, and confirmed a clean
worktree. No remote existed in those fixtures and nothing was published.

The runner lacked desktop `xdg-open`, and the workspace sandbox blocked
Chromium startup. Browser opening was completed through installed headless
Chromium in a local sandbox-bypass session, then checked through DOM geometry
and separate operator inspection. The retained HTML depends on the Tailwind
and Mermaid CDNs when rendered.
Routing, review, and design exercises made no code changes by design. The
domain and research fixtures retained each other's pre-existing changes, which
demonstrated scoped edits but meant that repository was intentionally not
clean at the end of each individual session.

## Reproduce the fixture harness

Run with Node.js 24 from the Repo Canon root:

```bash
node scripts/create-engineering-skill-fixtures.mjs
npm run test:engineering-skill-fixtures
```

The command prints a versioned JSON manifest containing the temporary root,
repository paths and fixed points, optional source remote, Repo Canon worktree
commit, builder digest, pinned upstream commit, and every complete-directory
skill digest. Supplying
`--root <unused-path>` creates the same repositories at a chosen location.
The fixture test verifies the shared guidance, scenario-specific project
guidance, domain and development context, ADR indexes, skill symlinks and
digests, and an actual unresolved Git merge.
