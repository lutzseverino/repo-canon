# Planning and adoption-preparation skill runtime exercises

Issue [#11](https://github.com/lutzseverino/repo-canon/issues/11) requires a
bounded runtime exercise of nine pinned skills. On 14 September 2026, each
skill ran against a disposable Git repository produced by
`scripts/create-planning-skill-fixtures.mjs`. The retained
[session finals](planning-skill-session-finals/) and
[runtime artifacts](planning-skill-artifacts/) record observed outcomes; the
fixture inventory test alone is not runtime evidence.

## Evidence boundary and harness

The authoritative fixture root was `/tmp/repo-canon-skill-exercises-11`, built
from Repo Canon commit `c64a92c0f128fac106a45772781af110b08736ca`.
The builder SHA-256 was
`82d1678b7b2ba8f74044f7e71dfda36472425a031e0f8420343c255b000708f1`.
Its five repositories used real Git histories and repository-scoped symlinks
to the pinned skill directories. They supplied local Markdown tracker state,
domain language, an ADR, source and tests, an exact AGENTS candidate, a native
specification and tickets, a Wayfinder map and children, a workflow, and a
fictional sandbox setup. Generated state remained outside Repo Canon.

The sessions used Codex CLI 0.154.0, `gpt-5.6-terra` with high reasoning,
Node.js 24.21.0, and Git 2.53.0. Codex ran without its normal filesystem sandbox
only inside these disposable repositories so it could create fixture commits
and branches. All prompts prohibited remote contact. No session published an
issue, branch, release, adoption, setting, variable, secret, or message.

The builder itself requires only Node.js 24 and Git. Codex is an exercise
harness prerequisite and is recorded here from the actual sessions; it is not
a generic CI or fixture-generation dependency.

The current manifest keeps the source `HEAD` and adds SHA-256 for the builder,
shared fixture-authoring module, each copied Repo Canon guidance file, and every
linked skill directory, including support skills outside the nine exercised
targets. This records the bytes actually consumed even when an input differs
from `HEAD`. Every fixture also sets repository-local
`commit.gpgsign=false`; the focused test makes an ordinary later commit with
hostile global signing and an unusable signer while leaving that global
configuration unchanged.

An initial fixture at Repo Canon commit `54847136799062de3faf31b3354b2bbace7618d7`
was rejected after PR review found two harness defects: fixture generation
called a particular installed Codex CLI, and the planning repository's
`grilling` symlink incorrectly targeted the engineering category instead of
the pinned productivity skill. Sessions run against that root were discarded
as acceptance evidence. Commit `248dc8d74daad1ac52e4ece04d4315ec6ea0a920`
removed the Codex dependency, selected the correct skill category, and made the
test resolve every installed fixture symlink. A final correction added all
shared files referenced by the exact AGENTS candidate. The authoritative root
was rebuilt after those corrections and every affected exercise was rerun.
The discarded session identities were `01a0a1d4-8ba2-73c2-b856-f21d1fd18afd`,
`01a0a1d4-8bc7-77b3-929d-fadf3fe61d45`,
`01a0a1d7-7c9f-7740-8a0d-46e66e88d248`,
`01a0a1d4-8c18-7390-a984-58d4a9989415`,
`01a0a1db-a390-7e91-9ad5-84421cd5b0fa`,
`01a0a1de-c029-7601-84ed-79adde79cd75`,
`01a0a1d7-7cca-7d01-a95a-80836f005e8b`,
`01a0a1d4-8c2e-7613-868b-9c2e1ff9372e`,
`01a0a1d7-7d04-7572-813c-5b409ce09fd8`, and
`01a0a1db-a3ca-73f1-bdf2-056cd207336a`. No `to-tickets` session ran before
the correction.

## Exercised source identity

The vendored source is mattpocock/skills commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Each manifest and table digest
uses `repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1`:
depth-first traversal, JavaScript `localeCompare` ordering within each
directory, then slash-normalized relative path, NUL, file bytes, and NUL.

| Skill | Complete-directory SHA-256 |
| --- | --- |
| `setup-matt-pocock-skills` | `80cd6b5be4f67913f1b10f5acd97fccaeb6401682ae7ff3a971460cb73d86cbe` |
| `grill-with-docs` | `6b1292031c4f38a11309b9dad9be1141c1921c6edf86d1ae6da8b048fa71a349` |
| `to-spec` | `f8041146ec1678c32304f46c9de99b73a4b5dadf664e35a8124be47c4cfe3196` |
| `to-tickets` | `597a1a0af4f7391ab459a02a3f33576109b6bc61ecdc5e7e05149336858b4f29` |
| `triage` | `461668611d1bd0eeb0533f347c11690a556c966a75938363a171914dcc42481a` |
| `wayfinder` | `93d2a866764b048ad641e82e27e7a1940fc370e7933470bffeb937fa1fb3922b` |
| `implement` | `b49a049477c7eec7f8dd90745dbc3f27bf75617b832d5b5f33c55aab7638a12e` |
| `prototype` | `492e4433fcd9cf88c0854aba063829ee248b208849e5827a45da8424199fd10f` |
| `wizard` | `518a4d148ef366cde28bd3b5f3eefc54ac7ddeeb670cd96eaff07cf4d2ce30f0` |

The fixture test verifies every installed dependency symlink, including the
productivity `grilling` dependency used by planning. A separate runtime
exercise verified the managed-update boundary below, and a Node-and-Git test
reproduces its candidate-only mutation, digest, difference, source-invariance,
and cleanup checks without requiring Codex. No exercise modified a vendored
file, and adopting contributors received no independent updater or write route.

The retained managed-update comparison uses a distinct serialization,
`repo-canon/directory-sha256/flat-c-byte-path-nul-bytes-nul/v1`: enumerate all
regular files, sort complete relative paths bytewise under `LC_ALL=C`, then
append the same path, NUL, bytes, NUL records. Its historical
`570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b`
and
`13af6e0225c89e4b44d4476b4ca87681219f9d5a49566c5f2d3df173f766ee6d`
values remain evidence in that format; they are not normalized to the
recursive manifest format.

## Observed outcomes

### `setup-matt-pocock-skills`

Session `01a0a1e1-5866-7380-9653-ed79623b1111` explored a repository with
existing Parcel instructions and no tracker setup. The prompt supplied the
owner's approved local Markdown, default-label, and single-context choices.
The skill preserved the original instructions verbatim, added one Agent skills
block, and wrote tracker, triage-label, and domain guidance. Fixture commit
`35cfde44b2beeecae67fa12c188dfc92f7d4131b` passed template comparison,
`git diff --check`, and `npm test`.

### Adoption preparation

Session `01a0a1e1-5837-78f2-8542-4dfd88c53e25` exercised the separate route
required before whole-file ownership can replace existing AGENTS content. It
first committed all useful Parcel terminology, opaque-identifier ADR,
API-specific check, and local-operation instructions to project guidance as
`c0cc7080d30ca45010cafbf09defdc99e6ad6fd1`. It then inspected that prepared
HEAD and every candidate reference afresh, retained the
[inspection](planning-skill-artifacts/adoption-inspection.md), and made the
exact replacement in a second commit,
`f44ed880d3dae67233b3734d7de0dadb01e7a9c9`. `cmp` proved root AGENTS matched
the candidate byte for byte; all six referenced documents existed. This was a
disposable local sequence, not Repository Standards adoption evidence.

Session `01a0a1fd-049a-7652-a47b-fa41eca32366` then treated a direct installed
skill edit as an adopting-contributor request. It declined that route under
the standards-release ADR, hashed the complete installed
`setup-matt-pocock-skills` directory, made one synthetic change only in a
disposable full-directory candidate, and observed `diff -ru` exit 1. The
source digest remained
`570d12b3caf6c468d77e0aba8602efc7a5346697a77cb5372f623cf67247784b`
before and after; Repo Canon's vendored diff stayed empty. The retained
[boundary record](planning-skill-artifacts/managed-skill-update-boundary.md)
and final fixture commit `77adf0440eaf96ae1a70aedfa14655ea7804877f` also
record the reviewed upstream pin, manifest, complete selected directories,
notice, reference reconciliation, byte comparison, and release-review steps
available only to a standards maintainer.
An independent review found that the first record described its mutation but
omitted the command that made it. The same session reran the comparison and
replaced that transcript with an explicit Node built-in filesystem mutation;
the final record preserves the correction history and observed diff. This
detected a controlled candidate deviation without performing or authorizing a
standards update.

### `grill-with-docs`

Session `01a0a1e3-c1cb-7402-8ab9-c57a16cb9c6a` used the discussion's settled
answers as stakeholder input, the correct `grilling` dependency, Parcel
glossary, and atomic-batch ADR. Its first turn exposed unresolved route, error,
uniqueness, and concurrency decisions rather than pretending the plan was
ready. A second turn supplied stakeholder answers and revised the durable plan
until no specification decision remained open. Commits
`08b0d58c2ca18aeef019a2ba6acf308af5617cd8` and
`372dedf74ccd15ba3ec5968b3b339656d05c8db0` retain that progression.

### `to-spec`

Session `01a0a1eb-5b49-7f50-9393-c4f4eada4bcc` converted the approved plan
into the retained [native specification](planning-skill-artifacts/intake-batch-spec.md)
with all seven upstream sections and `ready-for-agent` status. It added no
triage category or Agent Brief. Commit
`221f86aa76c41a41f2a3dad37e340fd070d9cabc` passed the fixture checks.

### `to-tickets`

Session `01a0a1ec-b9ff-7763-a559-55cd8d267bd9` produced two approved vertical
slices in the tracker's native per-ticket format. The retained
[public endpoint ticket](planning-skill-artifacts/intake-batch-ticket-01.md)
is the frontier. The retained
[atomic conflict ticket](planning-skill-artifacts/intake-batch-ticket-02.md)
is also sufficiently specified and marked `ready-for-agent`, but its open
blocker makes it ineligible for implementation. The skill did not turn the
out-of-scope operator summary into a ticket or change the parent spec. Fixture
commit `373c1e11b9982e04352d80baa43fae4fe2b56627` records the result.

### `triage`

Session `01a0a1e1-58d1-76e1-94a9-ec3fd1592200` checked redundancy and prior
rejection, preserved intake context, and added the required AI preamble plus a
complete Agent Brief before local readiness. A later reporter clarification
changed the brief by adding a fourth export column. Session
`01a0a1e8-9a8d-73a1-8126-1069920df4e8` revised the single brief and returned
the issue to `needs-triage`; it did not approve the change. Only after the next
prompt supplied explicit maintainer review did session
`01a0a1eb-5b5a-7223-90b3-d68ab0b197f0` restore readiness for that revision.
The retained [tracker record](planning-skill-artifacts/receipt-export-triage.md)
and commits `fa8e44f2bd94616d2c7efac6feedaba6d349c01a`,
`a36df150cf926f34bbd7f3ceb79f5cf130ab3630`, and
`0760a3c0e5d7c52a042bb59d416c1311f443d8c6` preserve the transitions.

Local Markdown cannot supply GitHub collaborator permission, issue-event IDs,
or source edit identities. The existing public workflow supplies that binding;
`npm run test:issue-contracts` passed all 87 fixtures during this exercise,
including authorized and unauthorized review, exact revision publication,
brief edits and replacement, stale and repeated events, removal and renewed
review. Those automation fixtures supplement this skill boundary and are not
misreported as a remote triage session.

### `wayfinder`

Session `01a0a1e3-c1ef-7d63-be72-c408d27a0279` loaded the retained
[map](planning-skill-artifacts/retry-map.md), determined eligibility from open
state, assignment, and blockers, and claimed **Choose the default Retry
window** as its first tracker write. Its predecessor was resolved; the next
child remained blocked. The session resolved only that ticket, closed it,
added a named map pointer, removed graduated fog, and left implementation out
of scope. The retained [ticket](planning-skill-artifacts/retry-window-ticket.md)
and commit `7f081ec55b712ab90d2e9d1b8ac995dab35b5f20` record the result.

### `implement`

Session `01a0a1e1-5889-7373-b8ab-8ebc3074db64` read the native ticket, full
discussion/configuration, and confirmed that readiness and a closed blocker
made it eligible. At the pre-agreed public `scheduleDelivery()` seam, the test
failed before the urgent-first stable, non-mutating implementation made it
pass. The focused and complete suites each passed 2/2, and fixture commit
`6e0d2a255e2443e40c02bf7efd5a7b0bcd69fab3` records the change.

The initial in-session review reported zero findings on each axis. Session
`01a0a1f1-4b77-7730-ba1f-e0ffbb4bdd9b` then used the pinned implementation
range and independent parallel Standards and Spec agents to confirm that
result. Its first turn correctly stopped on an erroneous full fixed-point SHA
rather than substituting the matching abbreviation. The corrected turn used
`7a08f2c902b31cad08503c5ad7c2aeca120385ed...6e0d2a255e2443e40c02bf7efd5a7b0bcd69fab3`;
both axes reported no findings.

### `prototype`

Session `01a0a1e3-c230-71f3-849b-e1863a81036f` built the retained
[self-contained logic prototype](planning-skill-artifacts/delivery-schedule-cancellation-prototype.html)
with pure state logic, full visible state, free play, and three guided awkward
cases. The primary source and retained
[verdict](planning-skill-artifacts/delivery-schedule-cancellation-verdict.md)
live on disposable branch `prototype/delivery-schedule-cancellation-state` at
`3f9ea86d00c1dd5b01df327dd2bc27417357b913`. Main received only the decision
pointer at `df40b545cc9b53792d5f5741ea2ab9099b38c32d`. The HTML was not promoted
to production code and no tests were added for throwaway behavior.

### `wizard`

Session `01a0a1e8-9a9c-7840-80d6-2326349a19d6` authored the retained
[two-stage Parcel sandbox wizard](planning-skill-artifacts/setup-parcel-sandbox.sh).
The template library above `STAGES` remained byte-identical. Static tracing
matched public `PARCEL_API_URL` to the workflow variable and secret
`PARCEL_API_TOKEN` to the workflow secret. `bash -n`, `npm test`, and
`git diff --check` passed; ShellCheck was unavailable. Commit
`ed02b83d08830306273c5ec159204a5dfbf97d4b` records the fixture result. The
wizard was intentionally not run end to end because doing so would open a
browser, request a human token, and write remote configuration. Its runtime
prerequisites are a human with the fictional sandbox access plus authenticated
GitHub CLI access when used outside this exercise.

## Limits

These bounded scenarios establish the exercised paths, not every behavior of
each skill. The local tracker cannot prove remote identity, permission, native
GitHub relationships, or event ordering. The wizard received static execution
evidence only because completing its human stages would require an authorized
external target. The prototype's decision is scenario evidence, not production
validation. No exercise validates a standards source, releases it, adopts it
into another repository, or changes production settings.
