import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { fixture, invokeOperation, snapshot } from './helpers/operation.mjs';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repositoryRoot, 'operations/setup-github-pr-integration.mjs');
const fakeGh = join(repositoryRoot, 'test/fixtures/fake-gh-pr-settings.mjs');
const fakeNodeVersion = join(repositoryRoot, 'test/fixtures/fake-node-version.mjs');
const checkName = 'PR metadata';
const rulesetName = 'Repo Canon required PR checks';

const matchingSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: 'PR_TITLE',
  squash_merge_commit_message: 'PR_BODY',
};

function canonicalRuleset(overrides = {}) {
  return {
    id: 50,
    name: rulesetName,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [{
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: checkName }],
      },
    }],
    ...overrides,
  };
}

function operationRequest(projectRoot, overrides = {}) {
  return {
    format: 'repo-standards/operation/v1',
    operation: { declaration: 'github-pr-integration', phase: 'fixes', id: 'required-checks-and-squash' },
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

  const toolsRoot = mkdtempSync(join(tmpdir(), 'repo-canon-pr-settings-tools-'));
  t.after(() => rmSync(toolsRoot, { recursive: true, force: true }));
  chmodSync(fakeGh, 0o755);
  symlinkSync(fakeGh, join(toolsRoot, 'gh'));
  const statePath = join(toolsRoot, 'state.json');
  writeFileSync(statePath, `${JSON.stringify({
    repo: 'acme/widgets',
    authenticated: true,
    settings: {
      allow_squash_merge: false,
      allow_merge_commit: true,
      allow_rebase_merge: true,
      squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
      squash_merge_commit_message: 'COMMIT_MESSAGES',
      delete_branch_on_merge: true,
    },
    branchStatusChecks: null,
    rulesets: [],
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
    toolsRoot,
    invoke,
    readState: () => JSON.parse(readFileSync(statePath, 'utf8')),
  };
}

function assertProjectUnchanged(before, scenario) {
  assert.deepEqual(snapshot(scenario.project.root), before, 'remote setup must not change project content');
}

test('creates required-check enforcement, configures squash defaults, and is unchanged on repeat', t => {
  const scenario = setup(t);
  const before = snapshot(scenario.project.root);
  const first = scenario.invoke();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, 'changed');
  assert.match(first.result.message, /created required-check ruleset/);
  assert.match(first.result.message, /updated squash merge settings/);
  const state = scenario.readState();
  assert.deepEqual(state.settings, { ...matchingSettings, delete_branch_on_merge: true });
  assert.deepEqual(state.rulesets, [canonicalRuleset({ id: 100 })]);
  assertProjectUnchanged(before, scenario);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, 'unchanged');
  assert.equal(scenario.readState().mutations, 2);
  assertProjectUnchanged(before, scenario);
});

test('returns unchanged when branch protection and merge settings already match', t => {
  const unrelatedRuleset = {
    id: 7,
    name: 'Require reviews',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['refs/heads/release'], exclude: [] } },
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 2 } }],
  };
  const scenario = setup(t, { state: {
    settings: { ...matchingSettings, web_commit_signoff_required: true },
    branchStatusChecks: {
      strict: true,
      contexts: ['build', checkName],
      checks: [{ context: 'build', app_id: 123 }],
    },
    rulesets: [unrelatedRuleset],
  } });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: 'repo-standards/result/v1',
    status: 'unchanged',
    message: 'GitHub PR integration already matches the canonical configuration for acme/widgets.',
  });
  assert.equal(scenario.readState().mutations ?? 0, 0);
  assert.deepEqual(scenario.readState().rulesets, [unrelatedRuleset]);
});

test('adds PR metadata to classic branch checks while preserving checks, rulesets, and settings', t => {
  const unrelatedRuleset = canonicalRuleset({ id: 8, name: 'Adopter security checks' });
  const scenario = setup(t, { state: {
    settings: { ...matchingSettings, allow_auto_merge: true },
    branchStatusChecks: {
      strict: true,
      contexts: ['build'],
      checks: [{ context: 'security', app_id: 456 }],
    },
    rulesets: [unrelatedRuleset],
  } });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'changed');
  assert.match(outcome.result.message, /required PR metadata through main branch protection/);
  const state = scenario.readState();
  assert.deepEqual(state.branchStatusChecks, {
    strict: true,
    contexts: ['build', checkName],
    checks: [{ context: 'security', app_id: 456 }],
  });
  assert.deepEqual(state.rulesets, [unrelatedRuleset]);
  assert.equal(state.settings.allow_auto_merge, true);
});

test('accepts GitHub classic status-check responses that omit the optional checks list', t => {
  const scenario = setup(t, { state: {
    settings: matchingSettings,
    branchStatusChecks: { strict: false, contexts: ['build'] },
  } });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'changed');
  assert.deepEqual(scenario.readState().branchStatusChecks, {
    strict: false,
    contexts: ['build', checkName],
  });
});

test('reconciles the dedicated ruleset and conflicting merge settings without removing adopter policy', t => {
  const managed = canonicalRuleset({
    enforcement: 'evaluate',
    bypass_actors: [{ actor_id: 5, actor_type: 'Team', bypass_mode: 'pull_request' }],
    conditions: { ref_name: { include: ['refs/heads/release'], exclude: ['~DEFAULT_BRANCH', 'refs/heads/legacy'] } },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: true,
          required_status_checks: [{ context: 'adopter test', integration_id: 22 }],
        },
      },
      { type: 'non_fast_forward' },
    ],
  });
  const unrelated = canonicalRuleset({ id: 51, name: 'Release policy' });
  const scenario = setup(t, { state: {
    rulesets: [managed, unrelated],
    settings: {
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: true,
      squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
      squash_merge_commit_message: 'COMMIT_MESSAGES',
      delete_branch_on_merge: false,
    },
  } });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, 'changed');
  const state = scenario.readState();
  assert.deepEqual(state.rulesets[0], canonicalRuleset({
    enforcement: 'active',
    bypass_actors: managed.bypass_actors,
    conditions: {
      ref_name: {
        include: ['refs/heads/release', '~DEFAULT_BRANCH'],
        exclude: ['refs/heads/legacy'],
      },
    },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: true,
          required_status_checks: [
            { context: 'adopter test', integration_id: 22 },
            { context: checkName },
          ],
        },
      },
      { type: 'non_fast_forward' },
    ],
  }));
  assert.deepEqual(state.rulesets[1], unrelated);
  assert.deepEqual(state.settings, { ...matchingSettings, delete_branch_on_merge: false });
});

test('pins API requests and authentication to the inferred github.com target', async t => {
  await t.test('enterprise environment override', st => {
    const scenario = setup(st, { state: {
      settings: matchingSettings,
      branchStatusChecks: { strict: false, contexts: [checkName], checks: [] },
    } });
    const outcome = scenario.invoke({}, { GH_HOST: 'enterprise.example' });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'unchanged');
    assert.deepEqual([...new Set(scenario.readState().apiHosts)], ['github.com']);
    assert.deepEqual(scenario.readState().authStatusArguments, ['--hostname', 'github.com', '--active']);
  });

  await t.test('global remote cannot supply the target', st => {
    const scenario = setup(st, { remotes: {} });
    const globalConfig = join(scenario.toolsRoot, 'global.gitconfig');
    writeFileSync(globalConfig, '[remote "injected"]\n\turl = git@github.com:other/widgets.git\n');
    const outcome = scenario.invoke({}, { GIT_CONFIG_GLOBAL: globalConfig });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /No unambiguous github.com repository/);
    assert.deepEqual(scenario.readState().apiHosts ?? [], []);
  });

  await t.test('global remote cannot conflict with a local target', st => {
    const scenario = setup(st, { state: {
      settings: matchingSettings,
      branchStatusChecks: { strict: false, contexts: [checkName], checks: [] },
    } });
    const globalConfig = join(scenario.toolsRoot, 'global.gitconfig');
    writeFileSync(globalConfig, '[remote "injected"]\n\turl = git@github.com:other/widgets.git\n');
    const outcome = scenario.invoke({}, { GIT_CONFIG_GLOBAL: globalConfig });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'unchanged');
  });
});

test('blocks before mutation when repository identity is absent, ambiguous, or mismatched', async t => {
  const cases = [
    [{ remotes: { origin: 'https://example.com/acme/widgets.git' } }, /No unambiguous github.com repository/],
    [{ remotes: { origin: 'https://github.com/acme/widgets.git', upstream: 'git@github.com:other/widgets.git' } }, /Multiple github.com repositories/],
    [{ pushUrls: { origin: 'git@github.com:other/widgets.git' } }, /Multiple github.com repositories/],
    [{ state: { repo: 'acme/renamed-widgets' } }, /resolved acme\/widgets as acme\/renamed-widgets/],
  ];
  for (const [options, message] of cases) {
    await t.test(message.source, st => {
      const scenario = setup(st, options);
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, 'blocked');
      assert.match(outcome.result.message, message);
      assert.equal(scenario.readState().mutations ?? 0, 0);
    });
  }
});

test('blocks for unavailable prerequisites, authentication, permission, and inspection failures', async t => {
  await t.test('incompatible Node.js runtime', st => {
    const scenario = setup(st);
    const outcome = scenario.invoke({}, { FAKE_NODE_VERSION: '23.11.0' }, ['--import', fakeNodeVersion]);
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires Node\.js 24/);
  });
  await t.test('missing Git', st => {
    const scenario = setup(st);
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /Git is unavailable/);
  });
  await t.test('incompatible Git', st => {
    const scenario = setup(st);
    const git = join(scenario.toolsRoot, 'git');
    writeFileSync(git, '#!/bin/sh\nprintf \'git version 2.17.9\\n\'\n');
    chmodSync(git, 0o755);
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires Git 2\.18\.0 or newer/);
  });
  await t.test('missing gh', st => {
    const scenario = setup(st);
    rmSync(join(scenario.toolsRoot, 'gh'));
    symlinkSync('/usr/bin/git', join(scenario.toolsRoot, 'git'));
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /GitHub CLI \(gh\) is unavailable/);
  });
  await t.test('incompatible gh', st => {
    const scenario = setup(st, { state: { version: 'gh version 2.56.0' } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /requires gh 2\.57\.0 or newer/);
  });
  await t.test('not authenticated', st => {
    const scenario = setup(st, { state: { authenticated: false } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /authenticated github.com access/);
  });
  await t.test('inactive invalid account does not mask active access', st => {
    const scenario = setup(st, { state: {
      inactiveAuthInvalid: true,
      settings: matchingSettings,
      branchStatusChecks: { strict: false, contexts: [checkName], checks: [] },
    } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'unchanged');
  });
  await t.test('non-admin access', st => {
    const scenario = setup(st, { state: {
      permissions: { admin: false, maintain: true, push: true, triage: true, pull: true },
    } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /admin access/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
  await t.test('ruleset inspection failure', st => {
    const scenario = setup(st, { state: { failRulesetInspection: true } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /could not inspect repository rulesets/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
  await t.test('ambiguous branch-protection 404', st => {
    const scenario = setup(st, { state: { failBranchInspection: true } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, 'blocked');
    assert.match(outcome.result.message, /could not inspect required checks/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
});

test('reports partial effects and retries only the missing squash change', t => {
  const scenario = setup(t, { state: { failAtMutation: 2 } });
  const first = scenario.invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, 'blocked');
  assert.match(first.result.message, /Confirmed partial effects: created required-check ruleset/);
  assert.match(first.result.message, /squash merge settings remain/i);
  assert.equal(scenario.readState().rulesets.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, 'changed');
  assert.match(retry.result.message, /updated squash merge settings/);
  assert.deepEqual(scenario.readState().mutationLog, [
    'create required-check ruleset',
    'update squash settings',
  ]);

  const repeat = scenario.invoke();
  assert.equal(repeat.result.status, 'unchanged');
  assert.equal(scenario.readState().mutations, 2);
});

test('recovers after interruption by applying only the remaining change', t => {
  const scenario = setup(t, { state: { interruptAtMutation: 2 } });
  const interrupted = scenario.invoke();
  assert.equal(interrupted.status, null);
  assert.equal(interrupted.signal, 'SIGKILL');
  assert.equal(scenario.readState().rulesets.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, 'changed');
  assert.deepEqual(scenario.readState().mutationLog, [
    'create required-check ruleset',
    'update squash settings',
  ]);
});

test('blocks when final readback disagrees and reports applied effects', async t => {
  for (const mismatch of ['settings', 'branch']) {
    await t.test(mismatch, st => {
      const state = mismatch === 'branch'
        ? { settings: matchingSettings, branchStatusChecks: { strict: true, contexts: ['build'], checks: [] }, readbackMismatch: mismatch }
        : { readbackMismatch: mismatch };
      const scenario = setup(st, { state });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, 'blocked');
      assert.match(outcome.result.message, /final readback did not match/);
      assert.match(outcome.result.message, /Applied changes:/);
    });
  }
});

test('rejects non-fix invocation and project-content targets as protocol errors', t => {
  const scenario = setup(t);
  for (const overrides of [
    { operation: { declaration: 'github-pr-integration', phase: 'checks', id: 'required-checks-and-squash' } },
    { allowedTargets: { paths: ['README.md'], directories: [] } },
  ]) {
    const outcome = scenario.invoke(overrides);
    assert.equal(outcome.status, 1);
    assert.equal(outcome.result, null);
    assert.match(outcome.stderr, /GitHub PR integration setup/);
  }
});
