#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
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
const scriptSourcePath = "scripts/create-engineering-skill-fixtures.mjs";
const skillsRoot = join(
  sourceRoot,
  "vendor/mattpocock-skills/skills/engineering",
);
const skillNames = [
  "ask-matt",
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "improve-codebase-architecture",
  "research",
  "retro",
  "tdd",
  "writing-for-agents",
];
const sharedFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/agents/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
];

function skillPath(name) {
  return name === "writing-for-agents"
    ? join(sourceRoot, "vendor/mattpocock-skills/skills/productivity", name)
    : join(skillsRoot, name);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const requestedRoot = argument("--root");
const fixtureRoot =
  requestedRoot ??
  mkdtempSync(join(tmpdir(), "repo-canon-engineering-skills-"));
if (requestedRoot && existsSync(fixtureRoot)) {
  throw new Error(`Fixture root already exists: ${fixtureRoot}`);
}
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function gitOptional(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status === 0) return result.stdout.trim();
  if (result.status === 1) return null;
  throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
}

function createRepository(name, skills, { context, development }) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  for (const path of sharedFiles)
    cpSync(join(sourceRoot, path), join(root, path), { recursive: true });
  write(
    root,
    "docs/agents/project.md",
    `# Exercise repository guidance\n\nThis is a disposable local repository for one Repo Canon engineering-skill exercise. Use its local scenario documents as the implementation contract or primary sources. Do not contact an issue tracker, publish its branches, or mutate a remote repository.\n`,
  );
  write(root, "GLOSSARY.md", context);
  write(root, "docs/development/README.md", development);
  write(
    root,
    "package.json",
    `${JSON.stringify(
      {
        name: `repo-canon-${name}-fixture`,
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
  initializeFixtureRepository(root, {
    author: { name: "Repo Canon Exercise", email: "exercise@example.invalid" },
  });
  return root;
}

const repositories = {};

{
  const skills = ["ask-matt", "code-review"];
  const root = createRepository("routing-review", skills, {
    context: `# Ledger\n\nLanguage for balances recorded by the example ledger.\n\n## Language\n\n**Entry**:\n+A posted or pending amount recorded by the Ledger.\n_Avoid_: Row, item\n\n**Ledger summary**:\n+The posted and pending totals derived from Entries.\n_Avoid_: Report\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Review changes against \`docs/specification.md\`.\n`,
  });
  write(
    root,
    "docs/specification.md",
    `# Summarize Ledger Entries\n\nThe public \`summarizeLedger(entries)\` interface returns independent posted and pending totals. It rejects an Entry whose state is neither \`posted\` nor \`pending\`. Tests must cover both totals and the rejection behavior.\n`,
  );
  write(
    root,
    "src/ledger.mjs",
    `export function summarizeLedger(entries) {\n  return { posted: 0, pending: 0 };\n}\n`,
  );
  write(
    root,
    "test/ledger.test.mjs",
    `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { summarizeLedger } from '../src/ledger.mjs';\n\ntest('Ledger summary starts empty', () => {\n  assert.deepEqual(summarizeLedger([]), { posted: 0, pending: 0 });\n});\n`,
  );
  const fixedPoint = commit(root, "chore: establish Ledger fixture");
  write(
    root,
    "src/ledger.mjs",
    `export function summarizeLedger(entries) {\n  const x = entries.filter(entry => entry.state === 'posted');\n  return { posted: x.reduce((total, entry) => total + entry.amount, 0), pending: 0 };\n}\n`,
  );
  write(
    root,
    "test/ledger.test.mjs",
    `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { summarizeLedger } from '../src/ledger.mjs';\n\ntest('Ledger summary totals posted Entries', () => {\n  assert.deepEqual(summarizeLedger([{ state: 'posted', amount: 12 }]), { posted: 12, pending: 0 });\n});\n`,
  );
  const head = commit(root, "feat: summarize posted Ledger Entries");
  repositories["routing-review"] = { path: root, skills, fixedPoint, head };
}

{
  const skills = ["codebase-design", "improve-codebase-architecture"];
  const root = createRepository("architecture", skills, {
    context: `# Ordering\n\nLanguage for accepting Orders into fulfillment.\n\n## Language\n\n**Order**:\n+A customer request accepted for fulfillment.\n_Avoid_: Payload, request\n\n**Order intake**:\n+The validation and normalization that turns submitted data into an Order.\n_Avoid_: Pipeline\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Architecture work must read \`GLOSSARY.md\` and \`docs/adr\` first.\n`,
  });
  write(
    root,
    "docs/adr/0001-canonical-currency-at-order-intake.md",
    `# Canonical currency at Order intake\n\nOrder intake stores uppercase ISO currency codes so downstream fulfillment does not repeat normalization. This is an accepted decision because changing stored values later requires a migration.\n`,
  );
  write(
    root,
    "docs/adr/README.md",
    `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Order intake scenario.\n`,
  );
  write(
    root,
    "src/parse-order.mjs",
    `export function parseOrder(text) { return JSON.parse(text); }\n`,
  );
  write(
    root,
    "test/order-intake.test.mjs",
    `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { acceptOrder } from '../src/order-intake.mjs';\n\ntest('Order intake normalizes currency', () => {\n  assert.deepEqual(acceptOrder('{"reference":"A-1","currency":"eur"}'), { reference: 'A-1', currency: 'EUR' });\n});\n`,
  );
  commit(root, "chore: establish Order intake");
  write(
    root,
    "src/validate-order.mjs",
    `export function validateOrder(order) { if (!order.reference) throw new Error('reference required'); return order; }\n`,
  );
  commit(root, "feat: validate Order references");
  write(
    root,
    "src/normalize-order.mjs",
    `export function normalizeOrder(order) { return { ...order, currency: order.currency.toUpperCase() }; }\n`,
  );
  commit(root, "feat: normalize Order currency");
  write(
    root,
    "src/order-intake.mjs",
    `import { parseOrder } from './parse-order.mjs';\nimport { validateOrder } from './validate-order.mjs';\nimport { normalizeOrder } from './normalize-order.mjs';\n\nexport function acceptOrder(text) {\n  return normalizeOrder(validateOrder(parseOrder(text)));\n}\n`,
  );
  const head = commit(root, "feat: connect Order intake modules");
  repositories.architecture = { path: root, skills, head };
}

{
  const skills = ["diagnosing-bugs"];
  const root = createRepository("debugging", skills, {
    context: `# Billing\n\nLanguage for producing Invoices.\n\n## Language\n\n**Invoice**:\n+A request for payment containing ordered Invoice lines.\n_Avoid_: Bill\n\n**Invoice line**:\n+One charged description in an Invoice.\n_Avoid_: Row, item\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. A diagnosis must preserve the public \`renderInvoice(lines)\` interface.\n`,
  });
  write(
    root,
    "docs/adr/0001-preserve-invoice-line-order.md",
    `# Preserve Invoice line order\n\nInvoice lines retain their caller-provided order because issued Invoices are legal records. Sorting is presentation-only and must not mutate the Invoice.\n`,
  );
  write(
    root,
    "docs/adr/README.md",
    `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Invoice scenario.\n`,
  );
  write(
    root,
    "src/invoice.mjs",
    `export function renderInvoice(lines) {\n  return lines.sort((left, right) => left.description.localeCompare(right.description)).map(line => line.description).join('\\n');\n}\n`,
  );
  write(
    root,
    "test/invoice.test.mjs",
    `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { renderInvoice } from '../src/invoice.mjs';\n\ntest('rendering an Invoice preserves its Invoice line order', () => {\n  const lines = [{ description: 'Zebra' }, { description: 'Alpha' }];\n  renderInvoice(lines);\n  assert.deepEqual(lines, [{ description: 'Zebra' }, { description: 'Alpha' }]);\n});\n`,
  );
  const head = commit(root, "fix: reproduce reordered Invoice lines");
  repositories.debugging = { path: root, skills, head };
}

{
  const skills = ["domain-modeling", "research"];
  const root = createRepository("modeling-research", skills, {
    context: `# Subscriptions\n\nLanguage for subscriber access and payment responsibility.\n\n## Language\n\n**Account**:\n+A record used for both login access and subscription billing.\n_Avoid_: None\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Durable technical research belongs in this directory and must cite primary sources.\n`,
  });
  write(
    root,
    "docs/adr/0001-external-authentication.md",
    `# Keep authentication external\n\nAuthentication identities remain owned by the identity provider, while this project stores only their stable subject identifiers. Replacing the provider is expensive, so domain language must not imply that authentication identities own subscriptions.\n`,
  );
  write(
    root,
    "docs/adr/README.md",
    `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Subscription scenario.\n`,
  );
  write(
    root,
    "src/subscription.mjs",
    `export function describeSubscription(account) {\n  return { loginSubject: account.subject, billingName: account.legalName };\n}\n`,
  );
  write(
    root,
    "test/subscription.test.mjs",
    `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { describeSubscription } from '../src/subscription.mjs';\n\ntest('subscription exposes login and billing identities', () => {\n  assert.deepEqual(describeSubscription({ subject: 'idp-7', legalName: 'Example LLC' }), { loginSubject: 'idp-7', billingName: 'Example LLC' });\n});\n`,
  );
  const head = commit(root, "chore: establish Subscription language fixture");
  repositories["modeling-research"] = { path: root, skills, head };
}

{
  const skills = ["tdd"];
  const root = createRepository("tdd", skills, {
    context: `# Billing\n\nLanguage for identifying Invoices.\n\n## Language\n\n**Invoice reference**:\n+The stable, human-readable identifier printed on an Invoice.\n_Avoid_: Invoice ID, number\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Tests use public interfaces and known literal expectations.\n`,
  });
  write(
    root,
    "docs/specification.md",
    `# Format Invoice references\n\nThe agreed public seam is \`formatInvoiceReference(sequence)\` from \`src/invoice-reference.mjs\`. It formats positive integer sequences as \`INV-\` plus four zero-padded digits (for example, 7 becomes \`INV-0007\`) and rejects zero, negative, and fractional values. Implement one red-green vertical slice at a time.\n`,
  );
  write(
    root,
    "src/invoice-reference.mjs",
    `export function formatInvoiceReference() {\n  throw new Error('not implemented');\n}\n`,
  );
  const head = commit(root, "chore: establish Invoice reference seam");
  repositories.tdd = { path: root, skills, head };
}

{
  const skills = ["retro", "writing-for-agents"];
  const root = createRepository("retrospective", skills, {
    context: `# Ordering\n\n## Language\n\n**Order**:\nA customer request identified by a reference.\n_Avoid_: Payload\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. The local session transcript is \`docs/session.md\`.\n`,
  });
  write(
    root,
    "src/order.mjs",
    "export function orderReference(order) { return order.reference.trim(); }\n",
  );
  write(
    root,
    "docs/session.md",
    `# Order reference session

The agent changed orderReference to trim references, then committed without running npm test. A later run of npm test found that empty references were still accepted. The development guide already listed npm test, but there was no CI workflow or pre-commit check. Review this recorded session and suggest improvements to the repository environment. Do not apply them or publish anything.
`,
  );
  const head = commit(root, "chore: establish retrospective exercise");
  repositories.retrospective = { path: root, skills, head };
}

const provenance = identifyFixtureSource({
  sourceRoot,
  builderPath: scriptSourcePath,
  files: sharedFiles,
  directories: Object.fromEntries(
    skillNames.map((name) => [name, skillPath(name)]),
  ),
});
const skills = provenance.directories;

process.stdout.write(
  `${JSON.stringify(
    {
      format: "repo-canon/engineering-skill-fixtures/v1",
      root: fixtureRoot,
      source: {
        repository: gitOptional(sourceRoot, [
          "config",
          "--get",
          "remote.origin.url",
        ]),
        worktreeCommit: provenance.head,
        fixtureBuilderSha256: provenance.inputFiles[scriptSourcePath].sha256,
        pinnedUpstreamCommit: "24fe0ef7737efae15c87225755e9f6f5965e4888",
        directoryHashSerialization: provenance.directoryHashSerialization,
        inputFiles: provenance.inputFiles,
      },
      skills,
      repositories,
    },
    null,
    2,
  )}\n`,
);
