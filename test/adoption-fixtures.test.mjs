import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
    const remoteState = JSON.parse(readFileSync(plan.repositories[name].remoteState, 'utf8'));
    assert.equal(remoteState.repo, `repo-canon-fixtures/${name}`);
    assert.equal(remoteState.labels[0].name, 'adopter-owned');
    assert.equal(remoteState.rulesets[0].name, 'Adopter release policy');
  }

  const prepared = join(output, 'prepared-monorepo');
  assert.deepEqual(git(prepared, 'log', '--format=%s').split('\n'), [
    'docs: preserve project agent guidance',
    'chore: create disposable adoption fixture',
  ]);
  const originalAgents = readFileSync(join(prepared, 'AGENTS.md'), 'utf8');
  const preservedAgents = readFileSync(join(prepared, 'docs/agents/project.md'), 'utf8');
  assert.match(readFileSync(join(prepared, 'docs/usage/quick-reference.md'), 'utf8'), /Archive telemetry/);
  for (const expected of plan.expectations['prepared-monorepo'].preservedAgentText) {
    assert.match(originalAgents, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(preservedAgents, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(lstatSync(join(output, 'protection', 'docs/linked.md')).isSymbolicLink(), true);
  assert.equal(lstatSync(join(output, 'bin/gh')).mode & 0o111, 0o111);

  const statePath = plan.repositories['empty-and-unresolved'].remoteState;
  const projectRoot = join(output, 'empty-and-unresolved');
  const environment = {
    ...process.env,
    PATH: `${plan.fixtureEnvironment.path}:${process.env.PATH}`,
    FAKE_GH_STATE: statePath,
  };
  const baseRequest = {
    format: 'repo-standards/operation/v1',
    projectRoot,
    standards: {
      repository: 'https://github.com/lutzseverino/repo-canon',
      version: 'v0.0.1-evidence',
      commit: '0000000000000000000000000000000000000000',
    },
    profile: 'complete',
    declarations: [],
    allowedTargets: { paths: [], directories: [] },
  };
  for (const [script, id] of [
    ['operations/setup-github-labels.mjs', 'canonical-labels'],
    ['operations/setup-github-pr-integration.mjs', 'pull-request-integration'],
  ]) {
    const result = spawnSync(process.execPath, [join(repositoryRoot, script)], {
      cwd: projectRoot,
      env: environment,
      encoding: 'utf8',
      input: JSON.stringify({
        ...baseRequest,
        operation: { declaration: 'github-repository-configuration', phase: 'fixes', id },
      }),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, 'changed');
  }
  const finalRemoteState = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(finalRemoteState.labels.length, 13);
  assert.equal(finalRemoteState.labels.some(label => label.name === 'adopter-owned'), true);
  assert.equal(finalRemoteState.rulesets.length, 2);
  assert.equal(finalRemoteState.rulesets.some(rule => rule.name === 'Adopter release policy'), true);
  assert.equal(finalRemoteState.rulesets.some(rule => rule.name === 'Repo Canon required PR checks'), true);
  assert.deepEqual(finalRemoteState.settings, {
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'PR_BODY',
  });
});
