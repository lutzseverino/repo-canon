import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url).pathname;

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
