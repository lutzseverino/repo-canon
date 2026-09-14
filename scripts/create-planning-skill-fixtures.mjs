#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const skillsRoot = join(sourceRoot, 'vendor/mattpocock-skills/skills/engineering');
const upstreamCommit = '3cca18b368ae95cdbdebbff572ccafa662551015';
const skillNames = [
  'setup-matt-pocock-skills',
  'grill-with-docs',
  'to-spec',
  'to-tickets',
  'triage',
  'wayfinder',
  'implement',
  'prototype',
  'wizard',
];

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const requestedRoot = argument('--root');
const fixtureRoot = requestedRoot ?? mkdtempSync(join(tmpdir(), 'repo-canon-planning-skills-'));
if (requestedRoot && existsSync(fixtureRoot)) throw new Error(`Fixture root already exists: ${fixtureRoot}`);
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '--no-gpg-sign', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function hashDirectory(root) {
  const digest = createHash('sha256');
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) visit(absolute);
      else {
        digest.update(path);
        digest.update('\0');
        digest.update(readFileSync(absolute));
        digest.update('\0');
      }
    }
  }
  visit(root);
  return digest.digest('hex');
}

function createRepository(name, skills, { agents, context }) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  write(root, 'AGENTS.md', agents);
  cpSync(join(sourceRoot, 'CONTRIBUTING.md'), join(root, 'CONTRIBUTING.md'));
  write(root, 'CONTEXT.md', context);
  write(root, 'docs/development/README.md', '# Development\n\nUse Node.js 24. Run `npm test` and `git diff --check`. This repository is a disposable local exercise and must not contact a remote service.\n');
  write(root, 'package.json', `${JSON.stringify({
    name: `repo-canon-${name}-exercise`,
    private: true,
    type: 'module',
    scripts: { test: 'node --test' },
  }, null, 2)}\n`);
  mkdirSync(join(root, '.agents/skills'), { recursive: true });
  for (const skill of skills) symlinkSync(join(skillsRoot, skill), join(root, '.agents/skills', skill), 'dir');
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['config', 'user.name', 'Repo Canon Exercise']);
  git(root, ['config', 'user.email', 'exercise@example.invalid']);
  return root;
}

function installLocalTracker(root) {
  cpSync(
    join(skillsRoot, 'setup-matt-pocock-skills', 'issue-tracker-local.md'),
    join(root, 'docs/agents/issue-tracker.md'),
  );
  write(root, 'docs/agents/triage-labels.md', readFileSync(join(sourceRoot, 'docs/agents/triage-labels.md'), 'utf8'));
  write(root, 'docs/agents/domain.md', readFileSync(join(sourceRoot, 'docs/agents/domain.md'), 'utf8'));
  write(root, 'docs/agents/README.md', '# Agent configuration\n\n- [Issue tracker](issue-tracker.md)\n- [Triage labels](triage-labels.md)\n- [Domain documentation](domain.md)\n- [Project guidance](project.md)\n');
  write(root, 'docs/agents/project.md', '# Exercise guidance\n\nThis repository is disposable. Use the local Markdown tracker and do not contact GitHub, publish branches, or send messages. Preserve Repo Canon contract terminology and the distinction between readiness and implementation eligibility.\n');
}

const repositories = {};

{
  const root = createRepository('setup', ['setup-matt-pocock-skills', 'triage'], {
    agents: '# Parcel desk agent instructions\n\nKeep the `Parcel` term in user-facing text. Before changing code, read `docs/operator-notes.md`. Run `npm test` before committing.\n',
    context: '# Parcel desk\n\n## Language\n\n**Parcel**:\nA shipment accepted by the desk.\n_Avoid_: Package, item\n',
  });
  write(root, 'docs/operator-notes.md', '# Operator notes\n\nParcel records are retained for 30 days.\n');
  repositories.setup = { path: root, skills: ['setup-matt-pocock-skills', 'triage'], initial: commit(root, 'chore: establish setup exercise') };
}

{
  const root = createRepository('adoption-preparation', ['setup-matt-pocock-skills'], {
    agents: '# Parcel API contributor instructions\n\nUse `Parcel` for accepted shipments. Read `docs/adr/0001-parcel-identifiers.md` before changing identifiers. Run `npm run verify-api` before committing API changes.\n',
    context: '# Parcel API\n\n## Language\n\n**Parcel**:\nA shipment accepted for delivery.\n_Avoid_: Package\n',
  });
  write(root, 'docs/adr/README.md', '# Architecture decisions\n\nDecisions for the disposable Parcel API.\n');
  write(root, 'docs/adr/0001-parcel-identifiers.md', '# Keep Parcel identifiers opaque\n\nParcel identifiers are opaque strings supplied by the carrier.\n');
  write(root, 'candidate/AGENTS.md', readFileSync(join(sourceRoot, 'AGENTS.md'), 'utf8'));
  write(root, 'package.json', `${JSON.stringify({
    name: 'repo-canon-adoption-preparation-exercise',
    private: true,
    type: 'module',
    scripts: { test: 'node --test', 'verify-api': 'node --test' },
  }, null, 2)}\n`);
  repositories['adoption-preparation'] = { path: root, skills: ['setup-matt-pocock-skills'], initial: commit(root, 'chore: establish adoption preparation exercise') };
}

{
  const root = createRepository('planning', ['grill-with-docs', 'to-spec', 'to-tickets', 'domain-modeling', 'grilling'], {
    agents: '# Agent guidance\n\nRead `CONTRIBUTING.md`, `docs/agents/issue-tracker.md`, and `docs/agents/domain.md` before planning. Native specifications and tickets are implementation contracts. Readiness does not bypass blockers.\n',
    context: '# Parcel intake\n\n## Language\n\n**Parcel**:\nA shipment accepted for delivery.\n_Avoid_: Package, item\n\n**Intake batch**:\nA set of Parcel declarations submitted together and accepted or rejected as one unit.\n_Avoid_: Upload\n',
  });
  installLocalTracker(root);
  write(root, 'docs/adr/README.md', '# Architecture decisions\n\nDecisions for Parcel intake.\n');
  write(root, 'docs/adr/0001-atomic-intake-batches.md', '# Intake batches are atomic\n\nAn Intake batch is accepted in full or rejected without creating any Parcels.\n');
  write(root, 'docs/planning/intake-batch-discussion.md', `# Intake batch discussion

Operators need to submit up to 100 Parcel declarations as one Intake batch. The accepted decisions are: JSON input only; validation reports every row error in one response; duplicate carrier references reject the full Intake batch; no partial acceptance; the existing single-Parcel endpoint remains; authentication and rate limits are unchanged. A prototype is unnecessary because the API shape is understood. The first releasable slice should accept and validate a batch through the public HTTP interface, and a later slice may add an operator-facing summary without blocking API use.
`);
  write(root, 'src/intake.mjs', 'export function acceptParcel(parcel) { return { ...parcel, accepted: true }; }\n');
  repositories.planning = { path: root, skills: ['grill-with-docs', 'to-spec', 'to-tickets'], initial: commit(root, 'chore: establish planning exercise') };
}

{
  const root = createRepository('triage-wayfinder', ['triage', 'wayfinder', 'grilling', 'domain-modeling', 'research', 'prototype'], {
    agents: '# Agent guidance\n\nRead the local tracker, triage labels, and domain documentation before tracker work. The latest Agent Brief is the candidate contract. A revision loses readiness until renewed authorized review. Wayfinder eligibility uses open state, assignment, and blockers.\n',
    context: '# Parcel operations\n\n## Language\n\n**Delivery receipt**:\nProof that a Parcel reached its destination.\n_Avoid_: Receipt record\n\n**Retry window**:\nThe period in which an operator may retry a failed Parcel dispatch.\n_Avoid_: Timeout\n',
  });
  installLocalTracker(root);
  write(root, '.scratch/triage/01-export-receipts.md', `# Export Delivery receipts

Status: needs-triage
Category: enhancement

## Request

Operators need a CSV export of Delivery receipts for a selected UTC date. The export must include parcel reference, delivered timestamp, and signer name. Empty dates return a header-only CSV. PDF export and scheduled delivery are outside scope.

## Comments

Reporter clarification: timestamps must remain ISO 8601 UTC and rows sort by Parcel reference.
`);
  write(root, '.scratch/shipping-map/map.md', `# Decide Parcel retry policy

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
`);
  write(root, '.scratch/shipping-map/issues/01-define-failure-categories.md', '# 01: Define failure categories\n\nType: grilling\nStatus: resolved\nBlocked by: None\n\n## Question\n\nWhich Parcel dispatch failures are retryable?\n\n## Answer\n\nTransient carrier failures are retryable; validation failures are not.\n');
  write(root, '.scratch/shipping-map/issues/02-choose-default-retry-window.md', '# 02: Choose the default Retry window\n\nType: grilling\nStatus: open\nBlocked by: 01\n\n## Question\n\nShould the default Retry window be 15 minutes or 60 minutes? The operations evidence says carrier incidents normally clear within 20 minutes; operators prefer one hour to avoid manual replay.\n');
  write(root, '.scratch/shipping-map/issues/03-choose-retry-window.md', '# 03: Choose carrier-specific Retry windows\n\nType: grilling\nStatus: open\nBlocked by: 02\n\n## Question\n\nDo any carriers need a Retry window that differs from the default?\n');
  repositories['triage-wayfinder'] = { path: root, skills: ['triage', 'wayfinder'], initial: commit(root, 'chore: establish tracker exercises') };
}

{
  const root = createRepository('delivery', ['implement', 'tdd', 'code-review', 'prototype', 'wizard'], {
    agents: '# Agent guidance\n\nRead the native ticket, glossary, and development commands. Use tests at the public `scheduleDelivery()` seam. Prototype work stays on a throwaway branch. Wizards must never contact production during this exercise.\n',
    context: '# Parcel delivery\n\n## Language\n\n**Delivery schedule**:\nThe ordered set of Parcels selected for dispatch.\n_Avoid_: Queue\n',
  });
  installLocalTracker(root);
  write(root, '.scratch/delivery/issues/01-prioritize-parcels.md', `# 01: Prioritize urgent Parcels

**What to build:** The public scheduleDelivery(Parcels) interface returns urgent Parcels first while preserving submission order within each priority.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Empty input returns an empty Delivery schedule.
- [ ] Urgent Parcels precede standard Parcels.
- [ ] Submission order is stable within each priority.
- [ ] Input Parcels are not mutated.
`);
  write(root, 'src/delivery.mjs', `export function scheduleDelivery(parcels) {
  return parcels.sort((left, right) => left.priority.localeCompare(right.priority));
}
`);
  write(root, 'test/delivery.test.mjs', `import assert from 'node:assert/strict';
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
`);
  write(root, 'docs/prototype-question.md', '# Prototype question\n\nCan dispatch coordinators understand a three-state Delivery schedule (`draft`, `confirmed`, `dispatched`) when cancellation is allowed only before dispatch? Build a self-contained logic prototype with visible state and guided awkward cases.\n');
  write(root, '.env.example', 'PARCEL_API_URL=https://sandbox.example.invalid\nPARCEL_API_TOKEN=replace-me\n');
  write(root, '.github/workflows/delivery.yml', `name: Delivery smoke test
on: workflow_dispatch
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/smoke-delivery.sh
        env:
          PARCEL_API_URL: \${{ vars.PARCEL_API_URL }}
          PARCEL_API_TOKEN: \${{ secrets.PARCEL_API_TOKEN }}
`);
  write(root, 'docs/sandbox-setup.md', '# Sandbox setup\n\nThe fictional dashboard URL is `https://sandbox.example.invalid/settings/api`. A human creates a test token there. The wizard may author instructions and validate syntax but must not open the URL or set a real secret in this exercise.\n');
  repositories.delivery = { path: root, skills: ['implement', 'prototype', 'wizard'], initial: commit(root, 'chore: establish delivery exercises') };
}

const manifest = {
  source: {
    repositoryHead: git(sourceRoot, ['rev-parse', 'HEAD']),
    upstreamCommit,
    codexCli: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim().replace('codex-cli ', ''),
    node: process.version,
    git: execFileSync('git', ['--version'], { encoding: 'utf8' }).trim(),
  },
  skills: skillNames.map((name) => ({ name, sha256: hashDirectory(join(skillsRoot, name)) })),
  repositories,
};
write(fixtureRoot, 'manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Created planning-skill fixtures at ${fixtureRoot}`);
console.log(`Manifest: ${join(fixtureRoot, 'manifest.json')}`);
