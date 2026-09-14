import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const sourceRoot = new URL('..', import.meta.url).pathname;
const builder = join(sourceRoot, 'scripts/create-productivity-skill-fixtures.mjs');
const runtimeRoot = join(sourceRoot, 'docs/development/productivity-skill-runtime');
const finalsRoot = join(sourceRoot, 'docs/development/productivity-skill-session-finals');

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function build(t) {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-productivity-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'fixtures');
  const output = execFileSync(process.execPath, [builder, '--root', root], {
    cwd: sourceRoot,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('builds scenario-specific repositories using every pinned productivity skill', (t) => {
  const manifest = build(t);
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
    assert.equal(readFileSync(join(repository.path, 'AGENTS.md'), 'utf8'), readFileSync(join(sourceRoot, 'AGENTS.md'), 'utf8'));
    assert.equal(execFileSync('git', ['config', '--get', 'commit.gpgsign'], { cwd: repository.path, encoding: 'utf8' }).trim(), 'false');
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

test('fixtures expose the prerequisites each skill must actually use', (t) => {
  const { repositories } = build(t);
  assert.ok(readFileSync(join(repositories['grill-me'].path, 'docs/product-constraints.md'), 'utf8').includes('wall display'));
  assert.ok(readFileSync(join(repositories.grilling.path, 'docs/export-constraints.md'), 'utf8').includes('24 hours'));
  assert.ok(readFileSync(join(repositories.handoff.path, '.gitignore'), 'utf8').includes('.exercise-secret'));
  assert.ok(existsSync(join(repositories.teach.path, '.agents/skills/teach/RESOURCES-FORMAT.md')));
  assert.ok(readFileSync(join(repositories['to-questionnaire'].path, 'docs/decision-gap.md'), 'utf8').includes('daily volume'));
  assert.ok(readFileSync(join(repositories['wait-what'].path, 'docs/status.md'), 'utf8').includes('84 of 100'));
  assert.ok(readFileSync(join(repositories['writing-for-agents'].path, 'docs/agents/project.md'), 'utf8').includes('Always be careful'));
  assert.ok(existsSync(join(repositories['writing-for-agents'].path, '.agents/skills/writing-for-agents/SKILL-MECHANICS.md')));
});

test('retains exact runtime outputs and the teaching feedback loop', () => {
  assert.equal(
    sha256(join(runtimeRoot, 'handoff.md')),
    '800577c1e1ed9657adc771f584ffc81676dc5c5f778cd121a23b8cb9b1ebc9fb',
  );
  assert.equal(
    sha256(join(runtimeRoot, 'event-retention-questionnaire.md')),
    '6fc701db2ee729f7955091806560d5fee9b3e2cd21dc2e6f9e67dfcc1c2c337d',
  );
  assert.equal(
    sha256(join(runtimeRoot, 'writing-for-agents-project.md')),
    '1723db18f0c9a021402934de669b426f415ebd2da8509e138503b09aff7e90e5',
  );
  assert.equal(
    sha256(join(runtimeRoot, 'writing-for-agents-probe-test.mjs')),
    '809b6d6a32fd340fdc6846f099056f8a5f47f12250f12a26192edfb776b22464',
  );

  const handoff = readFileSync(join(runtimeRoot, 'handoff.md'), 'utf8');
  assert.match(handoff, /## Suggested skills/);
  assert.doesNotMatch(handoff, /fake-sensitive-value/);

  const questionnaire = readFileSync(join(runtimeRoot, 'event-retention-questionnaire.md'), 'utf8');
  assert.match(questionnaire, /## How to answer/);
  assert.match(questionnaire, /## Anything else\?/);

  const lesson = readFileSync(join(runtimeRoot, 'teach/lessons/0001-release-baseline-guard.html'), 'utf8');
  assert.match(lesson, /data-check="order"/);
  assert.match(lesson, /data-check="status"/);
  assert.match(lesson, /data-check="error"/);
  assert.match(lesson, /\.\.\/reference\/release-baseline-guard\.html/);
  assert.match(lesson, /answer: 'ordinary rejection'/);
  assert.match(lesson, /answer: 'processing failure'/);
  assert.match(lesson, /exit 1/);
  assert.match(lesson, /exit "\$status"/);
  assert.match(lesson, /git-scm\.com\/docs\/git-merge-base/);
  assert.ok(existsSync(join(runtimeRoot, 'teach/assets/course.css')));
  const reference = readFileSync(join(runtimeRoot, 'teach/reference/release-baseline-guard.html'), 'utf8');
  assert.match(reference, /exit 1/);
  assert.match(reference, /exit "\$status"/);
  assert.ok(existsSync(join(runtimeRoot, 'teach/learning-records/0001-release-ancestry-guard.md')));

  const finalResponses = readdirSync(finalsRoot).filter((name) => name.startsWith('issue-13-'));
  assert.equal(finalResponses.length, 28);
});
