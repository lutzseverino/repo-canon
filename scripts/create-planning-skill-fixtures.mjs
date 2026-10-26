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
  "orchestrate",
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
  if (["triage", "orchestrate"].includes(name))
    return join(sourceRoot, ".agents/skills", name);
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
      exercise: `## Task

Act as the orchestrating agent using triage on .scratch/triage/01-export-receipts.md, then wayfinder on .scratch/shipping-map/map.md. Use participant answers and local tracker records only. The operator holds back owner-inputs.md and review-inputs.md until their checkpoints; do not read ahead. Use separate research and grill sessions; when the harness cannot nest them, the operator starts fresh sessions and relays their results verbatim. Never author a brief you accept. Allow at most 20 minutes; a timeout or unavailable session is an exercise limit, not a pass. Publish nothing and launch no factory.

### 1. Initial handoff

Read only the intake and repository guidance. A separate research session gathers facts without writing a brief. The export is intent-bound: public CSV headers, invocation interface and receipt source are undecided. Record all three questions and recommendations in the local decision inbox, routed through the orchestrating agent. Observe needs-info with no brief or readiness before answers arrive. No public CSV/API/source choice is inferred or disguised as an implementation choice.

### 2. Controlled answers and draft

Only after that handoff does the operator relay .scratch/triage/owner-inputs.md to a separate grill. The grill records the simulated decisions with their date and source and drafts the Agent Brief, filing nothing and applying no readiness. Post the draft and its decision citations locally, with triage notes after the brief. Return needs-info to needs-triage once the questions are settled.

### 3. First notice and independent review

Only after the draft exists, relay step 1 of .scratch/triage/review-inputs.md. Retain r1's exact contract text, supply its simulated revision notice, and independently review the actual draft against the intake, answers and GitHub rules. Record acceptance or rejection; the inputs preapprove nothing. Simulated readiness is allowed only if that exact revision has its notice and is independently accepted. If rejected, return corrections to the writer and repeat this checkpoint for the corrected text before advancing.

### 4. Edit and invalidation

Relay step 2 of review-inputs.md: apply the supplied Summary edit, retain r2's exact text alongside r1, and invalidate r1 readiness immediately. Observe no readiness for r2 while its notice and independent review are withheld.

### 5. Second notice and independent review

Only after observing invalidation, relay step 3 of review-inputs.md. Supply r2's own notice and independently review its retained text again. Renew readiness only if that exact revision is accepted; record the actual verdict and any correction loop.

### 6. Wayfinder

Choose the next eligible child of the shipping map without settling its Retry window. Record child eligibility from open state, assignment and blockers.

## Expected outcome

Standard-profile lookup exposes only the GitHub repository rules, without factory workflow rules; standard-profile triage has no factory model suggestion requirement. The initial handoff, dated controlled answers, independent review results, retained r1/r2 texts, notices and readiness invalidation are observable local simulations, never real hosting-platform authority. The accepted CSV brief preserves the intake's column meanings, ISO 8601 UTC timestamps, Parcel-reference ordering, header-only empty dates and export exclusions. Cite CONTRIBUTING.md's Triage and Readiness and the GitHub rules' Agent Brief, Readiness roles and Wayfinder sections with the outcomes.

The Wayfinder run selects child 02; child 03 remains blocked. Maps and children carry no readiness or workflow state.
`,
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
    ".scratch/triage/owner-inputs.md",
    `# Controlled owner answers: release only after the questions

These are simulated participant decisions for this disposable exercise, not real product decisions or approval. The operator relays them to the separate grill only after the intent-bound handoff. Cite .scratch/triage/owner-inputs.md and 2026-10-18 in the draft's owner-decision notes.

1. Use the CSV header exactly: parcel_reference,delivered_at,signer_name.
2. Expose exportReceipts(receipts, date), returning CSV text. There is no CLI or HTTP endpoint in this exercise contract.
3. The receipt source is a caller-supplied array of objects with reference, deliveredAt and signer string fields. Filter deliveredAt by the selected UTC date. Do not choose a database, file store or remote service.

Keep the intake's column meanings, ISO 8601 UTC timestamps, Parcel-reference ordering and header-only empty-date behavior. PDF export and scheduled delivery remain outside scope. These answers settle only the export request, not the Wayfinder Retry window.
`,
  );
  write(
    root,
    ".scratch/triage/review-inputs.md",
    `# Controlled review inputs: relay one step at a time

These are simulated participant inputs, not GitHub events or actual authority. The operator releases each step only at its docs/exercise.md checkpoint. They supply notices and review conditions, not acceptance decisions. Use a simulated person's account with repository triage authority; no real account or permission is asserted.

1. After the grill draft exists, call it r1 and retain its exact text in .scratch/triage/revisions/r1.md. Supply a local simulated issue-contract revision notice for r1 only after the draft exists, identifying that retained text. The accepting reviewer did not write r1 and independently checks it against the intake, controlled decisions and discovered GitHub rules. Record the actual accept/reject outcome; no preapproved verdict substitutes for this review. If r1 holds, record readiness bound to r1 only after its notice and review. Otherwise return corrections to the grill and retain the corrected text and its own notice/review before proceeding.
2. Replace only the Summary field's content with: Export Delivery receipts as date-filtered CSV text from caller-supplied receipts. Keep every other field and the decision citations unchanged; retain the edited text in .scratch/triage/revisions/r2.md, preserving both texts. r1 readiness is invalidated immediately by the edit. Observe that r2 has no readiness at this checkpoint. Withhold r2 readiness until the operator supplies r2's revision notice and the independent reviewer reviews that exact text again.
3. Only after invalidation is recorded, supply a new local simulated revision notice identifying the retained r2 text. The independent reviewer checks r2 and records its actual verdict. Renew readiness bound to r2 only if accepted; rejection returns to the writer for correction, its own notice and renewed independent review. Neither the earlier notice nor the earlier acceptance authorizes r2.

Keep all notices, review outcomes and readiness records local. No model label or factory release ledger is required by this standard-profile exercise. These inputs never approve a Wayfinder map or child.
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
      exercise: `## Task

You are the orchestrating agent. Use triage on .scratch/receipts/issues/01-export-receipts.md in stages. First read only the intake and gather repository facts in a separate research session. Record the missing decisions in a local decision inbox and route them through the orchestrating agent to a separate grilling session. Stop this stage with no brief or readiness. The operator then supplies .scratch/receipts/owner-inputs.md as controlled owner answers to that grill; the grill records the decisions and drafts the brief, filing nothing and applying no label. When nested sessions are unavailable, the operator starts fresh sessions and relays their results verbatim.

Review the completed draft independently; never author a brief you accept. Only then assess .scratch/receipts/review-inputs.md in order and record the simulated model/readiness actions locally. Keep the unresolved intake separate from the simulated approved contract. Publish nothing and launch no factory.

## Expected outcome

Lookup exposes both GitHub repository configuration and factory workflow rules. The export is intent-bound: public CSV header names, invocation interface and receipt source are undecided. No public CSV/API/source choice is inferred or disguised as an implementation choice. The first stage identifies all three questions and routes them through the orchestrating agent, with no brief or readiness until controlled owner answers settle them.

After the answers, the grill's Agent Brief follows the GitHub shape and order and cites the controlled decisions with their date and source. A model suggestion and reason follow in triage notes, outside the brief; the grill applies no label. The independent accepting reviewer chooses exactly one model label, weighing or replacing that suggestion, before or with ticket readiness. A revision notice and independent review bind readiness to the exact revision. An edit invalidates it until a new notice and review; a valid shape alone grants nothing.

The parent requires no model and never runs. Parent readiness in the same second as the latest ticket link does not release tickets; remove and reapply it later. A later ticket requires another parent readiness application. Tickets also require their own readiness and closed blockers. Use the explicitly simulated approved inputs for those release decisions, not the unresolved intake. Cite CONTRIBUTING.md's Triage and Readiness, the GitHub rules' Agent Brief and Readiness roles, and the factory rules' Parent readiness and Model selection sections in the outcome.
`,
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
    ".scratch/receipts/owner-inputs.md",
    `# Controlled owner answers: release only after the questions

These are simulated participant decisions for this exercise, not real product decisions. The operator supplies them to the separate grill only after the intent-bound handoff. Cite this file and 2026-10-18 in the draft's owner-decision notes.

1. Use the CSV header exactly: parcel_reference,delivered_at,signer_name.
2. Expose exportReceipts(receipts, date), returning CSV text. There is no CLI or HTTP endpoint in this exercise contract.
3. The receipt source is a caller-supplied array of objects with reference, deliveredAt and signer string fields. Filter deliveredAt by the selected UTC date. Do not choose a database, file store or remote service.

Keep the intake's ISO 8601 UTC timestamps, Parcel-reference ordering and header-only empty-date behavior. PDF and scheduled exports remain outside scope. These answers settle 01 only; they do not settle 02's summary interface.
`,
  );
  write(
    root,
    ".scratch/receipts/review-inputs.md",
    `# Controlled review inputs

These are simulated participant inputs, not GitHub events or actual authority. Apply them in order only after the owner-answer stage and the grill's completed draft. They do not declare the unresolved intake ready.

## Exact revision and independent acceptance

- Call the completed grill draft r1 and retain its exact text locally. The operator supplies a simulated issue-contract revision notice for r1 only after the draft exists.
- The accepting reviewer did not write r1, works through a simulated person's account with repository triage authority, and independently checks the contract and owner-decision citations. Record the actual accept/reject outcome; no preapproved verdict substitutes for this review.
- If r1 holds, record the reviewer's chosen model and readiness bound to r1. Retain the grill's model suggestion separately.
- The operator then edits only the summary wording to create r2; retain both texts. r1 readiness is invalidated. Withhold r2 readiness until the operator supplies r2's revision notice and the independent reviewer reviews that exact text again.

## Release ledger: simulated approved contracts

This later ledger is a simulated approved contract state for release reasoning, not evidence that the unresolved intake or summary request passed review. It supplies a reviewed specification and two independently reviewed child contracts, each with its own revision notice, chosen model and ticket readiness. For 01 it may be used only after the r2 review above succeeds. 02's hypothetical settled contract is not a brief for its actual unresolved intake.

- Ticket 01 is linked at 2026-10-18T10:00:00Z. The parent receives ready-for-agent at 2026-10-18T10:00:00Z and still carries it: the same-second case holds tickets.
- Parent readiness is removed and reapplied at 2026-10-18T10:01:00Z, after the latest link. Open, unassigned ticket 01 has no blockers and can be released once its own exact-revision readiness and model are present. The parent itself never runs.
- Ticket 02 is linked later at 2026-10-18T11:00:00Z. The earlier parent readiness no longer releases tickets: remove and reapply it after this link, at 2026-10-18T11:01:00Z.
- Both tickets are still open and unassigned; 02 remains blocked by open 01 despite its own readiness and the parent's renewed readiness.
- The operator finally records 01 closed in this simulated ledger. 02's blocker is now closed; it can be released only with the renewed parent readiness, its own reviewed revision and exactly one chosen model.

Record all actions as local Markdown. Do not change actual intake status to approved based on this hypothetical ledger, claim GitHub authorization, or launch a factory.
`,
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
        "## Task\n\nYou are the orchestrating agent. Use triage on the three requests in .scratch/routing/issues/, with .scratch/routing/review-inputs.md as the controlled inputs. Sort all three. Take 01 and 02 through their paths to acceptance; for 03, record its path and reason only. Start a separate research run with a fresh context for each request you research; when the harness cannot nest sub-agents, the operator runs it and relays its messages verbatim. The operator also plays the owner and supplies revision notices; neither is a real person or GitHub event.\n\n## Expected outcome\n\n01 is code-bound: its expected result is documented. 02 is labeled bug but intent-bound, because its fix needs a Retry window nobody chose. 03 is an intent-bound feature request. Classification follows where the uncertainty lies, not the label.\n\nFor 01, the published revision r1 passes the GitHub rules' Agent Brief shape yet does not hold. The orchestrating agent checks it against the issue and code itself, names the defects it finds (an untestable criterion, scope the request never asked for, a wrong code path, and the missing dependency on 05), and sends them to the research run, which revises the brief. Only after the revision notice for the corrected revision does it accept that exact revision: it applies ready-for-agent with exactly one model label it chose itself, records 05 as a blocker, and tells the owner with links. r1's readiness would never have been valid, and the research run applies no label.\n\nFor 02, the research run gathers code facts first and writes no brief. The Retry window persists in the product, so the orchestrating agent never infers it, not even from the operators' stated preference. It sends the question to a separate grilling session with the owner, which asks short rounds of numbered questions, each with a recommended answer, never re-asks the recorded decision on transient failures, records the owner's answers, and drafts the brief. The orchestrating agent writes no brief itself: it records the owner decisions the brief relies on in the issue's triage notes, reviews the draft as a reviewer who did not write it, and refuses any brief that leaves a choice to the implementing agent, lists options, or carries a value the owner did not choose, returning that question to the owner instead.\n\nAlso record, without acting on them, what the orchestrating agent does when its credentials hold only the write role, when they are a GitHub App installation, when no revision notice arrives, and when the brief is edited after readiness. Cite the contribution guide's Triage and Readiness sections, the GitHub rules' Readiness roles section, and the factory rules' Model selection section in the local outcome.\n",
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

{
  const root = createRepository("orchestrate", ["orchestrate"], {
    agents:
      "# Agent guidance\n\nRead docs/exercise.md. This exercise uses a disposable sibling workbench; the operator supplies its path as a simulated owner instruction. Use only the local Markdown tracker.\n",
    context:
      "# Parcel operations\n\n## Language\n\n**Delivery receipt**:\nProof that a Parcel reached its destination.\n_Avoid_: Receipt record\n",
    exercise: `## Task

Use the exact .agents/skills/orchestrate/SKILL.md with the sibling workbench identified in manifest.json. The operator supplies its absolute path as the simulated global owner instruction before proposal. All owner, tracker and harness inputs are simulations; no remote issue, PR, message, schedule or factory operation is performed. The workbench has no remote. Participant-authored local tickets are direct implementation contracts, not triaged briefs; this scenario exercises plan lifecycle, not brief acceptance or worker delivery.

## Session sequence

The operator releases docs/participant-inputs.md one turn at a time. Use real harness session references and UTC clock timestamps. Session one starts with the goal only: present a proposal and stop before approval, recording the proposed goal and table for comparison. After explicit approval, record its date, source and preapproved scope in plan.md and index.md. Record the simulated open-issue count. Then route the in-goal row, scope amendment and nonfinding wish. Wait for the separate amendment approval before changing scope. Commit each workbench change straight to main.

End session one with an active plan and unfinished rows. A fresh session starts without the first transcript: read index.md, inbox.md and active plans first, then the exact skill and local guidance. Record takeover with the fresh session's reference, preserving the superseded owner. Try closing while a row remains open; keep the plan active. Only after the final participant turn may the plan close.

## Expected outcome

The proposal is visibly distinct from approval. The in-goal row has a dated citation to the approved goal, passes the inference test and appears in the next update's inferred-intent list; it adds no public name or persistent product policy. The amendment remains pending until explicitly approved, and its new approval supersedes rather than erases the old line. The wish is a future capability, not a Finding: it gains one dated quoted line with its source and repository in wishes.md and no issue. Every update shows the decision inbox.

Turns 6a–6c exercise the contribution guide's Findings section in a separate responsible repository, simulated by the tooling tracker at .scratch/tooling/issues/. Reuse its existing open issue for the UTF-8 crash, then file the new stale-option finding there with needs-triage and the local bug form's fields. Cite the observed command outcomes the participant supplies, separately from anything only read in code. There is no pull request: link both findings from a comment on review ticket 01 with the guide's AI disclaimer. The linked wish retains its date, source and tooling repository; it replaces neither the finding issue nor reporting links. Continue the documentation plan without adding tooling repair rows or waiting for repairs. The project's starting and closing counts remain zero and one; separately report the still-open tooling finding filed by the plan and its reason at close. Also record the reporting fallback if filing fails: list the unfiled finding and target repository in the same reporting location, without blocking the plan. This is a simulated outcome, not a request to fail a real write.

The fresh session resumes from committed workbench state, preserves row history and cannot close while any row lacks a closed simulated issue or dropped (owner). At close, record both open-issue counts, move the index entry under Closed, and announce shipped/dropped items, inferred intent, wishes, any still-open filed issues with reasons, and one suggested next direction. The suggestion alone approves no new plan. Report actual observed outcomes separately from fixture checks; keep run evidence outside maintained documentation.
`,
  });
  write(
    root,
    "docs/usage/receipts.md",
    "# Delivery receipt export\n\nThe existing export returns CSV for one UTC date, ordered by Parcel reference, with ISO 8601 UTC timestamps. An empty date returns a header-only CSV. This exercise reviews documentation only; no product behavior changes.\n",
  );
  write(
    root,
    ".scratch/tooling/issues/01-utf8-crash.md",
    "# Guide checker crashes on UTF-8 paths\n\nStatus: open\nLabels: needs-triage\nRepository: tooling (simulated)\n\n## Steps to reproduce\n\nObserved: running guide-check docs/usage/café.md on a valid guide exits 1 with an encoding error.\n\n## Expected behavior\n\nCheck valid UTF-8 paths successfully.\n\n## Actual behavior\n\nThe checker throws before inspecting the guide.\n\n## Environment\n\nSimulated tooling CLI 1.0, Node.js 24.\n",
  );
  write(
    root,
    ".scratch/tooling/bug-form.md",
    "# Local tooling bug form\n\nOne Markdown issue per finding in issues/, with Status, Labels and Repository, then Steps to reproduce, Expected behavior, Actual behavior and Environment. Use needs-triage. This directory represents a separate responsible repository's tracker; it is not the documentation plan's project tracker.\n",
  );
  write(
    root,
    "docs/participant-inputs.md",
    `# Controlled participant turns

The operator relays these in order, pausing at the indicated boundaries. All are simulated owner/tracker inputs. Cite each turn by this file and turn number with the clock date at delivery; do not pretend these are real approvals. The operator retains prompts, session references and turn delivery times outside the repositories.

## Session one

1. Goal: "Review the existing Delivery receipt export guide for accuracy; finish when each review item is resolved in the local tracker. Documentation review only." Propose one initial row, "Review the current guide", without filing it or recording approval. Stop for the participant.
2. Approval: "I approve that goal, Done means and initial row. This preapproves the named documentation review only." Record approval. Simulated tracker starts with zero open issues. File the direct local review ticket as 01 under .scratch/receipt-review/issues/; it is open.
3. In-goal row: "Also check the guide's existing empty-date example against its header-only behavior." Log the inference from turn 2's approved review goal: this is a temporary inspection within the goal, with no new public name or enduring policy. Add row/ticket 02 and list it in the next update.
4. Scope amendment: "Extend this plan to audit the Parcel glossary as well." Propose the scope amendment through the decision inbox; keep it pending and stop for approval.
5. Amendment approval: "I approve adding the glossary audit to the plan's scope." Record the superseding approval and add row/ticket 03. Preserve the earlier approval text.
6. Wish: "In a future plan I would like multilingual Delivery receipt guides." This is a desired future capability, not a Finding. Record it as a wish with its quote, source, date and this project repository; file no issue.
6a. Existing Finding: during the review, the external tooling's guide-check docs/usage/café.md on a valid guide was observed to exit 1 with an encoding error. This is outside this documentation change's responsibility. The same crash already has an open issue at .scratch/tooling/issues/01-utf8-crash.md; reuse it, with no duplicate. Follow the Findings rule's reporting links as well; a wish-only record cannot satisfy it.
6b. New Finding: the external tooling's usage guide instructs users to run guide-check --legacy, but that command was observed to exit 2 with "unknown option --legacy" in simulated tooling CLI 1.0 on Node.js 24. There is no existing open issue for this stale instruction. File .scratch/tooling/issues/02-stale-option.md using .scratch/tooling/bug-form.md with needs-triage, cite this turn's observed evidence, and report it under Findings. No tooling repair is part of this plan.
6c. Linked wish: "In a future plan I would like clearer tooling migration guidance." Record a dated wish with this source and the tooling repository; it may link the reported .scratch/tooling/issues/02-stale-option.md for future planning, while retaining the finding's tracker record and all reporting links. Neither finding waits for a repair before the documentation plan continues.
7. Tracker update: 01 is closed in the simulated local tracker. Tickets 02 and 03 remain open. End the session with a committed active plan; do not close it.

## Fresh session two

8. Resume using only the workbench entry points and active plan, with no prior transcript. Use the fresh harness session reference for takeover. The operator supplies no terminal tracker update yet: 02 and 03 remain open. A request to close now must leave the plan active.
9. Owner drop: "Drop the glossary audit from this plan." Keep row 03 with state dropped (owner) and the cited decision. Its already-filed simulated issue 03 stays open, intentionally parked; report that reason and count it at close. Ticket 02 still holds closure.
10. Final tracker update: 02 is now closed. The final project open-issue count is one (parked 03). The separate tooling tracker still has its two open findings; the plan filed only 02-stale-option.md, which remains open because tooling repair is outside this plan. Close the plan, report what shipped/dropped, the in-goal inference, the wishes, the open parked issue and the new still-open tooling finding with its reason. Suggest multilingual guides or the parked glossary audit as one next direction, awaiting a separate approval.
`,
  );
  const workbench = join(fixtureRoot, "orchestrate-workbench");
  mkdirSync(workbench);
  write(
    workbench,
    "index.md",
    "# Workbench\n\n## Active\n\nNone.\n\n## Closed\n\n## Launch caps\n\nNo host override; use the skill's default cap.\n",
  );
  write(workbench, "inbox.md", "# Decision inbox\n\nNo open decisions.\n");
  write(workbench, "wishes.md", "# Wishes\n");
  initializeFixtureRepository(workbench, {
    author: { name: "Repo Canon Exercise", email: "exercise@example.invalid" },
  });
  repositories.orchestrate = {
    path: root,
    skills: ["orchestrate"],
    initial: commit(root, "chore: establish orchestration exercise"),
    workbench: {
      path: workbench,
      initial: commit(workbench, "chore: initialize exercise workbench"),
    },
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
