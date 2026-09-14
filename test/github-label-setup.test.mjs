import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixture, invokeOperation, snapshot } from './helpers/operation.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repositoryRoot, 'operations/setup-github-labels.mjs');
const fakeGh = join(repositoryRoot, 'test/fixtures/fake-gh.mjs');
const fakeNodeVersion = join(repositoryRoot, 'test/fixtures/fake-node-version.mjs');

const canonicalLabels = [
  { name: 'needs-triage', color: 'fbca04', description: 'Requires review or renewed review' },
  { name: 'needs-info', color: 'd4c5f9', description: 'Waiting for information needed to evaluate the request' },
  { name: 'ready-for-agent', color: '0e8a16', description: 'Reviewed and sufficiently specified for agent implementation' },
  { name: 'ready-for-human', color: '1d76db', description: 'Reviewed and requires human implementation' },
  { name: 'wontfix', color: 'ffffff', description: 'Will not be actioned' },
  { name: 'bug', color: 'd73a4a', description: "Something isn't working" },
  { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
  { name: 'wayfinder:map', color: '5319e7', description: 'Planning map for related work' },
  { name: 'wayfinder:research', color: 'bfd4f2', description: 'Research question in a planning map' },
  { name: 'wayfinder:prototype', color: 'bfd4f2', description: 'Prototype question in a planning map' },
  { name: 'wayfinder:grilling', color: 'bfd4f2', description: 'Design decision requiring discussion' },
  { name: 'wayfinder:task', color: 'bfd4f2', description: 'Task in a planning map' },
];

function operationRequest(projectRoot, overrides = {}) {
  return {
    format: 'repo-standards/operation/v1',
    operation: { declaration: 'github-labels', phase: 'fixes', id: 'canonical-labels' },
    projectRoot,
    standards: {
      repository: 'https://github.com/lutzseverino/repo-canon',
      version: 'v0.0.0-test',
      commit: '0000000000000000000000000000000000000000',
    },
    profile: 'complete',
    declarations: [],
    allowedTargets: { paths: [], directories: [] },
    ...overrides,
  };
}

function setup(t, options = {}) {
  const project = fixture({ 'README.md': '# Fixture\n' });
  t.after(project.close);
  for (const [name, url] of Object.entries(options.remotes ?? { origin: 'git@github.com:acme/widgets.git' })) {
    execFileSync('git', ['remote', 'add', name, url], { cwd: project.root });
  }
  for (const [name, url] of Object.entries(options.pushUrls ?? {})) {
    execFileSync('git', ['remote', 'set-url', '--add', '--push', name, url], { cwd: project.root });
  }

  const toolsRoot = mkdtempSync(join(tmpdir(), 'repo-canon-github-tools-'));
  t.after(() => rmSync(toolsRoot, { recursive: true, force: true }));
  chmodSync(fakeGh, 0o755);
  symlinkSync(fakeGh, join(toolsRoot, 'gh'));
  const statePath = join(toolsRoot, 'state.json');
  writeFileSync(statePath, `${JSON.stringify({
    repo: 'acme/widgets',
    authenticated: true,
    labels: [],
    ...options.state,
  })}\n`);
  const env = {
    PATH: `${toolsRoot}:${dirname(process.execPath)}:/usr/bin:/bin`,
    FAKE_GH_STATE: statePath,
  };
  const invoke = (requestOverrides = {}, envOverrides = {}, nodeArguments = []) => invokeOperation(
    script,
    operationRequest(project.root, requestOverrides),
    { env: { ...env, ...envOverrides }, nodeArguments },
  );
  return {
    project,
    statePath,
    toolsRoot,
    invoke,
    readState: () => JSON.parse(readFileSync(statePath, 'utf8')),
  };
}

function assertProjectUnchanged(before, scenario) {
  assert.deepEqual(snapshot(scenario.project.root), before, 'remote setup must not change project content');
}

test('provisions every canonical label in an empty repository and is unchanged on repeat', t => {
  const scenario = setup(t);
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'changed');
  assert.match(outcome.result.message, /created 12 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
  assertProjectUnchanged(before, scenario);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, 'unchanged');
  assert.equal(scenario.readState().mutations, 12);
  assertProjectUnchanged(before, scenario);
});

test('reports unchanged after a successful matching setup', t => {
  const scenario = setup(t, { state: { labels: structuredClone(canonicalLabels) } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: 'repo-standards/result/v1',
    status: 'unchanged',
    message: 'GitHub labels already match the canonical configuration for acme/widgets.',
  });
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test('pins every API request to github.com when the environment selects another host', t => {
  const scenario = setup(t, { state: { labels: structuredClone(canonicalLabels) } });
  const outcome = scenario.invoke({}, { GH_HOST: 'enterprise.example' });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'unchanged');
  assert.deepEqual([...new Set(scenario.readState().apiHosts)], ['github.com']);
});

test('reconciles conflicting desired label values without replacing unrelated labels', t => {
  const labels = structuredClone(canonicalLabels);
  labels[0] = { name: 'Needs-Triage', color: '000000', description: 'Old meaning' };
  labels.push({ name: 'customer-report', color: '123456', description: 'Keep me' });
  const scenario = setup(t, { state: { labels } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'changed');
  assert.match(outcome.result.message, /updated needs-triage/);
  assert.deepEqual(scenario.readState().labels, [
    canonicalLabels[0],
    ...canonicalLabels.slice(1),
    { name: 'customer-report', color: '123456', description: 'Keep me' },
  ]);
});

test('blocks before mutation when repository identity is absent, ambiguous, or mismatched', async t => {
  await t.test('absent GitHub remote', st => {
    const scenario = setup(st, { remotes: { origin: 'https://example.com/acme/widgets.git' } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /No unambiguous github.com repository/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });

  await t.test('ambiguous GitHub remotes', st => {
    const scenario = setup(st, { remotes: {
      origin: 'https://github.com/acme/widgets.git',
      upstream: 'git@github.com:other/widgets.git',
    } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Multiple github.com repositories/);
    assert.match(outcome.result.message, /acme\/widgets/);
    assert.match(outcome.result.message, /other\/widgets/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });

  await t.test('ambiguous fetch and push targets', st => {
    const scenario = setup(st, {
      pushUrls: { origin: 'git@github.com:other/widgets.git' },
    });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Multiple github.com repositories/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });

  await t.test('API identity mismatch', st => {
    const scenario = setup(st, { state: { repo: 'acme/renamed-widgets' } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /resolved acme\/widgets as acme\/renamed-widgets/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
});

test('blocks for unavailable or incompatible tools and unauthenticated access', async t => {
  await t.test('incompatible Node.js runtime', st => {
    const scenario = setup(st);
    const outcome = scenario.invoke(
      {},
      { FAKE_NODE_VERSION: '23.11.0' },
      ['--import', fakeNodeVersion],
    );
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires Node\.js 24/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });

  await t.test('missing Git', st => {
    const scenario = setup(st);
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Git is unavailable/);
  });

  await t.test('incompatible Git', st => {
    const scenario = setup(st);
    const git = join(scenario.toolsRoot, 'git');
    writeFileSync(git, '#!/bin/sh\nprintf \'git version 2.17.9\\n\'\n');
    chmodSync(git, 0o755);
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires Git 2\.18\.0 or newer/);
  });

  await t.test('missing gh', st => {
    const scenario = setup(st);
    rmSync(join(scenario.toolsRoot, 'gh'));
    symlinkSync('/usr/bin/git', join(scenario.toolsRoot, 'git'));
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /GitHub CLI \(gh\) is unavailable/);
  });

  await t.test('incompatible gh', st => {
    const scenario = setup(st, { state: { version: 'gh version 2.47.0' } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires gh 2\.48\.0 or newer/);
  });

  await t.test('not authenticated', st => {
    const scenario = setup(st, { state: { authenticated: false } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /authenticated github.com access/);
  });
});

test('blocks without label-management permission before changing labels', t => {
  const scenario = setup(t, { state: {
    permissions: { admin: false, maintain: false, push: false, triage: true, pull: true },
  } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'blocked');
  assert.match(outcome.result.message, /write, maintain, or admin access/);
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test('reports partial effects and completes missing work after a transient API failure', t => {
  const scenario = setup(t, { state: { failAtMutation: 2 } });
  const first = scenario.invoke();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, 'blocked');
  assert.match(first.result.message, /created needs-triage/);
  assert.match(first.result.message, /11 labels remain/);
  assert.equal(scenario.readState().labels.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, 'changed');
  assert.match(retry.result.message, /created 11 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test('recovers after interruption by applying only labels still missing', t => {
  const scenario = setup(t, { state: { interruptAtMutation: 2 } });
  const interrupted = scenario.invoke();

  assert.equal(interrupted.status, null);
  assert.equal(interrupted.signal, 'SIGKILL');
  assert.deepEqual(scenario.readState().labels, [canonicalLabels[0]]);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, 'changed');
  assert.match(retry.result.message, /created 11 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test('blocks when readback disagrees and reports the changes already applied', t => {
  const scenario = setup(t, { state: { readbackMismatch: true } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'blocked');
  assert.match(outcome.result.message, /created 12 labels/);
  assert.match(outcome.result.message, /readback did not match/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test('rejects non-fix invocation and project-content targets as protocol errors', async t => {
  const scenario = setup(t);
  for (const overrides of [
    { operation: { declaration: 'github-labels', phase: 'checks', id: 'canonical-labels' } },
    { allowedTargets: { paths: ['README.md'], directories: [] } },
  ]) {
    const outcome = scenario.invoke(overrides);
    assert.equal(outcome.status, 1);
    assert.equal(outcome.result, null);
    assert.match(outcome.stderr, /GitHub label setup/);
  }
});
