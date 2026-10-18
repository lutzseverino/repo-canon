#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitFixture as commit,
  identifyFixtureSource,
  initializeFixtureRepository,
} from "./support/fixture-authoring.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptSourcePath = "scripts/create-planning-skill-fixtures.mjs";
const skillsRoot = join(sourceRoot, "vendor/mattpocock-skills/skills");
const upstreamCommit = "24fe0ef7737efae15c87225755e9f6f5965e4888";
const skillNames = [
  "grill-with-docs",
  "to-spec",
  "to-tickets",
  "triage",
  "wayfinder",
  "implement",
  "pr",
  "prototype",
];
const linkedSkillNames = [
  ...skillNames,
  "code-review",
  "domain-modeling",
  "grilling",
  "research",
  "tdd",
];
const sharedSourceFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/agents/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
  "rules/github-repository-configuration.md",
  "rules/factory-workflow.md",
  "scripts/support/repository-standards/SKILL.md",
  "scripts/support/repository-standards/rules.mjs",
  "vendor/mattpocock-skills/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md",
];

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const requestedRoot = argument("--root");
const fixtureRoot =
  requestedRoot ?? mkdtempSync(join(tmpdir(), "repo-canon-planning-skills-"));
if (requestedRoot && existsSync(fixtureRoot))
  throw new Error(`Fixture root already exists: ${fixtureRoot}`);
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function createRepository(
  name,
  skills,
  { agents, context, exercise, profile = "standard" },
) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  write(
    root,
    "AGENTS.md",
    `${agents}\nBefore any work, read and use [.agents/skills/repository-standards/SKILL.md](.agents/skills/repository-standards/SKILL.md) for local installed-rules lookup.\n`,
  );
  cpSync(join(sourceRoot, "CONTRIBUTING.md"), join(root, "CONTRIBUTING.md"));
  write(root, "GLOSSARY.md", context);
  write(
    root,
    "docs/development/README.md",
    "# Development\n\nUse Node.js 24 or 26. Run `npm test` and `git diff --check`. This repository is a disposable local exercise and must not contact a remote service.\n",
  );
  write(
    root,
    "package.json",
    `${JSON.stringify(
      {
        name: `repo-canon-${name}-exercise`,
        private: true,
        type: "module",
        scripts: { test: "node --test" },
      },
      null,
      2,
    )}\n`,
  );
  mkdirSync(join(root, ".agents/skills"), { recursive: true });
  for (const skill of skills)
    symlinkSync(skillPath(skill), join(root, ".agents/skills", skill), "dir");
  cpSync(
    join(sourceRoot, "scripts/support/repository-standards"),
    join(root, ".agents/skills/repository-standards"),
    { recursive: true },
  );
  const declarations = ["github-repository-configuration"];
  if (profile === "factory") declarations.push("factory-workflow");
  const rules = declarations.map((declaration) => {
    const input = `rules/${declaration}.md`;
    const path = `.repo-standards/${input}`;
    write(root, path, readFileSync(join(sourceRoot, input)));
    return { declaration, coverage: "repository", path, input };
  });
  write(
    root,
    ".repo-standards/rules/index.json",
    `${JSON.stringify({ profile, rules }, null, 2)}\n`,
  );
  write(
    root,
    ".repo-standards/rules/README.md",
    `# Installed exercise rules\n\nProfile: ${profile}. These canonical rules apply to the whole repository, including tracker work.\n\nRun \`node .agents/skills/repository-standards/rules.mjs [path]\` from the fixture root.\n\n${rules.map(({ declaration }) => `- [${declaration}](${declaration}.md) covers the whole repository.`).join("\n")}\n`,
  );
  installLocalTracker(root);
  write(
    root,
    "docs/exercise.md",
    `# ${name} exercise\n\nProfile: ${profile}. Read the local repository-standards skill and run its lookup before starting. Record the selected profile and rule paths with the outcome. Read each exercised skill's SKILL.md.\n\n${exercise}\n\n## Rules verification\n\nCheck produced planning artifacts against the copied GitHub rules' Agent Brief and Wayfinder sections where applicable, and readiness against CONTRIBUTING.md and the GitHub rules' Readiness roles section. For a triage brief, verify its disclaimer, heading order, all required non-placeholder fields, matching category, and notes after the brief. Use local controlled reviewer inputs to record revision invalidation and renewed review, without claiming real authorization or issue-event validation.\n\nRecord observed outcomes and the rule sections used. Fixture construction alone is not a skill exercise.\n`,
  );
  initializeFixtureRepository(root, {
    author: { name: "Repo Canon Exercise", email: "exercise@example.invalid" },
  });
  return root;
}

function skillPath(name) {
  // Repo Canon's own fork of triage is its installed source, not vendored.
  if (name === "triage") return join(sourceRoot, ".agents/skills/triage");
  const category = name === "grilling" ? "productivity" : "engineering";
  const path = join(skillsRoot, category, name);
  if (!existsSync(path))
    throw new Error(`Missing fixture skill dependency: ${category}/${name}`);
  return path;
}

function installLocalTracker(root) {
  cpSync(
    join(
      skillsRoot,
      "engineering/setup-matt-pocock-skills/issue-tracker-local.md",
    ),
    join(root, "docs/agents/issue-tracker.md"),
  );
  write(
    root,
    "docs/agents/triage-labels.md",
    readFileSync(join(sourceRoot, "docs/agents/triage-labels.md"), "utf8"),
  );
  write(
    root,
    "docs/agents/domain.md",
    readFileSync(join(sourceRoot, "docs/agents/domain.md"), "utf8"),
  );
  write(
    root,
    "docs/agents/README.md",
    "# Agent configuration\n\n- [Issue tracker](issue-tracker.md)\n- [Triage labels](triage-labels.md)\n- [Domain documentation](domain.md)\n- [Project guidance](project.md)\n",
  );
  write(
    root,
    "docs/agents/project.md",
    "# Exercise guidance\n\nThis repository is disposable. Use the local Markdown tracker for all issue and PR artifacts. Keep rule discovery local with the repository-standards exercise skill. Do not contact remote services, download packages, publish branches, send messages, or run a real factory or adoption. Preserve Repo Canon contract terminology and the distinction between readiness and implementation eligibility. Simulate reviews, labels, revision notices and event times as local Markdown records supplied by the participant; these are not real hosting-platform authority or automation.\n",
  );
}

const repositories = {};

{
  const root = createRepository("project-agent-guidance", [], {
    exercise:
      "## Task\n\nAssess candidate/AGENTS.md as project-agent-guidance contextual work. Preserve the Parcel API instructions in docs/agents/project.md and use the shared candidate as the root pointer.\n\n## Expected outcome\n\nProject instructions retain the Parcel terminology, identifier ADR and verify-api command. The standard-profile lookup exposes GitHub repository rules; no factory rules apply. All tracker and delivery artifacts stay local.\n",
    agents:
      "# Parcel API contributor instructions\n\nUse `Parcel` for accepted shipments. Read `docs/adr/0001-parcel-identifiers.md` before changing identifiers. Run `npm run verify-api` before committing API changes.\n",
    context:
      "# Parcel API\n\n## Language\n\n**Parcel**:\nA shipment accepted for delivery.\n_Avoid_: Package\n",
  });
  write(
    root,
    "docs/adr/README.md",
    "# Architecture decisions\n\nDecisions for the disposable Parcel API.\n",
  );
  write(
    root,
    "docs/adr/0001-parcel-identifiers.md",
    "# Keep Parcel identifiers opaque\n\nParcel identifiers are opaque strings supplied by the carrier.\n",
  );
  write(
    root,
    "candidate/AGENTS.md",
    readFileSync(join(sourceRoot, "AGENTS.md"), "utf8"),
  );
  write(
    root,
    "package.json",
    `${JSON.stringify(
      {
        name: "repo-canon-project-agent-guidance-exercise",
        private: true,
        type: "module",
        scripts: { test: "node --test", "verify-api": "node --test" },
      },
      null,
      2,
    )}\n`,
  );
  repositories["project-agent-guidance"] = {
    path: root,
    skills: [],
    initial: commit(root, "chore: establish project-agent-guidance exercise"),
  };
}

{
  const root = createRepository(
    "planning",
    ["grill-with-docs", "to-spec", "to-tickets", "domain-modeling", "grilling"],
    {
      exercise:
        "## Task\n\nUse grill-with-docs, to-spec and to-tickets on docs/planning/intake-batch-discussion.md, with the participant supplying unresolved decisions. Write a native specification and separate tickets in the local tracker.\n\n## Expected outcome\n\nThe specification preserves atomic Intake batches and the accepted scope. Tickets form independently releasable slices, with explicit blockers. Record readiness separately from blocker eligibility using controlled local review inputs. Standard-profile work requires no factory model selection or parent release gate.\n",
      agents:
        "# Agent guidance\n\nRead `CONTRIBUTING.md`, `docs/agents/issue-tracker.md`, and `docs/agents/domain.md` before planning. Native specifications and tickets are implementation contracts. Readiness does not bypass blockers.\n",
      context:
        "# Parcel intake\n\n## Language\n\n**Parcel**:\nA shipment accepted for delivery.\n_Avoid_: Package, item\n\n**Intake batch**:\nA set of Parcel declarations submitted together and accepted or rejected as one unit.\n_Avoid_: Upload\n",
    },
  );
  write(
    root,
    "docs/adr/README.md",
    "# Architecture decisions\n\nDecisions for Parcel intake.\n",
  );
  write(
    root,
    "docs/adr/0001-atomic-intake-batches.md",
    "# Intake batches are atomic\n\nAn Intake batch is accepted in full or rejected without creating any Parcels.\n",
  );
  write(
    root,
    "docs/planning/intake-batch-discussion.md",
    `# Intake batch discussion

Operators need to submit up to 100 Parcel declarations as one Intake batch. The accepted decisions are: JSON input only; validation reports every row error in one response; duplicate carrier references reject the full Intake batch; no partial acceptance; the existing single-Parcel endpoint remains; authentication and rate limits are unchanged. A prototype is unnecessary because the API shape is understood. The first releasable slice should accept and validate a batch through the public HTTP interface, and a later slice may add an operator-facing summary without blocking API use.
`,
  );
  write(
    root,
    "src/intake.mjs",
    "export function acceptParcel(parcel) { return { ...parcel, accepted: true }; }\n",
  );
  repositories.planning = {
    path: root,
    skills: ["grill-with-docs", "to-spec", "to-tickets"],
    initial: commit(root, "chore: establish planning exercise"),
  };
}

{
  const root = createRepository(
    "triage-wayfinder",
    [
      "triage",
      "wayfinder",
      "grilling",
      "domain-modeling",
      "research",
      "prototype",
    ],
    {
      exercise:
        "## Task\n\nTriage .scratch/triage/01-export-receipts.md, then use wayfinder to choose the next eligible child of .scratch/shipping-map/map.md. Use participant answers and local tracker records only.\n\n## Expected outcome\n\nThe CSV request gets an Agent Brief satisfying the discovered GitHub rules, with triage notes after the brief. Simulate an authorized review, then a contract revision: readiness drops until renewed review of that revision. The Wayfinder run selects child 02; child 03 remains blocked. Maps and children carry no readiness or workflow state. Standard-profile triage has no factory model suggestion requirement.\n",
      agents:
        "# Agent guidance\n\nRead the local tracker, triage labels, and domain documentation before tracker work. The latest Agent Brief is the candidate contract. A revision loses readiness until renewed authorized review. Wayfinder eligibility uses open state, assignment, and blockers.\n",
      context:
        "# Parcel operations\n\n## Language\n\n**Delivery receipt**:\nProof that a Parcel reached its destination.\n_Avoid_: Receipt record\n\n**Retry window**:\nThe period in which an operator may retry a failed Parcel dispatch.\n_Avoid_: Timeout\n",
    },
  );
  write(
    root,
    ".scratch/triage/01-export-receipts.md",
    `# Export Delivery receipts

Status: needs-triage
Category: enhancement

## Request

Operators need a CSV export of Delivery receipts for a selected UTC date. The export must include parcel reference, delivered timestamp, and signer name. Empty dates return a header-only CSV. PDF export and scheduled delivery are outside scope.

## Comments

Reporter clarification: timestamps must remain ISO 8601 UTC and rows sort by Parcel reference.
`,
  );
  write(
    root,
    ".scratch/shipping-map/map.md",
    `# Decide Parcel retry policy

## Destination

A reviewed decision record defining retry eligibility and the Retry window for failed Parcel dispatches.

## Notes

Use the Parcel operations glossary and local tracker. Planning only; do not implement dispatch behavior.

## Decisions so far

- [Define failure categories](issues/01-define-failure-categories.md): transient carrier failures may be retried; validation failures may not.

## Not yet specified

- Whether Retry windows differ by carrier after a default is chosen.

## Out of scope

- Building retry execution.
`,
  );
  write(
    root,
    ".scratch/shipping-map/issues/01-define-failure-categories.md",
    "# 01: Define failure categories\n\nType: grilling\nStatus: resolved\nBlocked by: None\n\n## Question\n\nWhich Parcel dispatch failures are retryable?\n\n## Answer\n\nTransient carrier failures are retryable; validation failures are not.\n",
  );
  write(
    root,
    ".scratch/shipping-map/issues/02-choose-default-retry-window.md",
    "# 02: Choose the default Retry window\n\nType: grilling\nStatus: open\nBlocked by: 01\n\n## Question\n\nShould the default Retry window be 15 minutes or 60 minutes? The operations evidence says carrier incidents normally clear within 20 minutes; operators prefer one hour to avoid manual replay.\n",
  );
  write(
    root,
    ".scratch/shipping-map/issues/03-choose-retry-window.md",
    "# 03: Choose carrier-specific Retry windows\n\nType: grilling\nStatus: open\nBlocked by: 02\n\n## Question\n\nDo any carriers need a Retry window that differs from the default?\n",
  );
  repositories["triage-wayfinder"] = {
    path: root,
    skills: ["triage", "wayfinder"],
    initial: commit(root, "chore: establish tracker exercises"),
  };
}

{
  const root = createRepository(
    "factory-planning",
    ["triage", "grilling", "domain-modeling", "research", "prototype"],
    {
      profile: "factory",
      agents:
        "# Agent guidance\n\nRead docs/agents/project.md and docs/exercise.md before planning. This is a local simulation of a repository a factory serves.\n",
      context:
        "# Parcel operations\n\n## Language\n\n**Delivery receipt**:\nProof that a Parcel reached its destination.\n_Avoid_: Receipt record\n",
      exercise:
        "## Task\n\nUse triage on .scratch/receipts/issues/01-export-receipts.md. Then assess the parent and ticket release records in .scratch/receipts/review-inputs.md. Record the readiness actions needed as local Markdown; perform no real factory or GitHub operation.\n\n## Expected outcome\n\nLookup exposes both GitHub repository configuration and factory workflow rules. The Agent Brief follows the GitHub shape and order; a model label suggestion and its reason follow in triage notes, outside the brief. Explain the difference between that suggestion and whoever accepts the brief, a person or the orchestrating agent, applying exactly one chosen model label before or with ticket readiness. The parent requires no model and never runs. Parent readiness in the same second as the latest ticket link does not release tickets; remove and reapply it later. A later ticket requires another parent readiness application. Tickets also require their own readiness and closed blockers. Cite the factory rules' Parent readiness and Model selection sections in the local outcome.\n",
    },
  );
  write(
    root,
    ".scratch/receipts/spec.md",
    "# Export Delivery receipts\n\nA dispatcher needs a CSV of Delivery receipts for a UTC date. The separate tickets are [Export](issues/01-export-receipts.md) and [Operator summary](issues/02-summary.md). This parent never runs.\n",
  );
  write(
    root,
    ".scratch/receipts/issues/01-export-receipts.md",
    "# Export Delivery receipts\n\nStatus: needs-triage\nCategory: enhancement\nParent: ../spec.md\nBlocked by: None\n\n## Request\n\nExport parcel reference, delivered timestamp and signer name as CSV for one UTC date. Sort by Parcel reference; timestamps remain ISO 8601 UTC. An empty date produces a header-only CSV. PDF and scheduled exports are outside scope.\n",
  );
  write(
    root,
    ".scratch/receipts/issues/02-summary.md",
    "# Summarize Delivery receipt exports\n\nStatus: needs-triage\nParent: ../spec.md\nBlocked by: 01\n\n## Request\n\nShow operators the count exported after the CSV is available.\n",
  );
  write(
    root,
    ".scratch/receipts/review-inputs.md",
    "# Controlled review inputs\n\nThese are simulated participant inputs, not GitHub events or actual authority.\n\n- The reviewer is a person with repository admin authority. The participant supplies the approved brief revision after triage.\n- Ticket 01 is linked at 2026-10-18T10:00:00Z. The parent receives ready-for-agent at 2026-10-18T10:00:00Z and still carries it.\n- Ticket 02 is published later and linked at 2026-10-18T11:00:00Z, after a renewed parent review at 10:01:00Z.\n- Both tickets are open and unassigned. Ticket 01 has no blockers. Ticket 02 remains blocked by the open ticket 01. Neither ticket has a model label yet.\n\nRecord the model and readiness sequence locally, including what a contract edit would invalidate. Do not launch a factory.\n",
  );
  repositories["factory-planning"] = {
    path: root,
    skills: ["triage"],
    initial: commit(root, "chore: establish factory planning exercise"),
  };
}

{
  const root = createRepository(
    "triage-routing",
    ["triage", "grilling", "domain-modeling"],
    {
      profile: "factory",
      agents:
        "# Agent guidance\n\nRead docs/agents/project.md and docs/exercise.md before tracker work. This is a local simulation of a repository a factory serves.\n",
      context:
        "# Parcel operations\n\n## Language\n\n**Delivery receipt**:\nProof that a Parcel reached its destination.\n_Avoid_: Receipt record\n\n**Retry window**:\nThe period after a failed Parcel dispatch in which dispatch is retried.\n_Avoid_: Timeout\n",
      exercise:
        "## Task\n\nYou are the orchestrating agent. Use triage on the three requests in .scratch/routing/issues/, with .scratch/routing/review-inputs.md as the controlled inputs. Sort all three. Take 01 and 02 through their paths to acceptance; for 03, record its path and reason only. Start a separate research run with a fresh context for each request you research; when the harness cannot nest sub-agents, the operator runs it and relays its messages verbatim. The operator also plays the owner and supplies revision notices; neither is a real person or GitHub event.\n\n## Expected outcome\n\n01 is code-bound: its expected result is documented. 02 is labeled bug but intent-bound, because its fix needs a Retry window nobody chose. 03 is an intent-bound feature request. Classification follows where the uncertainty lies, not the label.\n\nFor 01, the published revision r1 passes the GitHub rules' Agent Brief shape yet does not hold. The orchestrating agent checks it against the issue and code itself, names the defects it finds (an untestable criterion, scope the request never asked for, a wrong code path, and the missing dependency on 05), and sends them to the research run, which revises the brief. Only after the revision notice for the corrected revision does it accept that exact revision: it applies ready-for-agent with exactly one model label it chose itself, records 05 as a blocker, and tells the owner with links. r1's readiness would never have been valid, and the research run applies no label.\n\nFor 02, the research run gathers code facts first and writes no brief. The orchestrating agent then asks the owner short rounds of numbered questions, each with a recommended answer, and never re-asks the recorded decision on transient failures. It records the answers on the issue before the brief is written from them, and refuses any brief that leaves a choice to the implementing agent, lists options, or carries a value the owner did not choose, returning that question to the owner instead.\n\nAlso record, without acting on them, what the orchestrating agent does when its credentials hold only the write role, when they are a GitHub App installation, when no revision notice arrives, and when the brief is edited after readiness. Cite the contribution guide's Triage and Readiness sections, the GitHub rules' Readiness roles section, and the factory rules' Model selection section in the local outcome.\n",
    },
  );
  write(
    root,
    "docs/usage/receipts.md",
    "# Delivery receipt export\n\nExport the Delivery receipts of one UTC date as CSV with the header `parcel_reference,delivered_at,signer_name`. A date with no deliveries returns a CSV holding only that header row.\n",
  );
  write(
    root,
    "src/receipts.mjs",
    `const header = "parcel_reference,delivered_at,signer_name";

export function exportReceipts(receipts, date) {
  const rows = receipts.filter(({ deliveredAt }) => deliveredAt.startsWith(date));
  if (rows.length === 0) throw new Error(\`No Delivery receipts for \${date}\`);
  return [header, ...rows.map((row) => [row.reference, row.deliveredAt, row.signer].join(","))].join("\\n");
}
`,
  );
  write(
    root,
    "src/dispatch.mjs",
    `// Minutes after the first failure during which a transient carrier failure is retried.
const RETRY_WINDOW_MINUTES = 5;

export function shouldRetry(failure, minutesSinceFirstFailure) {
  if (failure.kind !== "transient") return false;
  return minutesSinceFirstFailure < RETRY_WINDOW_MINUTES;
}
`,
  );
  write(
    root,
    "docs/operations/carrier-incidents.md",
    "# Carrier incidents\n\nLast quarter, 90% of carrier incidents cleared within 20 minutes and the longest lasted three hours. Once dispatch stops retrying, operators replay failed Parcels by hand. Operators have said they would prefer one hour of retries.\n",
  );
  write(
    root,
    ".scratch/routing/issues/01-empty-date-export-fails.md",
    `# Exporting a date with no deliveries fails

Status: needs-triage
Category: bug
Blocked by: None

## Request

Exporting Delivery receipts for a UTC date with no deliveries fails with "No Delivery receipts for 2026-10-04". The receipt export documentation says such a date returns a header-only CSV.

## Comments

### Agent Brief comment, revision r1 (controlled input)

> *This was generated by AI during triage.*

## Agent Brief

**Category:** bug
**Summary:** Empty-date receipt exports should return a header-only CSV instead of failing

**Current behavior:**
Exporting a date with no Delivery receipts fails because the CSV writer cannot write zero rows.

**Desired behavior:**
An empty date returns a CSV holding only the header row. Add a \`skipEmpty\` option that returns no file at all for an empty date.

**Key interfaces:**
- \`exportReceipts(receipts, date)\`: returns CSV text for every date

**Acceptance criteria:**
- [ ] Empty exports work correctly
- [ ] \`skipEmpty\` suppresses the file for an empty date

**Out of scope:**
- PDF export

## Triage Notes

- Path: code-bound; the documentation states the expected result.
- Model: suggest \`model:claude-haiku-4-5-20251001\`, a one-function fix.
- Dependencies: none.

### Revision notice (controlled input)

The issue-contract workflow published revision r1 as a valid triaged Agent Brief awaiting review.
`,
  );
  write(
    root,
    ".scratch/routing/issues/02-dispatch-retry-gives-up.md",
    `# Dispatch stops retrying before carriers recover

Status: needs-triage
Category: bug
Blocked by: None

## Request

Dispatch stops retrying a Parcel five minutes after a transient carrier failure, but carrier incidents usually last longer, so operators replay Parcels by hand. Retries should continue long enough for carriers to recover.

## Comments

### Triage notes (earlier session)

> *This was generated by AI during triage.*

Owner decisions:

1. Only transient carrier failures are retried; validation failures never are. (Owner, 2026-10-10, in the earlier owner thread.)
`,
  );
  write(
    root,
    ".scratch/routing/issues/03-pdf-receipts.md",
    "# Offer Delivery receipts as PDF\n\nStatus: needs-triage\nCategory: enhancement\nBlocked by: None\n\n## Request\n\nOperators want to send customers a PDF of a Delivery receipt, with the signer's name, instead of the CSV.\n",
  );
  write(
    root,
    ".scratch/routing/issues/05-shared-csv-writer.md",
    "# 05: Move receipt export to the shared CSV writer\n\nStatus: ready-for-agent\nModel: model:claude-sonnet-5-5\nBlocked by: None\n\n## What to build\n\nReplace the receipt export's inline CSV building with the shared exports CSV writer. Every later change to receipt CSV output lands after this ticket, so it is made once, in the shared writer.\n",
  );
  write(
    root,
    ".scratch/routing/review-inputs.md",
    "# Controlled review inputs\n\nThese are simulated participant inputs, not GitHub events or actual authority.\n\n- The orchestrating agent works through a person's account, which the owner delegated to this session and which holds the repository `triage` role. The research run has no credentials of its own.\n- A revision notice exists only once the participant supplies it for that revision. Revision r1 of 01's brief already has one.\n- The owner answers only the questions put to them in this session. Recorded owner decisions on an issue stand.\n- Ticket 05 is open and ready; it is not yet a native blocker of any issue.\n\nRecord every readiness, model label, blocker and owner notification as local Markdown in the issue files. Do not launch a factory.\n",
  );
  repositories["triage-routing"] = {
    path: root,
    skills: ["triage"],
    initial: commit(root, "chore: establish triage routing exercise"),
  };
}

{
  const root = createRepository(
    "delivery",
    ["implement", "pr", "tdd", "code-review", "prototype"],
    {
      exercise:
        "## Task\n\nUse implement on .scratch/delivery/issues/01-prioritize-parcels.md at the agreed scheduleDelivery seam, code-review against the initial commit, and pr to draft a local body using docs/pr-evidence.md. Exercise prototype separately on docs/prototype-question.md on a throwaway branch.\n\n## Expected outcome\n\nDelivery tests pass with stable urgent-first ordering and unchanged input. The local PR draft records before/after evidence and merge danger. The prototype exposes the three states and cancellation cases. Rule lookup uses the standard profile; no branch, issue or PR is published.\n",
      agents:
        "# Agent guidance\n\nRead the native ticket, glossary, and development commands. Use tests at the public `scheduleDelivery()` seam. Prototype work stays on a throwaway branch.\n",
      context:
        "# Parcel delivery\n\n## Language\n\n**Delivery schedule**:\nThe ordered set of Parcels selected for dispatch.\n_Avoid_: Queue\n",
    },
  );
  write(
    root,
    ".scratch/delivery/issues/01-prioritize-parcels.md",
    `# 01: Prioritize urgent Parcels

**What to build:** The public scheduleDelivery(Parcels) interface returns urgent Parcels first while preserving submission order within each priority.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Empty input returns an empty Delivery schedule.
- [ ] Urgent Parcels precede standard Parcels.
- [ ] Submission order is stable within each priority.
- [ ] Input Parcels are not mutated.
`,
  );
  write(
    root,
    "src/delivery.mjs",
    `export function scheduleDelivery(parcels) {
  return parcels.sort((left, right) => left.priority.localeCompare(right.priority));
}
`,
  );
  write(
    root,
    "test/delivery.test.mjs",
    `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleDelivery } from '../src/delivery.mjs';

test('empty input creates an empty Delivery schedule', () => {
  assert.deepEqual(scheduleDelivery([]), []);
});

test('urgent Parcels precede standard Parcels without mutating input', () => {
  const parcels = [
    { reference: 'S-1', priority: 'standard' },
    { reference: 'U-1', priority: 'urgent' },
    { reference: 'U-2', priority: 'urgent' },
  ];
  assert.deepEqual(scheduleDelivery(parcels).map(({ reference }) => reference), ['U-1', 'U-2', 'S-1']);
  assert.deepEqual(parcels.map(({ reference }) => reference), ['S-1', 'U-1', 'U-2']);
});
`,
  );
  write(
    root,
    "docs/prototype-question.md",
    "# Prototype question\n\nCan dispatch coordinators understand a three-state Delivery schedule (`draft`, `confirmed`, `dispatched`) when cancellation is allowed only before dispatch? Build a self-contained logic prototype with visible state and guided awkward cases.\n",
  );
  write(
    root,
    ".scratch/delivery/spec.md",
    `# Stable Delivery schedules

## Problem Statement
Urgent Parcels must dispatch first without changing their submission order.

## Solution
Implement scheduleDelivery through the existing public interface.

## User Stories
A dispatcher can prioritize urgent Parcels while preserving the input.

## Implementation Decisions
The native child ticket is [Prioritize urgent Parcels](issues/01-prioritize-parcels.md). It has no blockers and is ready-for-agent. Implement the ticket on its own branch and resolve it through the local tracker. Publish nothing.

## Testing Decisions
Use the agreed scheduleDelivery seam and the existing failing tests.

## Out of Scope
Remote services and publication.

## Further Notes
This is a disposable local fixture.
`,
  );
  write(
    root,
    "docs/pr-evidence.md",
    `# Delivery pull request exercise

Draft a local PR body after implementing the ticket. Do not open a pull request. Before: the urgent-Parcels test fails because a standard Parcel is ordered ahead of urgent Parcels. After: npm test passes with input preserved and submission order stable. Use a minimal visual summary and describe the reversible ordering fix's merge danger.
`,
  );
  repositories.delivery = {
    path: root,
    skills: ["implement", "pr", "prototype"],
    initial: commit(root, "chore: establish delivery exercises"),
  };
}

const provenance = identifyFixtureSource({
  sourceRoot,
  builderPath: scriptSourcePath,
  files: sharedSourceFiles,
  directories: Object.fromEntries(
    linkedSkillNames.map((name) => [name, skillPath(name)]),
  ),
});

const manifest = {
  source: {
    repositoryHead: provenance.head,
    fixtureBuilderSha256: provenance.inputFiles[scriptSourcePath].sha256,
    upstreamCommit,
    node: process.version,
    git: execFileSync("git", ["--version"], { encoding: "utf8" }).trim(),
    directoryHashSerialization: provenance.directoryHashSerialization,
    inputFiles: provenance.inputFiles,
    linkedSkillDirectories: provenance.directories,
  },
  skills: skillNames.map((name) => ({
    name,
    sha256: provenance.directories[name].sha256,
  })),
  repositories: Object.fromEntries(
    Object.entries(repositories).map(([name, repository]) => {
      const { profile, rules } = JSON.parse(
        readFileSync(
          join(repository.path, ".repo-standards/rules/index.json"),
          "utf8",
        ),
      );
      return [
        name,
        { ...repository, profile, ruleInputs: rules.map(({ input }) => input) },
      ];
    }),
  ),
};
write(fixtureRoot, "manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Created planning-skill fixtures at ${fixtureRoot}`);
console.log(`Manifest: ${join(fixtureRoot, "manifest.json")}`);
