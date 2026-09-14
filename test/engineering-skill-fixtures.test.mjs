import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const script = join(repositoryRoot, 'scripts/create-engineering-skill-fixtures.mjs');

test('creates disposable engineering-skill repositories with their runtime prerequisites', t => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-engineering-skills-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'fixtures');

  const child = spawnSync(process.execPath, [script, '--root', root], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const manifest = JSON.parse(child.stdout);

  assert.equal(manifest.format, 'repo-canon/engineering-skill-fixtures/v1');
  assert.equal(manifest.root, root);
  assert.deepEqual(Object.keys(manifest.skills).sort(), [
    'ask-matt',
    'code-review',
    'codebase-design',
    'diagnosing-bugs',
    'domain-modeling',
    'improve-codebase-architecture',
    'research',
    'resolving-merge-conflicts',
    'tdd',
  ]);
  assert.deepEqual(Object.keys(manifest.repositories).sort(), [
    'architecture',
    'debugging',
    'merge-conflict',
    'modeling-research',
    'routing-review',
    'tdd',
  ]);

  for (const [name, repository] of Object.entries(manifest.repositories)) {
    assert.equal(execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: repository.path,
      encoding: 'utf8',
    }).trim(), 'true', name);
    assert.equal(
      readFileSync(join(repository.path, 'AGENTS.md'), 'utf8'),
      readFileSync(join(repositoryRoot, 'AGENTS.md'), 'utf8'),
      `${name} has the shared agent entry point`,
    );
    assert.equal(
      readFileSync(join(repository.path, 'CONTRIBUTING.md'), 'utf8'),
      readFileSync(join(repositoryRoot, 'CONTRIBUTING.md'), 'utf8'),
      `${name} has the shared contribution contract`,
    );
    assert.match(readFileSync(join(repository.path, 'CONTEXT.md'), 'utf8'), /## Language/);
    assert.match(readFileSync(join(repository.path, 'docs/development/README.md'), 'utf8'), /npm test/);

    for (const skill of repository.skills) {
      const link = join(repository.path, '.agents/skills', skill);
      assert.equal(lstatSync(link).isSymbolicLink(), true, `${name} exposes ${skill} as a repo skill`);
      assert.equal(readlinkSync(link), manifest.skills[skill].path);
      assert.match(manifest.skills[skill].sha256, /^[a-f0-9]{64}$/);
    }
  }

  const conflict = manifest.repositories['merge-conflict'];
  assert.equal(execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], {
    cwd: conflict.path,
    encoding: 'utf8',
  }).trim(), 'src/order-intake.mjs');
  assert.equal(execFileSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], {
    cwd: conflict.path,
    encoding: 'utf8',
  }).trim().length, 40);
});
