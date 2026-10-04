import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const builder = join(sourceRoot, 'scripts/create-deliver-skill-fixtures.mjs');
const template = '.github/PULL_REQUEST_TEMPLATE.md';
const sharedFiles = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  template,
  '.github/workflows/pr-metadata.yml',
  '.github/scripts/validate-pr-metadata.mjs',
  'operations/lib/rendered-markdown.mjs',
  'vendor/marked/marked.esm.js',
  'vendor/parse5/parse5.esm.js',
  'docs/agents/README.md',
  'docs/agents/domain.md',
  'docs/agents/issue-tracker.md',
  'docs/agents/triage-labels.md',
];

function build(t, env = process.env) {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-deliver-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const output = execFileSync(process.execPath, [builder, '--root', join(parent, 'fixtures')], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env,
  });
  return JSON.parse(output);
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function changes(cwd) {
  return execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function exerciseEnv(manifest) {
  return { ...process.env, PATH: `${manifest.path}${delimiter}${process.env.PATH}` };
}

function gh(manifest, cwd, ...args) {
  return spawnSync('gh', args, { cwd, encoding: 'utf8', env: exerciseEnv(manifest) });
}

function deliverBranch(manifest, repository, branch, message, paths) {
  git(repository, 'switch', '--quiet', '-c', branch);
  git(repository, 'add', '--', ...paths);
  git(repository, 'commit', '--quiet', '-m', message);
  git(repository, 'push', '--quiet', '-u', 'origin', branch);
}

test('the deliver skill is manual only in both invocation settings', () => {
  const skill = readFileSync(join(sourceRoot, '.agents/skills/deliver/SKILL.md'), 'utf8');
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? '';
  assert.match(frontmatter, /^name: deliver$/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  const policy = readFileSync(join(sourceRoot, '.agents/skills/deliver/agents/openai.yaml'), 'utf8');
  assert.match(policy, /^policy:\n {2}allow_implicit_invocation: false$/m);
});

test('builds the deliver exercise repositories with their stand-ins', (t) => {
  const manifest = build(t);
  assert.equal(manifest.format, 'repo-canon/deliver-skill-fixtures/v1');
  assert.match(manifest.source.worktreeCommit, /^[0-9a-f]{40}$/);
  assert.match(manifest.source.builderSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    manifest.source.directoryHashSerialization,
    'repo-canon/directory-sha256/recursive-locale-path-nul-bytes-nul/v1',
  );
  for (const path of [
    ...sharedFiles,
    'scripts/create-deliver-skill-fixtures.mjs',
    'scripts/support/exercise-gh.mjs',
    'scripts/support/exercise-repo-standards.mjs',
    'scripts/support/fixture-authoring.mjs',
  ]) {
    assert.match(manifest.source.inputFiles[path].sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(Object.keys(manifest.source.skills), ['deliver']);
  assert.match(manifest.source.skills.deliver.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(manifest.repositories).sort(), ['adoption', 'work']);
  assert.ok(lstatSync(join(manifest.path, 'gh')).mode & 0o111);

  for (const repository of Object.values(manifest.repositories)) {
    const root = repository.path;
    assert.equal(git(root, 'config', '--local', '--get', 'commit.gpgsign'), 'false');
    assert.equal(git(root, 'config', '--local', '--get', 'user.name'), 'Repo Canon Exercise');
    assert.equal(git(root, 'config', '--local', '--get', 'user.email'), 'exercise@example.invalid');
    assert.equal(git(root, 'branch', '--show-current'), 'main');
    assert.equal(git(root, 'remote', 'get-url', 'origin'), repository.remote);
    assert.equal(git(root, 'rev-parse', 'HEAD'), repository.head);
    assert.equal(git(root, '--git-dir', repository.remote, 'rev-parse', 'refs/heads/main'), repository.head);
    assert.equal(git(root, 'rev-parse', '--abbrev-ref', 'main@{upstream}'), 'origin/main');
    assert.notDeepEqual(changes(root), []);
    for (const path of sharedFiles.filter(path => repository !== manifest.repositories.adoption || path !== template)) {
      assert.deepEqual(readFileSync(join(root, path)), readFileSync(join(sourceRoot, path)), path);
    }
    assert.match(readFileSync(join(root, 'docs/development/README.md'), 'utf8'), /## Setup and validation\n\n.*`npm test`/s);
    assert.match(readFileSync(join(root, 'docs/agents/project.md'), 'utf8'), /disposable/);
    const link = join(root, '.agents/skills/deliver');
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.ok(existsSync(join(link, 'SKILL.md')));
    assert.ok(existsSync(join(link, 'agents/openai.yaml')));
  }
});

test('the stand-ins carry ordinary work to a pull request with its checks', (t) => {
  const manifest = build(t);
  const { path: root, issue } = manifest.repositories.work;
  assert.deepEqual(changes(root), [
    ' M src/parcel.mjs',
    '?? test/parcel-reference.test.mjs',
  ]);
  assert.match(gh(manifest, root, 'issue', 'view', String(issue), '--comments').stdout, /^Reject empty Parcel references #12\n/);
  assert.equal(gh(manifest, root, 'repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name').stdout, 'main\n');
  execFileSync('npm', ['test', '--silent'], { cwd: root, stdio: 'pipe' });

  const unpushed = gh(manifest, root, 'pr', 'create', '--title', 'x', '--body', 'x', '--head', 'missing');
  assert.equal(unpushed.status, 1);
  assert.match(unpushed.stderr, /must first push/);

  deliverBranch(manifest, root, 'fix/12-reject-empty-references', 'fix: reject empty Parcel references', ['src', 'test']);
  const body = join(manifest.root, 'body.md');
  writeFileSync(body, '## Summary\n\nRejects a missing or blank Parcel reference.\n\n## Validation\n\n- `npm test`: passed.\n- `git diff --check`: passed.\n\n## Related issue\n\nCloses #12\n');
  const created = gh(manifest, root, 'pr', 'create', '--base', 'main', '--title', 'fix: reject empty Parcel references', '--body-file', body);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.stdout, 'https://github.example.invalid/parcel/work/pull/13\n');
  const pull = JSON.parse(readFileSync(join(manifest.github, 'work/pulls/13.json'), 'utf8'));
  assert.equal(pull.headRefOid, git(root, 'rev-parse', 'HEAD'));
  assert.equal(pull.body, readFileSync(body, 'utf8'));

  const passing = gh(manifest, root, 'pr', 'checks', '13', '--watch');
  assert.equal(passing.status, 0, passing.stdout);
  assert.match(passing.stdout, /^PR metadata\tpass\t/m);
  assert.match(passing.stdout, /^Test\tpass\t/m);

  assert.equal(gh(manifest, root, 'pr', 'edit', '13', '--title', 'Reject empty references').status, 0);
  const failing = gh(manifest, root, 'pr', 'checks', '--json', 'name,bucket');
  assert.equal(failing.status, 1);
  assert.deepEqual(JSON.parse(failing.stdout), [
    { name: 'PR metadata', bucket: 'fail' },
    { name: 'Test', bucket: 'pass' },
  ]);
  assert.match(readFileSync(join(manifest.github, 'work/checks/13-pr-metadata.log'), 'utf8'), /Conventional Commit title/);

  const unsupported = gh(manifest, root, 'pr', 'merge', '13');
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /does not support: gh pr merge 13/);
  const calls = readFileSync(join(manifest.github, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.at(-1).args, ['pr', 'merge', '13']);
});

test('an adoption run is delivered with its record as the description', (t) => {
  const manifest = build(t);
  const { path: root, head } = manifest.repositories.adoption;
  const cli = join(root, '.repo-standards/runtime/node_modules/.bin/repo-standards');
  assert.deepEqual(changes(root), [
    ` M ${template}`,
    ' M .repo-standards/selection.yaml',
    ' M .repo-standards/state.json',
  ]);
  assert.equal(git(root, 'check-ignore', cli), cli);
  assert.deepEqual(readFileSync(join(root, template)), readFileSync(join(sourceRoot, template)));
  assert.notDeepEqual(execFileSync('git', ['show', `HEAD:${template}`], { cwd: root }), readFileSync(join(sourceRoot, template)));

  const status = JSON.parse(execFileSync(cli, ['status', '--json'], { cwd: root, encoding: 'utf8' }));
  assert.equal(status.active, null);
  assert.equal(status.lastComplete.head, head);
  assert.deepEqual(status.changeSet, [{ path: template, phases: ['installation'] }]);
  const record = execFileSync(cli, ['status', '--summary'], { cwd: root, encoding: 'utf8' });
  assert.match(record, /^# Repository Standards adoption record\n/);
  assert.match(record, /\| Standards version \| `v0\.4\.1` \|/);
  assert.equal(spawnSync(cli, ['inspect', '--json'], { cwd: root }).status, 1);

  const title = 'chore: adopt Repo Canon v0.4.1 with Repository Standards CLI 4.0.0';
  deliverBranch(manifest, root, 'chore/adopt-repo-canon-v0.4.1', title, ['.github', '.repo-standards']);
  assert.deepEqual(changes(root), []);
  const body = join(manifest.root, 'record.md');
  writeFileSync(body, record);
  assert.equal(gh(manifest, root, 'pr', 'create', '--title', title, '--body-file', body).status, 0);
  const checks = gh(manifest, root, 'pr', 'checks');
  assert.equal(checks.status, 0, checks.stdout);
  assert.match(checks.stdout, /^PR metadata\tpass\t/m);
});

test('later ordinary commits use local signing policy under hostile host configuration', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'repo-canon-deliver-signing-test-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const globalGitConfig = join(parent, 'gitconfig');
  const globalGitConfigBytes = '[commit]\n\tgpgSign = true\n[gpg]\n\tprogram = /bin/false\n';
  writeFileSync(globalGitConfig, globalGitConfigBytes);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: globalGitConfig };
  const manifest = build(t, env);
  const repository = manifest.repositories.work.path;

  execFileSync('git', ['add', '--all'], { cwd: repository, env });
  execFileSync('git', ['commit', '--quiet', '-m', 'fix: reject empty Parcel references'], { cwd: repository, env });
  assert.equal(readFileSync(globalGitConfig, 'utf8'), globalGitConfigBytes);
});
