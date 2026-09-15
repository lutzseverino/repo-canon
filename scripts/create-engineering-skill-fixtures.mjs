#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  commitFixture as commit,
  identifyFixtureSource,
  initializeFixtureRepository,
} from './support/fixture-authoring.mjs';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const scriptSourcePath = 'scripts/create-engineering-skill-fixtures.mjs';
const skillsRoot = join(sourceRoot, 'vendor/mattpocock-skills/skills/engineering');
const skillNames = [
  'ask-matt',
  'code-review',
  'codebase-design',
  'diagnosing-bugs',
  'domain-modeling',
  'improve-codebase-architecture',
  'research',
  'resolving-merge-conflicts',
  'tdd',
];
const sharedFiles = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/agents/README.md',
  'docs/agents/domain.md',
  'docs/agents/issue-tracker.md',
  'docs/agents/triage-labels.md',
];

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const requestedRoot = argument('--root');
const fixtureRoot = requestedRoot ?? mkdtempSync(join(tmpdir(), 'repo-canon-engineering-skills-'));
if (requestedRoot && existsSync(fixtureRoot)) {
  throw new Error(`Fixture root already exists: ${fixtureRoot}`);
}
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
}

function gitOptional(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  if (result.status === 1) return null;
  throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
}

function createRepository(name, skills, { context, development }) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  for (const path of sharedFiles) cpSync(join(sourceRoot, path), join(root, path), { recursive: true });
  write(root, 'docs/agents/project.md', `# Exercise repository guidance\n\nThis is a disposable local repository for one Repo Canon engineering-skill exercise. Use its local scenario documents as the implementation contract or primary sources. Do not contact an issue tracker, publish its branches, or mutate a remote repository.\n`);
  write(root, 'CONTEXT.md', context);
  write(root, 'docs/development/README.md', development);
  write(root, 'package.json', `${JSON.stringify({
    name: `repo-canon-${name}-fixture`,
    private: true,
    type: 'module',
    scripts: { test: 'node --test' },
  }, null, 2)}\n`);
  mkdirSync(join(root, '.agents/skills'), { recursive: true });
  for (const skill of skills) symlinkSync(join(skillsRoot, skill), join(root, '.agents/skills', skill), 'dir');
  initializeFixtureRepository(root, {
    author: { name: 'Repo Canon Exercise', email: 'exercise@example.invalid' },
  });
  return root;
}

const repositories = {};

{
  const skills = ['ask-matt', 'code-review'];
  const root = createRepository('routing-review', skills, {
    context: `# Ledger\n\nLanguage for balances recorded by the example ledger.\n\n## Language\n\n**Entry**:\n+A posted or pending amount recorded by the Ledger.\n_Avoid_: Row, item\n\n**Ledger summary**:\n+The posted and pending totals derived from Entries.\n_Avoid_: Report\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Review changes against \`docs/specification.md\`.\n`,
  });
  write(root, 'docs/specification.md', `# Summarize Ledger Entries\n\nThe public \`summarizeLedger(entries)\` interface returns independent posted and pending totals. It rejects an Entry whose state is neither \`posted\` nor \`pending\`. Tests must cover both totals and the rejection behavior.\n`);
  write(root, 'src/ledger.mjs', `export function summarizeLedger(entries) {\n  return { posted: 0, pending: 0 };\n}\n`);
  write(root, 'test/ledger.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { summarizeLedger } from '../src/ledger.mjs';\n\ntest('Ledger summary starts empty', () => {\n  assert.deepEqual(summarizeLedger([]), { posted: 0, pending: 0 });\n});\n`);
  const fixedPoint = commit(root, 'chore: establish Ledger fixture');
  write(root, 'src/ledger.mjs', `export function summarizeLedger(entries) {\n  const x = entries.filter(entry => entry.state === 'posted');\n  return { posted: x.reduce((total, entry) => total + entry.amount, 0), pending: 0 };\n}\n`);
  write(root, 'test/ledger.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { summarizeLedger } from '../src/ledger.mjs';\n\ntest('Ledger summary totals posted Entries', () => {\n  assert.deepEqual(summarizeLedger([{ state: 'posted', amount: 12 }]), { posted: 12, pending: 0 });\n});\n`);
  const head = commit(root, 'feat: summarize posted Ledger Entries');
  repositories['routing-review'] = { path: root, skills, fixedPoint, head };
}

{
  const skills = ['codebase-design', 'improve-codebase-architecture'];
  const root = createRepository('architecture', skills, {
    context: `# Ordering\n\nLanguage for accepting Orders into fulfillment.\n\n## Language\n\n**Order**:\n+A customer request accepted for fulfillment.\n_Avoid_: Payload, request\n\n**Order intake**:\n+The validation and normalization that turns submitted data into an Order.\n_Avoid_: Pipeline\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Architecture work must read \`CONTEXT.md\` and \`docs/adr\` first.\n`,
  });
  write(root, 'docs/adr/0001-canonical-currency-at-order-intake.md', `# Canonical currency at Order intake\n\nOrder intake stores uppercase ISO currency codes so downstream fulfillment does not repeat normalization. This is an accepted decision because changing stored values later requires a migration.\n`);
  write(root, 'docs/adr/README.md', `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Order intake scenario.\n`);
  write(root, 'src/parse-order.mjs', `export function parseOrder(text) { return JSON.parse(text); }\n`);
  write(root, 'test/order-intake.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { acceptOrder } from '../src/order-intake.mjs';\n\ntest('Order intake normalizes currency', () => {\n  assert.deepEqual(acceptOrder('{"reference":"A-1","currency":"eur"}'), { reference: 'A-1', currency: 'EUR' });\n});\n`);
  commit(root, 'chore: establish Order intake');
  write(root, 'src/validate-order.mjs', `export function validateOrder(order) { if (!order.reference) throw new Error('reference required'); return order; }\n`);
  commit(root, 'feat: validate Order references');
  write(root, 'src/normalize-order.mjs', `export function normalizeOrder(order) { return { ...order, currency: order.currency.toUpperCase() }; }\n`);
  commit(root, 'feat: normalize Order currency');
  write(root, 'src/order-intake.mjs', `import { parseOrder } from './parse-order.mjs';\nimport { validateOrder } from './validate-order.mjs';\nimport { normalizeOrder } from './normalize-order.mjs';\n\nexport function acceptOrder(text) {\n  return normalizeOrder(validateOrder(parseOrder(text)));\n}\n`);
  const head = commit(root, 'feat: connect Order intake modules');
  repositories.architecture = { path: root, skills, head };
}

{
  const skills = ['diagnosing-bugs'];
  const root = createRepository('debugging', skills, {
    context: `# Billing\n\nLanguage for producing Invoices.\n\n## Language\n\n**Invoice**:\n+A request for payment containing ordered Invoice lines.\n_Avoid_: Bill\n\n**Invoice line**:\n+One charged description in an Invoice.\n_Avoid_: Row, item\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. A diagnosis must preserve the public \`renderInvoice(lines)\` interface.\n`,
  });
  write(root, 'docs/adr/0001-preserve-invoice-line-order.md', `# Preserve Invoice line order\n\nInvoice lines retain their caller-provided order because issued Invoices are legal records. Sorting is presentation-only and must not mutate the Invoice.\n`);
  write(root, 'docs/adr/README.md', `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Invoice scenario.\n`);
  write(root, 'src/invoice.mjs', `export function renderInvoice(lines) {\n  return lines.sort((left, right) => left.description.localeCompare(right.description)).map(line => line.description).join('\\n');\n}\n`);
  write(root, 'test/invoice.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { renderInvoice } from '../src/invoice.mjs';\n\ntest('rendering an Invoice preserves its Invoice line order', () => {\n  const lines = [{ description: 'Zebra' }, { description: 'Alpha' }];\n  renderInvoice(lines);\n  assert.deepEqual(lines, [{ description: 'Zebra' }, { description: 'Alpha' }]);\n});\n`);
  const head = commit(root, 'fix: reproduce reordered Invoice lines');
  repositories.debugging = { path: root, skills, head };
}

{
  const skills = ['domain-modeling', 'research'];
  const root = createRepository('modeling-research', skills, {
    context: `# Subscriptions\n\nLanguage for subscriber access and payment responsibility.\n\n## Language\n\n**Account**:\n+A record used for both login access and subscription billing.\n_Avoid_: None\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Durable technical research belongs in this directory and must cite primary sources.\n`,
  });
  write(root, 'docs/adr/0001-external-authentication.md', `# Keep authentication external\n\nAuthentication identities remain owned by the identity provider, while this project stores only their stable subject identifiers. Replacing the provider is expensive, so domain language must not imply that authentication identities own subscriptions.\n`);
  write(root, 'docs/adr/README.md', `# Architecture decisions\n\nThis directory records accepted decisions for the disposable Subscription scenario.\n`);
  write(root, 'src/subscription.mjs', `export function describeSubscription(account) {\n  return { loginSubject: account.subject, billingName: account.legalName };\n}\n`);
  write(root, 'test/subscription.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { describeSubscription } from '../src/subscription.mjs';\n\ntest('subscription exposes login and billing identities', () => {\n  assert.deepEqual(describeSubscription({ subject: 'idp-7', legalName: 'Example LLC' }), { loginSubject: 'idp-7', billingName: 'Example LLC' });\n});\n`);
  const head = commit(root, 'chore: establish Subscription language fixture');
  repositories['modeling-research'] = { path: root, skills, head };
}

{
  const skills = ['tdd'];
  const root = createRepository('tdd', skills, {
    context: `# Billing\n\nLanguage for identifying Invoices.\n\n## Language\n\n**Invoice reference**:\n+The stable, human-readable identifier printed on an Invoice.\n_Avoid_: Invoice ID, number\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24. Tests use public interfaces and known literal expectations.\n`,
  });
  write(root, 'docs/specification.md', `# Format Invoice references\n\nThe agreed public seam is \`formatInvoiceReference(sequence)\` from \`src/invoice-reference.mjs\`. It formats positive integer sequences as \`INV-\` plus four zero-padded digits (for example, 7 becomes \`INV-0007\`) and rejects zero, negative, and fractional values. Implement one red-green vertical slice at a time.\n`);
  write(root, 'src/invoice-reference.mjs', `export function formatInvoiceReference() {\n  throw new Error('not implemented');\n}\n`);
  const head = commit(root, 'chore: establish Invoice reference seam');
  repositories.tdd = { path: root, skills, head };
}

{
  const skills = ['resolving-merge-conflicts'];
  const root = createRepository('merge-conflict', skills, {
    context: `# Ordering\n\nLanguage for accepting Orders.\n\n## Language\n\n**Order**:\n+A customer request identified by a reference and fulfillment status.\n_Avoid_: Payload\n\n**Order status**:\n+The normalized fulfillment state of an Order.\n_Avoid_: State string\n`,
    development: `# Development\n\nRun \`npm test\` with Node.js 24 after integrating changes. Both accepted request documents under \`docs/requests\` are primary sources for the merge.\n`,
  });
  write(root, 'src/order-intake.mjs', `export function normalizeOrder(input) {\n  return { reference: input.reference, status: input.status };\n}\n`);
  write(root, 'test/base.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { normalizeOrder } from '../src/order-intake.mjs';\n\ntest('Order intake returns reference and status', () => {\n  assert.deepEqual(normalizeOrder({ reference: 'A-1', status: 'pending' }), { reference: 'A-1', status: 'pending' });\n});\n`);
  commit(root, 'chore: establish Order normalization');
  git(root, ['checkout', '-q', '-b', 'reference-normalization']);
  write(root, 'docs/requests/reference-normalization.md', `# Normalize Order references\n\nTrim surrounding whitespace from Order references and reject a reference that becomes empty. Preserve Order status behavior.\n`);
  write(root, 'src/order-intake.mjs', `export function normalizeOrder(input) {\n  const reference = input.reference.trim();\n  if (!reference) throw new Error('reference required');\n  return { reference, status: input.status };\n}\n`);
  write(root, 'test/reference.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { normalizeOrder } from '../src/order-intake.mjs';\n\ntest('Order intake trims references', () => {\n  assert.equal(normalizeOrder({ reference: ' A-1 ', status: 'pending' }).reference, 'A-1');\n});\n\ntest('Order intake rejects empty references', () => {\n  assert.throws(() => normalizeOrder({ reference: ' ', status: 'pending' }), /reference required/);\n});\n`);
  const incoming = commit(root, 'feat: normalize Order references');
  git(root, ['checkout', '-q', 'main']);
  write(root, 'docs/requests/status-normalization.md', `# Normalize Order status\n\nNormalize Order status to lowercase and reject values other than \`pending\` and \`shipped\`. Preserve Order reference behavior.\n`);
  write(root, 'src/order-intake.mjs', `export function normalizeOrder(input) {\n  const status = input.status.toLowerCase();\n  if (!['pending', 'shipped'].includes(status)) throw new Error('unknown Order status');\n  return { reference: input.reference, status };\n}\n`);
  write(root, 'test/status.test.mjs', `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { normalizeOrder } from '../src/order-intake.mjs';\n\ntest('Order intake normalizes status', () => {\n  assert.equal(normalizeOrder({ reference: 'A-1', status: 'SHIPPED' }).status, 'shipped');\n});\n\ntest('Order intake rejects unknown status', () => {\n  assert.throws(() => normalizeOrder({ reference: 'A-1', status: 'lost' }), /unknown Order status/);\n});\n`);
  const current = commit(root, 'feat: normalize Order status');
  const merge = spawnSync('git', ['merge', '--no-edit', 'reference-normalization'], { cwd: root, encoding: 'utf8' });
  if (merge.status === 0 || !lstatSync(join(root, '.git/MERGE_HEAD')).isFile()) {
    throw new Error('Expected the merge-conflict fixture to stop at a conflict');
  }
  repositories['merge-conflict'] = { path: root, skills, current, incoming };
}

const provenance = identifyFixtureSource({
  sourceRoot,
  builderPath: scriptSourcePath,
  files: sharedFiles,
  directories: Object.fromEntries(skillNames.map(name => [name, join(skillsRoot, name)])),
});
const skills = provenance.directories;

process.stdout.write(`${JSON.stringify({
  format: 'repo-canon/engineering-skill-fixtures/v1',
  root: fixtureRoot,
  source: {
    repository: gitOptional(sourceRoot, ['config', '--get', 'remote.origin.url']),
    worktreeCommit: provenance.head,
    fixtureBuilderSha256: provenance.inputFiles[scriptSourcePath].sha256,
    pinnedUpstreamCommit: '3cca18b368ae95cdbdebbff572ccafa662551015',
    directoryHashSerialization: provenance.directoryHashSerialization,
    inputFiles: provenance.inputFiles,
  },
  skills,
  repositories,
}, null, 2)}\n`);
