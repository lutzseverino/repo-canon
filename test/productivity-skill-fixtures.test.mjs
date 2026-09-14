import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const sourceRoot = new URL('..', import.meta.url).pathname;
const builder = join(sourceRoot, 'scripts/create-productivity-skill-fixtures.mjs');

function build() {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-productivity-test-'));
  const root = join(parent, 'fixtures');
  const output = execFileSync(process.execPath, [builder, '--root', root], {
    cwd: sourceRoot,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('builds scenario-specific repositories using every pinned productivity skill', () => {
  const manifest = build();
  assert.equal(manifest.format, 'repo-canon/productivity-skill-fixtures/v1');
  assert.equal(manifest.source.upstreamCommit, '3cca18b368ae95cdbdebbff572ccafa662551015');
  assert.match(manifest.source.worktreeCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.source.builderSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(manifest.source.skills), [
    'grill-me', 'grilling', 'handoff', 'teach', 'to-questionnaire', 'wait-what', 'writing-for-agents',
  ]);

  const exercised = new Set();
  for (const repository of Object.values(manifest.repositories)) {
    assert.match(repository.head, /^[0-9a-f]{40}$/);
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: repository.path, encoding: 'utf8' }), '');
    assert.ok(readFileSync(join(repository.path, 'docs/agents/project.md'), 'utf8').includes('disposable'));
    assert.ok(readFileSync(join(repository.path, 'CONTEXT.md'), 'utf8').includes('## Language'));
    assert.ok(readFileSync(join(repository.path, 'docs/development/README.md'), 'utf8').startsWith('# Development'));
    for (const skill of repository.skills) {
      exercised.add(skill);
      const link = join(repository.path, '.agents/skills', skill);
      assert.ok(lstatSync(link).isSymbolicLink());
      assert.ok(existsSync(join(link, 'SKILL.md')));
      assert.match(manifest.source.skills[skill].sha256, /^[0-9a-f]{64}$/);
    }
  }
  assert.deepEqual([...exercised].sort(), Object.keys(manifest.source.skills).sort());
});

test('fixtures expose the prerequisites each skill must actually use', () => {
  const { repositories } = build();
  assert.ok(readFileSync(join(repositories['grill-me'].path, 'docs/product-constraints.md'), 'utf8').includes('wall display'));
  assert.ok(readFileSync(join(repositories.grilling.path, 'docs/export-constraints.md'), 'utf8').includes('24 hours'));
  assert.ok(readFileSync(join(repositories.handoff.path, '.gitignore'), 'utf8').includes('.exercise-secret'));
  assert.ok(existsSync(join(repositories.teach.path, '.agents/skills/teach/RESOURCES-FORMAT.md')));
  assert.ok(readFileSync(join(repositories['to-questionnaire'].path, 'docs/decision-gap.md'), 'utf8').includes('daily volume'));
  assert.ok(readFileSync(join(repositories['wait-what'].path, 'docs/status.md'), 'utf8').includes('84 of 100'));
  assert.ok(readFileSync(join(repositories['writing-for-agents'].path, 'AGENTS.md'), 'utf8').includes('Always be careful'));
  assert.ok(existsSync(join(repositories['writing-for-agents'].path, '.agents/skills/writing-for-agents/SKILL-MECHANICS.md')));
});
