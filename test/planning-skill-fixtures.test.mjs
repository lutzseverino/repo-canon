import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url).pathname;

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('planning and adoption fixture builder creates runnable bounded scenarios', () => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-planning-test-'));
  const target = join(parent, 'fixtures');

  try {
    const output = execFileSync(
      process.execPath,
      ['scripts/create-planning-skill-fixtures.mjs', '--root', target],
      { cwd: root, encoding: 'utf8' },
    );
    const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));

    assert.match(output, /Created planning-skill fixtures/);
    assert.deepEqual(Object.keys(manifest.repositories).sort(), [
      'adoption-preparation',
      'delivery',
      'planning',
      'setup',
      'triage-wayfinder',
    ]);
    assert.equal(manifest.source.upstreamCommit, '3cca18b368ae95cdbdebbff572ccafa662551015');
    assert.deepEqual(manifest.skills.map(({ name }) => name), [
      'setup-matt-pocock-skills',
      'grill-with-docs',
      'to-spec',
      'to-tickets',
      'triage',
      'wayfinder',
      'implement',
      'prototype',
      'wizard',
    ]);
    for (const skill of manifest.skills) {
      assert.match(skill.sha256, /^[a-f0-9]{64}$/);
    }
    for (const repository of Object.values(manifest.repositories)) {
      for (const skill of readdirSync(join(repository.path, '.agents', 'skills'))) {
        const target = realpathSync(join(repository.path, '.agents', 'skills', skill));
        assert.equal(statSync(target).isDirectory(), true);
      }
    }

    const setup = join(target, 'setup');
    assert.match(readFileSync(join(setup, 'AGENTS.md'), 'utf8'), /Keep the `Parcel` term/);
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: setup, encoding: 'utf8' }), '');

    const preparation = join(target, 'adoption-preparation');
    assert.match(readFileSync(join(preparation, 'candidate', 'AGENTS.md'), 'utf8'), /# Agent guidance/);
    assert.match(readFileSync(join(preparation, 'AGENTS.md'), 'utf8'), /Parcel API/);
    assert.match(readFileSync(join(preparation, 'docs', 'agents', 'issue-tracker.md'), 'utf8'), /Issue tracker/);

    const planning = join(target, 'planning');
    assert.match(readFileSync(join(planning, 'docs', 'agents', 'issue-tracker.md'), 'utf8'), /Local Markdown/);
    assert.match(readFileSync(join(planning, 'CONTEXT.md'), 'utf8'), /\*\*Parcel\*\*/);

    const triage = join(target, 'triage-wayfinder');
    assert.match(readFileSync(join(triage, '.scratch', 'triage', '01-export-receipts.md'), 'utf8'), /Status: needs-triage/);
    assert.match(readFileSync(join(triage, '.scratch', 'shipping-map', 'issues', '03-choose-retry-window.md'), 'utf8'), /Blocked by: 02/);

    const delivery = join(target, 'delivery');
    assert.throws(
      () => execFileSync(process.execPath, ['test/delivery.test.mjs'], { cwd: delivery, encoding: 'utf8', stdio: 'pipe' }),
      /Command failed/,
    );
    assert.match(readFileSync(join(delivery, '.github', 'workflows', 'delivery.yml'), 'utf8'), /secrets\.PARCEL_API_TOKEN/);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('retained planning artifacts preserve native formats and runtime outputs', () => {
  const artifacts = join(root, 'docs', 'development', 'planning-skill-artifacts');
  const specification = readFileSync(join(artifacts, 'intake-batch-spec.md'), 'utf8');
  for (const heading of [
    'Problem Statement',
    'Solution',
    'User Stories',
    'Implementation Decisions',
    'Testing Decisions',
    'Out of Scope',
    'Further Notes',
  ]) {
    assert.match(specification, new RegExp(`^## ${heading}$`, 'm'));
  }
  assert.doesNotMatch(specification, /Agent Brief|Category: (?:bug|enhancement)/);

  const firstTicket = readFileSync(join(artifacts, 'intake-batch-ticket-01.md'), 'utf8');
  const secondTicket = readFileSync(join(artifacts, 'intake-batch-ticket-02.md'), 'utf8');
  assert.match(firstTicket, /\*\*Status:\*\* ready-for-agent/);
  assert.match(firstTicket, /None \(can start immediately\)/);
  assert.match(secondTicket, /\*\*Status:\*\* ready-for-agent/);
  assert.match(secondTicket, /Blocked by.*01:/s);

  const triage = readFileSync(join(artifacts, 'receipt-export-triage.md'), 'utf8');
  assert.equal(triage.match(/^## Agent Brief$/gm)?.length, 1);
  assert.match(triage, /^Status: ready-for-agent$/m);
  assert.match(triage, /This changes the\s+candidate contract/);
  assert.match(triage, /renewed semantic review/i);

  const map = readFileSync(join(artifacts, 'retry-map.md'), 'utf8');
  assert.match(map, /\[Choose the default Retry window\]/);
  assert.doesNotMatch(map, /Whether Retry windows differ by carrier after a default is chosen/);
  assert.match(readFileSync(join(artifacts, 'retry-window-ticket.md'), 'utf8'), /^Status: resolved$/m);

  const prototype = readFileSync(join(artifacts, 'delivery-schedule-cancellation-prototype.html'), 'utf8');
  assert.match(prototype, /Guided walkthroughs/);
  assert.match(prototype, /const transition = \(state, action\) =>/);
  assert.match(prototype, /cancellation.*dispatch/is);

  const template = readFileSync(join(root, 'vendor', 'mattpocock-skills', 'skills', 'engineering', 'wizard', 'template.sh'), 'utf8');
  const wizardPath = join(artifacts, 'setup-parcel-sandbox.sh');
  const wizard = readFileSync(wizardPath, 'utf8');
  const stagesMarker = /# ─+\n# STAGES:/;
  assert.equal(wizard.split(stagesMarker)[0], template.split(stagesMarker)[0]);
  assert.match(wizard, /set_var PARCEL_API_URL/);
  assert.match(wizard, /set_secret PARCEL_API_TOKEN/);
  execFileSync('bash', ['-n', wizardPath]);

  assert.equal(
    sha256(join(artifacts, 'delivery-schedule-cancellation-prototype.html')),
    '7ff30e9a7d100a0e7137a6221c10e10975443e033eb5cafa3175ac4573dd7be4',
  );
  assert.equal(
    sha256(wizardPath),
    '6e00e8e83d01fb8393b60e88bf4b567aaee8d65b5827a8476bd829e00620f76d',
  );

  const builder = readFileSync(join(root, 'scripts', 'create-planning-skill-fixtures.mjs'), 'utf8');
  assert.doesNotMatch(builder, /execFileSync\(['"]codex['"]/);
});
