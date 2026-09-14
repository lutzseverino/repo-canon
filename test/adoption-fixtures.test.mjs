import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const repositoryRoot = new URL('..', import.meta.url).pathname;

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

test('prepares clean real Git repositories for the adoption evidence matrix', t => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-fixture-test-'));
  const output = join(parent, 'fixtures');
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  execFileSync('node', ['scripts/prepare-adoption-fixtures.mjs', output], {
    cwd: repositoryRoot,
    stdio: 'pipe',
  });
  const plan = JSON.parse(readFileSync(join(output, 'plan.json'), 'utf8'));

  assert.equal(plan.format, 'repo-canon/adoption-fixture-plan/v1');
  assert.deepEqual(Object.keys(plan.repositories).sort(), [
    'amendment-success',
    'empty-and-unresolved',
    'prepared-monorepo',
    'protection',
    'readoption',
    'retroactive-write-rejected',
  ]);
  for (const name of Object.keys(plan.repositories)) {
    assert.equal(git(join(output, name), 'status', '--porcelain=v1'), '');
    assert.match(git(join(output, name), 'remote', 'get-url', 'origin'), /^https:\/\/github\.com\/repo-canon-fixtures\//);
  }

  const prepared = join(output, 'prepared-monorepo');
  assert.deepEqual(git(prepared, 'log', '--format=%s').split('\n'), [
    'docs: preserve project agent guidance',
    'chore: create disposable adoption fixture',
  ]);
  const originalAgents = readFileSync(join(prepared, 'AGENTS.md'), 'utf8');
  const preservedAgents = readFileSync(join(prepared, 'docs/agents/project.md'), 'utf8');
  for (const expected of plan.expectations['prepared-monorepo'].preservedAgentText) {
    assert.match(originalAgents, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(preservedAgents, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(lstatSync(join(output, 'protection', 'docs/linked.md')).isSymbolicLink(), true);
  assert.equal(lstatSync(join(output, 'bin/gh')).mode & 0o111, 0o111);
});
